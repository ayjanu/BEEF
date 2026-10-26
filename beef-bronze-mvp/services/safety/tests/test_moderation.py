from datetime import datetime, timedelta, timezone

import pytest

from app.moderation import LexiconProvider
from app.policy import NCII_LEGAL_DEADLINE, due_times, severity_for

p = LexiconProvider()


@pytest.mark.parametrize(
    "text",
    [
        "you're getting cooked at Four Up tonight",
        "Squash that beef! rematch at 8?",
        "bring your A game, I'm undefeated",
    ],
)
def test_trash_talk_passes(text):
    assert p.classify(text).action == "allow"


def test_threats_are_blocked():
    v = p.classify("I'm going to find you after this")
    assert v.action == "block" and "threat" in v.labels


def test_money_requests_are_blocked():
    assert p.classify("send me $50 on cash app and I'll show up").action == "block"


def test_phone_number_blurred_in_chat_blocked_in_bio():
    assert p.classify("text me 214-555-0100", "chat").action == "blur"
    assert p.classify("text me 214-555-0100", "bio").action == "block"


def test_off_platform_push_is_blurred():
    assert p.classify("add me on telegram instead").action == "blur"


def test_report_severity_and_clocks():
    assert severity_for("minor") == "critical"
    assert severity_for("ncii") == "high"
    assert severity_for("unknown-category") == "low"
    t0 = datetime(2026, 10, 26, tzinfo=timezone.utc)
    first, resolve = due_times("critical", t0)
    assert first - t0 == timedelta(minutes=15) and resolve - t0 == timedelta(hours=1)
    # Our internal high-severity resolution target is stricter than the 48 h legal maximum.
    _, high_resolve = due_times("high", t0)
    assert high_resolve - t0 < NCII_LEGAL_DEADLINE
