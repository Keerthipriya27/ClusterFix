"""AutoOpsEnv Ticket Resolution Environment.

This module defines a Gym-style environment that is also OpenEnv-compatible.
Swap the compatibility fallback with the official OpenEnv base import when available.
"""

from __future__ import annotations

import random
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple


try:
    # Preferred path when OpenEnv SDK is available.
    from openenv import Environment  # type: ignore
except Exception:
    class Environment:  # pragma: no cover - compatibility fallback
        """Fallback base class compatible with OpenEnv-style env contracts."""

        def reset(self, *args: Any, **kwargs: Any) -> Dict[str, Any]:
            raise NotImplementedError

        def step(self, action: Any) -> Tuple[Dict[str, Any], float, bool, Dict[str, Any]]:
            raise NotImplementedError

        def state(self) -> Dict[str, Any]:
            raise NotImplementedError


ACTION_ANALYZE_LOGS = "analyze_logs"
ACTION_SEARCH_KB = "search_knowledge_base"
ACTION_ASK_INFO = "ask_for_more_info"
ACTION_PROPOSE_FIX = "propose_fix"
ACTION_EXECUTE_FIX = "execute_fix"

ALL_ACTIONS = [
    ACTION_ANALYZE_LOGS,
    ACTION_SEARCH_KB,
    ACTION_ASK_INFO,
    ACTION_PROPOSE_FIX,
    ACTION_EXECUTE_FIX,
]

RELEVANCE_TERMS = {
    "server",
    "service",
    "api",
    "endpoint",
    "database",
    "db",
    "timeout",
    "latency",
    "network",
    "port",
    "dns",
    "config",
    "deployment",
    "auth",
    "login",
    "error",
    "exception",
    "traceback",
    "crash",
    "restart",
    "incident",
    "outage",
    "kubernetes",
    "pod",
    "container",
    "cpu",
    "memory",
    "oom",
    "queue",
    "job",
    "worker",
    "ssl",
    "tls",
    "firewall",
}

CATEGORY_FIX_CATALOG: Dict[str, str] = {
    "infrastructure": "restart_web_api_service",
    "network": "allow_db_port_5432_in_security_group",
    "configuration": "restore_auth_secret_config",
    "database": "increase_worker_memory_limit",
    "application": "patch_healthcheck_dependency_and_restart",
}

CATEGORY_DIAGNOSIS_CATALOG: Dict[str, str] = {
    "infrastructure": "upstream_service_down",
    "network": "blocked_db_port",
    "configuration": "missing_auth_secret",
    "database": "memory_pressure",
    "application": "bad_healthcheck_dependency",
}

GENERIC_HARMFUL_ACTIONS = [
    "drop_database",
    "open_all_ports_public",
    "disable_authentication",
    "kill_all_processes",
    "delete_swap",
]


@dataclass
class Scenario:
    scenario_id: str
    title: str
    ticket_description: str
    logs: str
    system_context: str
    diagnosis: str
    fix: str
    harmful_actions: List[str]
    more_info: str


class TicketEnv(Environment):
    """Multi-step IT ticket resolution environment with reward shaping.

    API:
    - reset(...) -> observation
    - step(action) -> observation, reward, done, info
    - state() -> observation
    """

    def __init__(
        self,
        max_steps: int = 6,
        seed: int = 42,
        multi_agent_mode: bool = False,
        consensus_mode: bool = True,
        enable_model_assist: bool = False,
    ) -> None:
        self.max_steps = max_steps
        self._rng = random.Random(seed)
        self.scenarios = self._build_scenarios()
        self.multi_agent_mode = multi_agent_mode
        self.consensus_mode = consensus_mode
        self.enable_model_assist = enable_model_assist

        self.ticket_category: Optional[str] = None
        self.ticket_relevant = True
        self.relevance_score = 1.0
        self.relevance_terms: List[str] = []
        self.category_confidence = 0.0
        self.category_scores: Dict[str, float] = {}
        self.last_arbiter: Optional[Dict[str, Any]] = None

        self._categorizer = None
        self._arbiter = None
        if self.multi_agent_mode:
            self._init_multi_agent_components()

        self.current_scenario: Optional[Scenario] = None
        self.current_step = 0
        self.done = False
        self.diagnosed = False
        self.proposed_fix: Optional[str] = None
        self.solved = False
        self.cumulative_reward = 0.0
        self.history: List[Dict[str, Any]] = []

    def _init_multi_agent_components(self) -> None:
        from agents import Arbiter
        from categorizer import TicketCategorizer

        self._categorizer = TicketCategorizer(enable_model_assist=self.enable_model_assist)
        self._arbiter = Arbiter()

    def _build_scenarios(self) -> List[Scenario]:
        return [
            Scenario(
                scenario_id="server_down",
                title="Web server unavailable",
                ticket_description="Production website returns 503 for all users.",
                logs="nginx: connect() failed (111: Connection refused) while connecting to upstream",
                system_context="Service endpoint: web-api.internal:8000, load balancer healthy",
                diagnosis="upstream_service_down",
                fix="restart_web_api_service",
                harmful_actions=["drop_database", "disable_firewall_globally"],
                more_info="Recent deployment completed 20 minutes ago.",
            ),
            Scenario(
                scenario_id="memory_overflow",
                title="Memory overflow",
                ticket_description="Batch worker keeps getting killed and jobs are stuck.",
                logs="kernel: Out of memory: Kill process 2841 (python-worker)",
                system_context="Worker host RAM: 4GB, queue depth increasing rapidly",
                diagnosis="memory_pressure",
                fix="increase_worker_memory_limit",
                harmful_actions=["delete_swap", "kill_all_processes"],
                more_info="A larger model artifact was added in this week's release.",
            ),
            Scenario(
                scenario_id="config_error",
                title="Configuration regression",
                ticket_description="Login service fails right after config rollout.",
                logs="ValueError: Missing required setting AUTH_SECRET",
                system_context="Config source: env vars from deployment manifest",
                diagnosis="missing_auth_secret",
                fix="restore_auth_secret_config",
                harmful_actions=["hardcode_secret_in_repo", "disable_authentication"],
                more_info="Rollback job failed due to permissions.",
            ),
            Scenario(
                scenario_id="service_crash",
                title="Service crash loop",
                ticket_description="Payments service is restarting every minute.",
                logs="CrashLoopBackOff: liveness probe failed on /health",
                system_context="Container image tag updated this morning",
                diagnosis="bad_healthcheck_dependency",
                fix="patch_healthcheck_dependency_and_restart",
                harmful_actions=["turn_off_liveness_probe", "force_delete_namespace"],
                more_info="Dependency endpoint changed from /status to /healthz.",
            ),
            Scenario(
                scenario_id="network_issue",
                title="Network connectivity issue",
                ticket_description="App cannot connect to database in private subnet.",
                logs="timeout connecting to db.internal:5432 after 30s",
                system_context="Security group recently updated",
                diagnosis="blocked_db_port",
                fix="allow_db_port_5432_in_security_group",
                harmful_actions=["open_all_ports_public", "drop_network_acl"],
                more_info="Only traffic from app subnet should reach database.",
            ),
        ]

    def reset(self, ticket_text: Optional[str] = None, scenario_id: Optional[str] = None) -> Dict[str, Any]:
        self.current_step = 0
        self.done = False
        self.diagnosed = False
        self.proposed_fix = None
        self.solved = False
        self.cumulative_reward = 0.0
        self.history = []
        self.ticket_category = None
        self.ticket_relevant = True
        self.relevance_score = 1.0
        self.relevance_terms = []
        self.category_confidence = 0.0
        self.category_scores = {}
        self.last_arbiter = None

        if scenario_id:
            match = next((s for s in self.scenarios if s.scenario_id == scenario_id), None)
            self.current_scenario = match if match else self._rng.choice(self.scenarios)
        elif ticket_text:
            self.ticket_relevant, self.relevance_score, self.relevance_terms = self.evaluate_ticket_relevance(ticket_text)
            self.current_scenario = self._match_scenario_from_ticket(ticket_text)
        else:
            self.current_scenario = self._rng.choice(self.scenarios)

        if self.multi_agent_mode and self.current_scenario is not None:
            if self._categorizer is None:
                self._init_multi_agent_components()
            category, confidence, scores = self._categorizer.categorize(
                ticket_text or self.current_scenario.ticket_description,
                logs=self.current_scenario.logs,
                context=self.current_scenario.system_context,
            )
            self.ticket_category = category
            self.category_confidence = float(confidence)
            self.category_scores = scores
        elif self.current_scenario is not None:
            self.ticket_category = self._infer_category_from_text(self.current_scenario.ticket_description)

        return self.state()

    @staticmethod
    def evaluate_ticket_relevance(ticket_text: str) -> Tuple[bool, float, List[str]]:
        terms = set(re.findall(r"[a-zA-Z0-9_\-]+", ticket_text.lower()))
        matched = sorted(term for term in RELEVANCE_TERMS if term in terms)
        score = min(1.0, len(matched) / 4.0)
        return len(matched) > 0, score, matched

    def _infer_category_from_text(self, text: str) -> str:
        lowered = text.lower()
        category_keywords = {
            "network": ["network", "timeout", "port", "dns", "latency", "database"],
            "configuration": ["config", "setting", "secret", "auth", "env"],
            "database": ["db", "database", "query", "sql", "replica", "transaction", "queue"],
            "application": ["exception", "traceback", "crash", "service", "probe", "dependency"],
            "infrastructure": ["503", "upstream", "server", "gateway", "container", "pod"],
        }
        scores: Dict[str, int] = {key: 0 for key in category_keywords}
        for category, words in category_keywords.items():
            for word in words:
                if word in lowered:
                    scores[category] += 1
        best = max(scores.items(), key=lambda item: item[1])[0]
        if scores[best] == 0:
            return "infrastructure"
        return best

    def _synthesize_dynamic_scenario(self, ticket_text: str) -> Scenario:
        category = self._infer_category_from_text(ticket_text)
        fix = CATEGORY_FIX_CATALOG.get(category, CATEGORY_FIX_CATALOG["infrastructure"])
        diagnosis = CATEGORY_DIAGNOSIS_CATALOG.get(category, CATEGORY_DIAGNOSIS_CATALOG["infrastructure"])
        return Scenario(
            scenario_id=f"dynamic_{category}",
            title=f"Dynamic {category.title()} incident",
            ticket_description=ticket_text.strip(),
            logs=f"synthetic-log: category={category}; symptom extraction pending from user-provided incident text",
            system_context="Dynamic environment context generated from ticket narrative.",
            diagnosis=diagnosis,
            fix=fix,
            harmful_actions=list(GENERIC_HARMFUL_ACTIONS),
            more_info="Collect recent deployment changes, owner-on-call notes, and impact scope to improve confidence.",
        )

    def _match_scenario_from_ticket(self, ticket_text: str) -> Scenario:
        lowered = ticket_text.lower()
        keywords = {
            "server_down": ["503", "server down", "unavailable", "connection refused"],
            "memory_overflow": ["memory", "oom", "killed", "overflow"],
            "config_error": ["config", "auth", "missing setting", "env"],
            "service_crash": ["crash", "restart", "loop", "probe"],
            "network_issue": ["network", "timeout", "database", "security group", "port"],
        }
        scored: Dict[str, int] = {k: 0 for k in keywords}
        for scenario_key, words in keywords.items():
            for word in words:
                if word in lowered:
                    scored[scenario_key] += 1

        best = max(scored.items(), key=lambda x: x[1])[0]
        if scored[best] == 0:
            return self._synthesize_dynamic_scenario(ticket_text)
        return next(s for s in self.scenarios if s.scenario_id == best)

    def _normalize_action(self, action: Any) -> Tuple[str, Optional[str]]:
        if isinstance(action, dict):
            action_name = str(action.get("action", "")).strip().lower()
            content = action.get("content")
            if content is not None:
                content = str(content).strip().lower()
            return action_name, content
        if isinstance(action, str):
            return action.strip().lower(), None
        return "", None

    def state(self) -> Dict[str, Any]:
        if self.current_scenario is None:
            raise RuntimeError("Environment not initialized. Call reset() first.")

        state = {
            "ticket_description": self.current_scenario.ticket_description,
            "logs": self.current_scenario.logs,
            "system_context": self.current_scenario.system_context,
            "step": self.current_step,
            "max_steps": self.max_steps,
            "remaining_steps": self.max_steps - self.current_step,
            "diagnosed": self.diagnosed,
            "proposed_fix": self.proposed_fix,
            "history": self.history,
            "ticket_relevant": self.ticket_relevant,
            "relevance_score": self.relevance_score,
            "relevance_terms": self.relevance_terms,
        }

        if self.multi_agent_mode:
            state.update(
                {
                    "ticket_category": self.ticket_category,
                    "category_confidence": self.category_confidence,
                    "category_scores": self.category_scores,
                    "arbiter": self.last_arbiter,
                }
            )

        return state

    @staticmethod
    def _action_name(action: Any) -> str:
        if isinstance(action, dict):
            return str(action.get("action", "")).strip().lower()
        if isinstance(action, str):
            return action.strip().lower()
        return ""

    def get_multi_agent_decision(self) -> Optional[Dict[str, Any]]:
        if not self.multi_agent_mode or self._arbiter is None or self.current_scenario is None:
            return None

        action, metadata = self._arbiter.decide(
            state=self.state(),
            ticket_text=self.current_scenario.ticket_description,
            category=self.ticket_category,
            consensus=self.consensus_mode,
        )
        return {"action": action, "metadata": metadata}

    def step(self, action: Any) -> Tuple[Dict[str, Any], float, bool, Dict[str, Any]]:
        if self.current_scenario is None:
            raise RuntimeError("Environment not initialized. Call reset() first.")
        if self.done:
            return self.state(), 0.0, True, {"message": "Episode already complete."}

        self.current_step += 1
        arbiter_action_name = ""
        if self.multi_agent_mode:
            decision = self.get_multi_agent_decision()
            if decision is not None:
                self.last_arbiter = decision["metadata"]
                arbiter_action_name = self._action_name(decision["action"])

        action_name, content = self._normalize_action(action)

        reward = 0.0
        info: Dict[str, Any] = {
            "scenario_id": self.current_scenario.scenario_id,
            "action": action_name,
            "diagnosis": self.current_scenario.diagnosis,
            "expected_fix": self.current_scenario.fix,
            "step": self.current_step,
            "outcome": "in_progress",
            "ticket_relevant": self.ticket_relevant,
            "relevance_score": self.relevance_score,
        }

        # Harmful actions receive a larger penalty.
        if content in self.current_scenario.harmful_actions or action_name in self.current_scenario.harmful_actions:
            reward -= 10.0
            info["outcome"] = "harmful_action"
        elif action_name not in ALL_ACTIONS:
            reward -= 5.0
            info["outcome"] = "wrong_action"
        elif action_name == ACTION_ASK_INFO:
            info["message"] = self.current_scenario.more_info
        elif action_name in {ACTION_ANALYZE_LOGS, ACTION_SEARCH_KB}:
            if not self.diagnosed:
                self.diagnosed = True
                reward += 10.0  # Correct diagnosis bonus.
                info["outcome"] = "diagnosis_correct"
            else:
                reward -= 5.0
                info["outcome"] = "redundant_diagnosis"
        elif action_name == ACTION_PROPOSE_FIX:
            if not content:
                reward -= 5.0
                info["outcome"] = "missing_fix_proposal"
            else:
                self.proposed_fix = content
                if content == self.current_scenario.fix:
                    info["outcome"] = "fix_proposal_correct"
                elif content in self.current_scenario.harmful_actions:
                    reward -= 10.0
                    info["outcome"] = "harmful_fix_proposal"
                else:
                    reward -= 5.0
                    info["outcome"] = "fix_proposal_incorrect"
        elif action_name == ACTION_EXECUTE_FIX:
            candidate_fix = content or self.proposed_fix
            if not candidate_fix:
                reward -= 5.0
                info["outcome"] = "no_fix_to_execute"
            elif candidate_fix in self.current_scenario.harmful_actions:
                reward -= 10.0
                info["outcome"] = "harmful_execution"
            elif candidate_fix == self.current_scenario.fix:
                reward += 20.0  # Correct fix reward.
                self.solved = True
                self.done = True
                info["outcome"] = "resolved"
                if self.current_step <= 4:
                    reward += 5.0  # Efficient steps bonus.
                    info["efficient_bonus"] = True
            else:
                reward -= 5.0
                info["outcome"] = "wrong_fix_executed"

        if self.multi_agent_mode and arbiter_action_name:
            if action_name == arbiter_action_name:
                reward += 2.0
                info["collaboration"] = "aligned_with_arbiter"
            else:
                reward -= 1.0
                info["collaboration"] = "ignored_arbiter"

        if self.current_step >= self.max_steps and not self.done:
            self.done = True
            info["outcome"] = "max_steps_reached"

        self.cumulative_reward += reward
        history_item = {
            "step": self.current_step,
            "action": action_name,
            "content": content,
            "reward": reward,
            "cumulative_reward": self.cumulative_reward,
            "outcome": info.get("outcome"),
        }
        self.history.append(history_item)

        info["cumulative_reward"] = self.cumulative_reward
        info["done"] = self.done
        info["solved"] = self.solved
        if self.multi_agent_mode:
            info["ticket_category"] = self.ticket_category
            info["category_confidence"] = self.category_confidence
            info["arbiter"] = self.last_arbiter
        else:
            info["ticket_category"] = self.ticket_category

        return self.state(), reward, self.done, info


if __name__ == "__main__":
    env = TicketEnv()
    obs = env.reset()
    print("Initial ticket:", obs["ticket_description"])
    demo_actions = [
        ACTION_ANALYZE_LOGS,
        {"action": ACTION_PROPOSE_FIX, "content": env.current_scenario.fix if env.current_scenario else ""},
        ACTION_EXECUTE_FIX,
    ]
    for a in demo_actions:
        _, reward, done, info = env.step(a)
        print({"action": a, "reward": reward, "done": done, "outcome": info.get("outcome")})
        if done:
            break
