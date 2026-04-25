from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Protocol, Tuple, Union

from categorizer import (
    CATEGORY_APPLICATION,
    CATEGORY_CONFIGURATION,
    CATEGORY_DATABASE,
    CATEGORY_INFRASTRUCTURE,
    CATEGORY_NETWORK,
)
from ticket_env import (
    ACTION_ANALYZE_LOGS,
    ACTION_ASK_INFO,
    ACTION_EXECUTE_FIX,
    ACTION_PROPOSE_FIX,
    ACTION_SEARCH_KB,
)

ActionPayload = Union[str, Dict[str, str]]


def infer_fix_from_ticket(category: str, ticket_text: str) -> str:
    lowered = ticket_text.lower()
    if category == CATEGORY_NETWORK:
        if "dns" in lowered:
            return "validate_dns_resolution_and_update_service_record"
        if "port" in lowered or "5432" in lowered:
            return "allow_db_port_5432_in_security_group"
        return "validate_network_policy_and_route_tables"
    if category == CATEGORY_CONFIGURATION:
        if "secret" in lowered or "auth" in lowered:
            return "restore_auth_secret_config"
        return "rollback_recent_configuration_change"
    if category == CATEGORY_DATABASE:
        if "oom" in lowered or "memory" in lowered:
            return "increase_worker_memory_limit"
        return "stabilize_database_pool_and_backpressure_limits"
    if category == CATEGORY_APPLICATION:
        if "health" in lowered or "probe" in lowered:
            return "patch_healthcheck_dependency_and_restart"
        return "rollback_application_release_and_restore_service"
    if "503" in lowered or "connection refused" in lowered:
        return "restart_web_api_service"
    return "restart_web_api_service"


class Specialist(Protocol):
    name: str
    category: str
    archetype: str

    def decide(self, state: Dict[str, Any], ticket_text: str) -> Tuple[ActionPayload, float, str]:
        ...


@dataclass(frozen=True)
class SpecialistDecision:
    agent_name: str
    category: str
    archetype: str
    action: ActionPayload
    confidence: float
    reasoning: str


class BaseSpecialist:
    def __init__(self, name: str, category: str, archetype: str) -> None:
        self.name = name
        self.category = category
        self.archetype = archetype

    def decide(self, state: Dict[str, Any], ticket_text: str) -> Tuple[ActionPayload, float, str]:
        raise NotImplementedError


class LogRanger(BaseSpecialist):
    def __init__(self) -> None:
        super().__init__("Log Ranger", CATEGORY_INFRASTRUCTURE, "Sentinel")

    def decide(self, state: Dict[str, Any], ticket_text: str) -> Tuple[ActionPayload, float, str]:
        if not bool(state.get("diagnosed", False)):
            return ACTION_ANALYZE_LOGS, 0.95, "Parsing upstream and service logs to isolate outage cause."
        proposed = state.get("proposed_fix")
        if proposed:
            return {"action": ACTION_EXECUTE_FIX, "content": str(proposed)}, 0.86, "Diagnosis complete. Executing prepared restoration fix."
        return ACTION_SEARCH_KB, 0.7, "Cross-checking known outage runbooks for safe remediation."


class NetSentinel(BaseSpecialist):
    def __init__(self) -> None:
        super().__init__("Net Sentinel", CATEGORY_NETWORK, "Vanguard")

    def decide(self, state: Dict[str, Any], ticket_text: str) -> Tuple[ActionPayload, float, str]:
        if not bool(state.get("diagnosed", False)):
            return ACTION_SEARCH_KB, 0.92, "Inspecting secure network policies and historical incident playbooks."
        if not state.get("proposed_fix"):
            dynamic_fix = infer_fix_from_ticket(self.category, ticket_text)
            return {"action": ACTION_PROPOSE_FIX, "content": dynamic_fix}, 0.88, "Proposing least-privilege network remediation for observed traffic failure."
        return {"action": ACTION_EXECUTE_FIX, "content": str(state.get("proposed_fix"))}, 0.82, "Applying validated network policy fix."


class ConfigMage(BaseSpecialist):
    def __init__(self) -> None:
        super().__init__("Config Mage", CATEGORY_CONFIGURATION, "Strategist")

    def decide(self, state: Dict[str, Any], ticket_text: str) -> Tuple[ActionPayload, float, str]:
        if not bool(state.get("diagnosed", False)):
            return ACTION_ANALYZE_LOGS, 0.86, "Tracing configuration diffs and missing secure parameters."
        if not state.get("proposed_fix"):
            dynamic_fix = infer_fix_from_ticket(self.category, ticket_text)
            return {"action": ACTION_PROPOSE_FIX, "content": dynamic_fix}, 0.9, "Restoring configuration integrity through controlled config remediation."
        return {"action": ACTION_EXECUTE_FIX, "content": str(state.get("proposed_fix"))}, 0.82, "Executing safe configuration restore and validation."


class DataForge(BaseSpecialist):
    def __init__(self) -> None:
        super().__init__("Data Forge", CATEGORY_DATABASE, "Analyst")

    def decide(self, state: Dict[str, Any], ticket_text: str) -> Tuple[ActionPayload, float, str]:
        if not bool(state.get("diagnosed", False)):
            return ACTION_ASK_INFO, 0.8, "Requesting memory and workload telemetry before attempting DB-side changes."
        if not state.get("proposed_fix"):
            dynamic_fix = infer_fix_from_ticket(self.category, ticket_text)
            return {"action": ACTION_PROPOSE_FIX, "content": dynamic_fix}, 0.76, "Proposing data-tier stabilization based on observed workload symptoms."
        return {"action": ACTION_EXECUTE_FIX, "content": str(state.get("proposed_fix"))}, 0.72, "Executing capacity fix and monitoring queue recovery."


class AppGuardian(BaseSpecialist):
    def __init__(self) -> None:
        super().__init__("App Guardian", CATEGORY_APPLICATION, "Operator")

    def decide(self, state: Dict[str, Any], ticket_text: str) -> Tuple[ActionPayload, float, str]:
        if not bool(state.get("diagnosed", False)):
            return ACTION_ANALYZE_LOGS, 0.9, "Following crash-loop traces to identify dependency drift."
        if not state.get("proposed_fix"):
            dynamic_fix = infer_fix_from_ticket(self.category, ticket_text)
            return {"action": ACTION_PROPOSE_FIX, "content": dynamic_fix}, 0.88, "Proposing app-level remediation aligned with runtime failure pattern."
        return {"action": ACTION_EXECUTE_FIX, "content": str(state.get("proposed_fix"))}, 0.84, "Applying patch and restart sequence for service recovery."


class AgentRegistry:
    def __init__(self) -> None:
        self._agents: Dict[str, BaseSpecialist] = {
            CATEGORY_INFRASTRUCTURE: LogRanger(),
            CATEGORY_NETWORK: NetSentinel(),
            CATEGORY_CONFIGURATION: ConfigMage(),
            CATEGORY_DATABASE: DataForge(),
            CATEGORY_APPLICATION: AppGuardian(),
        }

    def get(self, category: str) -> BaseSpecialist:
        return self._agents.get(category, self._agents[CATEGORY_INFRASTRUCTURE])

    def all_agents(self) -> List[BaseSpecialist]:
        return list(self._agents.values())


class Arbiter:
    def __init__(self, registry: Optional[AgentRegistry] = None) -> None:
        self.registry = registry or AgentRegistry()

    def decide(
        self,
        state: Dict[str, Any],
        ticket_text: str,
        category: Optional[str],
        consensus: bool = True,
    ) -> Tuple[ActionPayload, Dict[str, Any]]:
        specialists = self.registry.all_agents() if consensus else [self.registry.get(category or CATEGORY_INFRASTRUCTURE)]

        decisions: List[SpecialistDecision] = []
        for specialist in specialists:
            action, confidence, reasoning = specialist.decide(state, ticket_text)
            decisions.append(
                SpecialistDecision(
                    agent_name=specialist.name,
                    category=specialist.category,
                    archetype=specialist.archetype,
                    action=action,
                    confidence=float(confidence),
                    reasoning=reasoning,
                )
            )

        selected = self._pick_decision(decisions, state)
        metadata = {
            "mode": "consensus" if consensus else "specialist_only",
            "selected_agent": selected.agent_name,
            "selected_category": selected.category,
            "selected_confidence": round(selected.confidence, 4),
            "selected_reasoning": selected.reasoning,
            "decision_log": [
                {
                    "agent": item.agent_name,
                    "category": item.category,
                    "archetype": item.archetype,
                    "action": item.action if isinstance(item.action, str) else item.action.get("action", ""),
                    "confidence": round(item.confidence, 4),
                    "reasoning": item.reasoning,
                }
                for item in sorted(decisions, key=lambda value: value.confidence, reverse=True)
            ],
        }
        return selected.action, metadata

    @staticmethod
    def _pick_decision(decisions: List[SpecialistDecision], state: Dict[str, Any]) -> SpecialistDecision:
        if not decisions:
            raise RuntimeError("Arbiter requires at least one decision.")

        ranked = sorted(decisions, key=lambda item: item.confidence, reverse=True)
        step = int(state.get("step", 0))
        diagnosed = bool(state.get("diagnosed", False))
        proposed_fix = state.get("proposed_fix")
        preferred_category = str(state.get("ticket_category", "") or "")

        def action_name(candidate: SpecialistDecision) -> str:
            return candidate.action if isinstance(candidate.action, str) else str(candidate.action.get("action", ""))

        category_first = ranked
        if preferred_category:
            matching = [candidate for candidate in ranked if candidate.category == preferred_category]
            non_matching = [candidate for candidate in ranked if candidate.category != preferred_category]
            category_first = matching + non_matching

        if step <= 1 or not diagnosed:
            early_actions = {ACTION_ANALYZE_LOGS, ACTION_SEARCH_KB, ACTION_ASK_INFO}
            for candidate in category_first:
                if action_name(candidate) in early_actions:
                    return candidate

        if diagnosed and not proposed_fix:
            for candidate in category_first:
                if action_name(candidate) == ACTION_PROPOSE_FIX:
                    return candidate

        if diagnosed and proposed_fix:
            for candidate in category_first:
                if action_name(candidate) == ACTION_EXECUTE_FIX:
                    return candidate

        return category_first[0]
