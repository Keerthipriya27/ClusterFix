from __future__ import annotations

from agents import Arbiter
from categorizer import CATEGORY_NETWORK, TicketCategorizer


def test_categorizer_identifies_network_ticket() -> None:
    categorizer = TicketCategorizer()
    category, confidence, scores = categorizer.categorize(
        "App cannot reach database",
        logs="timeout connecting to db.internal:5432",
        context="security group changed",
    )

    assert category == CATEGORY_NETWORK
    assert confidence > 0.2
    assert scores[CATEGORY_NETWORK] >= max(scores.values())


def test_arbiter_returns_consensus_metadata() -> None:
    arbiter = Arbiter()
    state = {
        "step": 1,
        "diagnosed": False,
        "proposed_fix": None,
        "history": [],
    }

    action, metadata = arbiter.decide(
        state=state,
        ticket_text="Service returns 503 after deploy and upstream connection refused",
        category="infrastructure",
        consensus=True,
    )

    assert isinstance(metadata, dict)
    assert metadata.get("mode") == "consensus"
    assert metadata.get("selected_agent")
    decision_log = metadata.get("decision_log")
    assert isinstance(decision_log, list)
    assert len(decision_log) >= 3
    assert action
