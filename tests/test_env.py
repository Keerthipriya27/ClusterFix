from __future__ import annotations

from ticket_env import ACTION_ANALYZE_LOGS, ACTION_EXECUTE_FIX, ACTION_PROPOSE_FIX, TicketEnv


def test_single_agent_mode_still_solves_ticket() -> None:
    env = TicketEnv(max_steps=6, multi_agent_mode=False)
    state = env.reset(scenario_id="server_down")

    assert "ticket_category" not in state

    state, reward_a, done, _ = env.step(ACTION_ANALYZE_LOGS)
    assert reward_a >= 0
    assert not done

    state, reward_b, done, _ = env.step({"action": ACTION_PROPOSE_FIX, "content": "restart_web_api_service"})
    assert reward_b >= -5
    assert not done

    _, reward_c, done, info = env.step(ACTION_EXECUTE_FIX)
    assert done
    assert info["solved"] is True
    assert reward_c >= 20


def test_multi_agent_mode_exposes_category_and_arbiter() -> None:
    env = TicketEnv(max_steps=6, multi_agent_mode=True, consensus_mode=True)
    state = env.reset(ticket_text="DB timeout and security group blocks port 5432")

    assert "ticket_category" in state
    assert state["ticket_category"]

    decision = env.get_multi_agent_decision()
    assert isinstance(decision, dict)
    assert "action" in decision
    assert "metadata" in decision

    _, _, _, info = env.step(decision["action"])
    assert "arbiter" in info
    assert info.get("ticket_category")
