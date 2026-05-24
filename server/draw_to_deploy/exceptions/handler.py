import logging

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """Custom exception handler for consistent error responses."""

    response = exception_handler(exc, context)

    if response is not None:
        return response

    # Handle unhandled exceptions.
    logger.exception("Unhandled exception: %s", exc)

    return Response(
        {
            "success": False,
            "status_code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            "message": "An internal server error occurred.",
            "type": "InternalServerError",
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
