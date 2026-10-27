"""Report severity and response clocks from Spec 04, "Moderation, community rules, enforcement"."""

from __future__ import annotations

from datetime import datetime, timedelta

# category -> severity
SEVERITY: dict[str, str] = {
    "minor": "critical",
    # Level 4 Shield "Emergency", or no answer to the end-of-meet check-in (Spec 04).
    "in_person": "critical",
    "threat": "high",
    "ncii": "high",
    "harassment": "medium",
    "hate": "medium",
    "sexual": "medium",
    "cheating": "medium",
    "spam": "low",
    "other": "low",
}

# severity -> (first action, resolution)
SLA: dict[str, tuple[timedelta, timedelta]] = {
    "critical": (timedelta(minutes=15), timedelta(hours=1)),
    "high": (timedelta(hours=1), timedelta(hours=24)),
    "medium": (timedelta(hours=12), timedelta(hours=72)),
    "low": (timedelta(hours=48), timedelta(days=7)),
}

# TAKE IT DOWN Act: valid NCII removal requests must be actioned within 48 hours.
NCII_LEGAL_DEADLINE = timedelta(hours=48)


def severity_for(category: str) -> str:
    return SEVERITY.get(category, "low")


def due_times(severity: str, received_at: datetime) -> tuple[datetime, datetime]:
    first, resolve = SLA[severity]
    return received_at + first, received_at + resolve
