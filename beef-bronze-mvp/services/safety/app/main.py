"""BEEF trust and safety service (FastAPI).

Endpoints
  POST /v1/classify/text   internal  chat/bio pre-check, called synchronously by chat
  POST /v1/reports         internal  in-app reports (via core-api, which adds reporterId)
  GET  /v1/reports         internal  moderator queue, most urgent first
  POST /v1/takedown        public    TAKE IT DOWN Act request form; no account needed
  GET  /v1/takedown/{id}   public    status by ticket number
"""

from __future__ import annotations

import hmac
import ssl as ssl_lib
import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Annotated, Literal

import asyncpg
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field, HttpUrl

from .moderation import LexiconProvider, TextModerationProvider
from .policy import NCII_LEGAL_DEADLINE, due_times, severity_for

SCHEMA_SQL = """
CREATE SCHEMA IF NOT EXISTS safety;
CREATE TABLE IF NOT EXISTS safety.reports (
  id             uuid PRIMARY KEY,
  reporter_id    uuid NOT NULL,
  subject_type   text NOT NULL,
  subject_id     text NOT NULL,
  category       text NOT NULL,
  severity       text NOT NULL,
  details        text NOT NULL DEFAULT '',
  status         text NOT NULL DEFAULT 'open',
  first_action_due timestamptz NOT NULL,
  resolve_due    timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_open_due ON safety.reports (resolve_due) WHERE status = 'open';
CREATE TABLE IF NOT EXISTS safety.takedown_requests (
  id             uuid PRIMARY KEY,
  ticket         text UNIQUE NOT NULL,
  content_url    text NOT NULL,
  requester_name text NOT NULL,
  requester_email text NOT NULL,
  is_depicted_person boolean NOT NULL,
  statement      text NOT NULL,
  signature      text NOT NULL,
  status         text NOT NULL DEFAULT 'received',
  legal_deadline timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
"""


def _required_env(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        raise RuntimeError(f"{name} must be set")
    return value


@asynccontextmanager
async def lifespan(app: FastAPI):
    ssl = None
    if os.environ.get("DATABASE_SSL") == "require":
        # Verify the server certificate and hostname (asyncpg's plain "require" does neither).
        ssl = ssl_lib.create_default_context(cafile=os.environ.get("DATABASE_CA_FILE"))
    app.state.pool = await asyncpg.create_pool(_required_env("DATABASE_URL"), min_size=1, max_size=5, ssl=ssl)
    async with app.state.pool.acquire() as conn:
        # Same advisory-lock pattern as core-api so concurrent replicas don't race the DDL.
        async with conn.transaction():
            await conn.execute("SELECT pg_advisory_xact_lock(7031002)")
            await conn.execute(SCHEMA_SQL)
    app.state.internal_token = _required_env("INTERNAL_TOKEN").encode()
    app.state.provider = LexiconProvider()
    yield
    await app.state.pool.close()


app = FastAPI(title="BEEF safety", version="0.1.0", lifespan=lifespan)


def internal_only(request: Request, x_internal_token: Annotated[str, Header()] = "") -> None:
    if not hmac.compare_digest(x_internal_token.encode(), request.app.state.internal_token):
        raise HTTPException(status_code=401, detail={"error": "internal_only"})


Internal = Depends(internal_only)


def provider(request: Request) -> TextModerationProvider:
    return request.app.state.provider


# ---------- health ----------


@app.get("/healthz")
async def healthz():
    return {"ok": True}


@app.get("/readyz")
async def readyz(request: Request):
    async with request.app.state.pool.acquire() as conn:
        await conn.fetchval("SELECT 1")
    return {"ok": True}


# ---------- classification ----------


class ClassifyText(BaseModel):
    text: str = Field(max_length=4000)
    context: Literal["chat", "bio", "comment", "two_truths"] = "chat"


@app.post("/v1/classify/text", dependencies=[Internal])
async def classify_text(body: ClassifyText, p: Annotated[TextModerationProvider, Depends(provider)]):
    v = p.classify(body.text, body.context)
    return {"action": v.action, "labels": v.labels, "score": v.score}


# ---------- reports ----------


class ReportIn(BaseModel):
    reporterId: uuid.UUID
    subjectType: Literal["user", "message", "media", "session"]
    subjectId: str = Field(min_length=1, max_length=200)
    category: Literal["harassment", "hate", "sexual", "threat", "minor", "ncii", "cheating", "spam", "other"]
    details: str = Field(default="", max_length=2000)


@app.post("/v1/reports", status_code=201, dependencies=[Internal])
async def create_report(body: ReportIn, request: Request):
    now = datetime.now(timezone.utc)
    severity = severity_for(body.category)
    first_due, resolve_due = due_times(severity, now)
    rid = uuid.uuid4()
    async with request.app.state.pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO safety.reports
               (id, reporter_id, subject_type, subject_id, category, severity, details, first_action_due, resolve_due, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)""",
            rid, body.reporterId, body.subjectType, body.subjectId, body.category, severity,
            body.details, first_due, resolve_due, now,
        )
    return {"id": str(rid), "severity": severity, "firstActionDue": first_due.isoformat(), "resolveDue": resolve_due.isoformat()}


@app.get("/v1/reports", dependencies=[Internal])
async def list_reports(request: Request, status: str = "open", limit: int = 50):
    async with request.app.state.pool.acquire() as conn:
        rows = await conn.fetch(
            """SELECT id, category, severity, subject_type, subject_id, resolve_due, created_at
               FROM safety.reports WHERE status = $1
               ORDER BY CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, resolve_due
               LIMIT $2""",
            status, min(max(limit, 1), 200),
        )
    return [
        {**dict(r), "id": str(r["id"]), "resolve_due": r["resolve_due"].isoformat(), "created_at": r["created_at"].isoformat()}
        for r in rows
    ]


# ---------- TAKE IT DOWN Act intake (public) ----------


class TakedownIn(BaseModel):
    contentUrl: HttpUrl
    requesterName: str = Field(min_length=2, max_length=200)
    requesterEmail: EmailStr
    isDepictedPerson: bool
    statement: str = Field(min_length=20, max_length=4000, description="Why the content is intimate and non-consensual")
    signature: str = Field(min_length=2, max_length=200)


@app.post("/v1/takedown", status_code=201)
async def takedown(body: TakedownIn, request: Request):
    now = datetime.now(timezone.utc)
    tid = uuid.uuid4()
    ticket = "TD-" + tid.hex[:10].upper()
    async with request.app.state.pool.acquire() as conn:
        await conn.execute(
            """INSERT INTO safety.takedown_requests
               (id, ticket, content_url, requester_name, requester_email, is_depicted_person, statement, signature, legal_deadline, created_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)""",
            tid, ticket, str(body.contentUrl), body.requesterName, body.requesterEmail,
            body.isDepictedPerson, body.statement, body.signature, now + NCII_LEGAL_DEADLINE, now,
        )
    return {"ticket": ticket, "status": "received", "removeBy": (now + NCII_LEGAL_DEADLINE).isoformat()}


@app.get("/v1/takedown/{ticket}")
async def takedown_status(ticket: str, request: Request):
    async with request.app.state.pool.acquire() as conn:
        row = await conn.fetchrow("SELECT ticket, status, legal_deadline FROM safety.takedown_requests WHERE ticket = $1", ticket)
    if not row:
        raise HTTPException(404, detail={"error": "not_found"})
    return {"ticket": row["ticket"], "status": row["status"], "removeBy": row["legal_deadline"].isoformat()}
