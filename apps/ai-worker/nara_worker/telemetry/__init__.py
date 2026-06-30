"""Cost + behavior telemetry for AI calls.

- pricing.py  : static $/token map + estimate_cost()
- ledger.py   : record_event() writes one ai_events row (non-fatal)
- callback.py : AiCostCallback (LangChain handler) + telemetry_config() helper
"""

from .callback import cost_callback, telemetry_config
from .ledger import record_event
from .pricing import estimate_cost

__all__ = ["cost_callback", "telemetry_config", "record_event", "estimate_cost"]
