"""Local OpenEnv compatibility shim.

This project is an OpenEnv-style hackathon submission, so the environment
imports `Environment` from here when the official package is not installed.
"""

from __future__ import annotations

from typing import Any, Dict, Tuple


class Environment:
    """Minimal OpenEnv-compatible base class."""

    def reset(self, *args: Any, **kwargs: Any) -> Dict[str, Any]:
        raise NotImplementedError

    def step(self, action: Any) -> Tuple[Dict[str, Any], float, bool, Dict[str, Any]]:
        raise NotImplementedError

    def state(self) -> Dict[str, Any]:
        raise NotImplementedError