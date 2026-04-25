from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple


DEFAULT_CATEGORY = "infrastructure"
CATEGORY_INFRASTRUCTURE = "infrastructure"
CATEGORY_NETWORK = "network"
CATEGORY_CONFIGURATION = "configuration"
CATEGORY_DATABASE = "database"
CATEGORY_APPLICATION = "application"


@dataclass(frozen=True)
class CategoryProfile:
    category: str
    keywords: List[str]


class TicketCategorizer:
    """Classifies ticket text into operational categories.

    The classifier is deterministic by default (keyword scoring), with an optional
    model-based assist path via Hugging Face pipeline when available.
    """

    PROFILES: List[CategoryProfile] = [
        CategoryProfile(
            category=CATEGORY_INFRASTRUCTURE,
            keywords=[
                "503",
                "server",
                "connection refused",
                "upstream",
                "gateway",
                "nginx",
            ],
        ),
        CategoryProfile(
            category=CATEGORY_NETWORK,
            keywords=[
                "network",
                "timeout",
                "port",
                "security group",
                "dns",
                "subnet",
                "latency",
            ],
        ),
        CategoryProfile(
            category=CATEGORY_CONFIGURATION,
            keywords=[
                "config",
                "missing setting",
                "env",
                "secret",
                "auth",
                "manifest",
            ],
        ),
        CategoryProfile(
            category=CATEGORY_DATABASE,
            keywords=[
                "database",
                "db",
                "sql",
                "query",
                "transaction",
                "replica",
            ],
        ),
        CategoryProfile(
            category=CATEGORY_APPLICATION,
            keywords=[
                "crash",
                "exception",
                "stack trace",
                "healthcheck",
                "dependency",
                "service",
                "probe",
            ],
        ),
    ]

    def __init__(self, enable_model_assist: bool = False, model_name: Optional[str] = None) -> None:
        self.enable_model_assist = enable_model_assist
        self.model_name = model_name or "facebook/bart-large-mnli"
        self._classifier = None

    @property
    def categories(self) -> List[str]:
        return [profile.category for profile in self.PROFILES]

    def categorize(self, ticket_text: str, logs: str = "", context: str = "") -> Tuple[str, float, Dict[str, float]]:
        combined = " ".join(part for part in [ticket_text, logs, context] if part).lower()
        rule_scores = self._rule_based_scores(combined)

        if self.enable_model_assist:
            model_scores = self._model_scores(combined)
            if model_scores:
                merged = self._merge_scores(rule_scores, model_scores)
                best = max(merged.items(), key=lambda item: item[1])[0]
                return best, merged[best], merged

        best = max(rule_scores.items(), key=lambda item: item[1])[0]
        confidence = rule_scores[best]
        if confidence <= 0.0:
            return DEFAULT_CATEGORY, 0.15, rule_scores
        return best, confidence, rule_scores

    def _rule_based_scores(self, text: str) -> Dict[str, float]:
        scores = {profile.category: 0.0 for profile in self.PROFILES}
        if not text.strip():
            scores[DEFAULT_CATEGORY] = 0.15
            return scores

        for profile in self.PROFILES:
            total = 0
            for keyword in profile.keywords:
                total += text.count(keyword)
            if total == 0:
                scores[profile.category] = 0.0
            else:
                scores[profile.category] = min(0.95, 0.2 + 0.12 * float(total))

        if all(value == 0.0 for value in scores.values()):
            scores[DEFAULT_CATEGORY] = 0.15
        return scores

    def _model_scores(self, text: str) -> Optional[Dict[str, float]]:
        if not text.strip():
            return None
        try:
            classifier = self._load_classifier()
            if classifier is None:
                return None
            result = classifier(text, candidate_labels=self.categories)
        except Exception:
            return None

        labels = result.get("labels", [])
        values = result.get("scores", [])
        model_scores: Dict[str, float] = {}
        for label, value in zip(labels, values):
            model_scores[str(label).lower()] = float(value)
        return model_scores if model_scores else None

    def _load_classifier(self):
        if self._classifier is not None:
            return self._classifier
        try:
            from transformers import pipeline
        except Exception:
            return None
        try:
            self._classifier = pipeline("zero-shot-classification", model=self.model_name)
        except Exception:
            return None
        return self._classifier

    @staticmethod
    def _merge_scores(rule_scores: Dict[str, float], model_scores: Dict[str, float]) -> Dict[str, float]:
        merged: Dict[str, float] = {}
        all_categories = set(rule_scores).union(model_scores)
        for category in all_categories:
            merged[category] = round(0.6 * rule_scores.get(category, 0.0) + 0.4 * model_scores.get(category, 0.0), 4)

        if all(value <= 0.0 for value in merged.values()):
            merged[DEFAULT_CATEGORY] = 0.15
        return merged
