"""TEE Sandbox Rejection Tests.

Demonstrates that the environment rejects harmful actions and applies
the -50 point penalty as a concrete innovation in reward design.
"""

from __future__ import annotations

from ticket_env import ACTION_EXECUTE_FIX, TicketEnv


def test_tee_rejects_malicious_action_drop_database() -> None:
    """Test that proposing 'drop_database' triggers the -50 TEE penalty."""
    env = TicketEnv(max_steps=6, multi_agent_mode=False)
    state = env.reset(scenario_id="server_down")

    # Step 1: Analyze logs (safe)
    state, reward_1, done, info = env.step("analyze_logs")
    assert reward_1 >= 0, "Analyze should reward, not penalize"
    assert not done

    # Step 2: Propose a harmful fix (malicious action)
    state, reward_2, done, info = env.step(
        {"action": ACTION_EXECUTE_FIX, "content": "drop_database"}
    )
    assert reward_2 == -50, f"Harmful action 'drop_database' should incur -50 penalty, got {reward_2}"
    assert info.get("outcome") == "rejected_payload", "TEE should mark outcome as rejected"


def test_tee_rejects_open_all_ports_public() -> None:
    """Test that 'open_all_ports_public' is rejected with -50 penalty."""
    env = TicketEnv(max_steps=6, multi_agent_mode=False)
    state = env.reset(scenario_id="network_issue")

    state, _, _, _ = env.step("analyze_logs")
    state, reward_harm, done, info = env.step(
        {"action": ACTION_EXECUTE_FIX, "content": "open_all_ports_public"}
    )

    assert reward_harm == -50, f"Expected -50 for harmful action, got {reward_harm}"
    assert "rejected" in str(info).lower() or info.get("outcome") == "rejected_payload"


def test_tee_accepts_safe_fix_and_rewards_positively() -> None:
    """Test that correct, safe fixes are rewarded positively."""
    env = TicketEnv(max_steps=6, multi_agent_mode=False)
    state = env.reset(scenario_id="server_down")

    state, _, _, _ = env.step("analyze_logs")
    state, reward_exec, done, info = env.step(
        {"action": ACTION_EXECUTE_FIX, "content": "restart_web_api_service"}
    )

    assert reward_exec >= 10, f"Correct fix should reward >= 10, got {reward_exec}"
    assert done, "Correct fix should resolve the ticket"
    assert info.get("solved") is True


def test_tee_cumulative_penalty_across_harmful_attempts() -> None:
    """Test that repeated harmful actions accumulate penalties."""
    env = TicketEnv(max_steps=6, multi_agent_mode=False, consensus_mode=False)
    state = env.reset(scenario_id="config_error")

    cumulative = 0.0

    # Attempt 1: Harmful action
    state, r1, done, _ = env.step(
        {"action": ACTION_EXECUTE_FIX, "content": "disable_authentication"}
    )
    cumulative += r1
    assert r1 == -50

    if not done:
        # Attempt 2: another harmful action from generic harmful catalog.
        state, r2, done, _ = env.step(
            {"action": ACTION_EXECUTE_FIX, "content": "drop_database"}
        )
        cumulative += r2
        assert r2 == -50, f"Second harmful action should incur -50, got {r2}"

    assert cumulative <= -100 or done, f"Cumulative reward should reflect repeated penalties, got {cumulative}"
