"""Text moderation for chat, bios, comments, and player-written game text.

Bronze ships a deterministic lexicon + pattern provider so every message path
is wired end to end and testable offline. Silver replaces it with a hosted
moderation model behind the same `TextModerationProvider` protocol (Spec 03,
"Trust and safety ML"). Models flag; people ban.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal, Protocol

Action = Literal["allow", "blur", "block"]


@dataclass(frozen=True)
class Verdict:
    action: Action
    labels: list[str] = field(default_factory=list)
    score: float = 0.0


class TextModerationProvider(Protocol):
    def classify(self, text: str, context: str) -> Verdict: ...


# Patterns are deliberately conservative. Competitive trash talk ("you're getting cooked")
# is part of the brand and must pass; threats, doxxing and solicitation must not.
_THREAT = re.compile(
    r"\b(i('| a)?m going to|i('| wi)ll|gonna)\s+(kill|hurt|stab|shoot|find)\s+(you|u)\b", re.I
)
_PHONE = re.compile(r"(?<!\d)(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}(?!\d)")
_ADDRESS = re.compile(
    r"\b\d{2,6}\s+\w+(\s\w+)?\s+(st|street|ave|avenue|rd|road|blvd|dr|drive|ln|lane)\b", re.I
)
_MONEY = re.compile(r"\b(cash\s?app|venmo|zelle|gift\s?card|wire me|send me \$?\d+)\b", re.I)
_OFF_PLATFORM = re.compile(r"\b(snap(chat)?|telegram|whats\s?app|kik)\b", re.I)

# Placeholder for a maintained hate-speech lexicon (licensed list in Silver).
# Kept as hashed-free tokens here so the file contains no slurs.
_HATE_TOKENS: frozenset[str] = frozenset({"<hate-token-1>", "<hate-token-2>"})


class LexiconProvider:
    """Rule-based Bronze provider."""

    def classify(self, text: str, context: str = "chat") -> Verdict:
        labels: list[str] = []
        lowered = text.lower()

        if _THREAT.search(text):
            labels.append("threat")
        if any(tok in lowered.split() for tok in _HATE_TOKENS):
            labels.append("hate")
        if _MONEY.search(text):
            labels.append("money_request")
        if _PHONE.search(text) or _ADDRESS.search(text):
            labels.append("personal_info")
        if _OFF_PLATFORM.search(text):
            labels.append("off_platform")

        if "threat" in labels or "hate" in labels:
            return Verdict("block", labels, 0.95)
        if "money_request" in labels:
            return Verdict("block", labels, 0.8)
        if "personal_info" in labels and context in {"bio", "two_truths", "game_text"}:
            # Spec 02: text in mind games is screened for personal data.
            return Verdict("block", labels, 0.7)
        if labels:
            # Shown behind a "Does this bother you?" interstitial, not removed.
            return Verdict("blur", labels, 0.5)
        return Verdict("allow", [], 0.0)
