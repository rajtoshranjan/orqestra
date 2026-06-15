import logging
from typing import Dict

from .base import BaseServiceHandler

logger = logging.getLogger(__name__)


class ServiceRegistry:
    """
    Registry for service handlers.
    Provides methods to register and retrieve handlers.
    """

    def __init__(self):
        self._handlers: Dict[str, BaseServiceHandler] = {}

    def register(self, handler: BaseServiceHandler):
        """Register a handler."""
        if not isinstance(handler, BaseServiceHandler):
            raise TypeError("Handler must implement BaseServiceHandler")
        self._handlers[handler.service_id] = handler
        logger.info(
            "Registered cloud service handler: %s (%s)",
            handler.service_id,
            handler.display_name,
        )

    def get(self, service_id: str) -> BaseServiceHandler:
        """Retrieve a handler by service_id."""
        if service_id not in self._handlers:
            raise ValueError(f"Service handler '{service_id}' is not registered.")
        return self._handlers[service_id]

    def is_registered(self, service_id: str) -> bool:
        """Check if a handler is registered."""
        return service_id in self._handlers


# Singleton instance.
registry = ServiceRegistry()
