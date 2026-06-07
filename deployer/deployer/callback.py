import logging

import requests

logger = logging.getLogger(__name__)


def send_callback(callback_url: str, results: dict) -> None:
    """
    Send deployment results back to the Django server.

    Retries up to 3 times on transient failures.
    """
    max_retries = 3

    for attempt in range(1, max_retries + 1):
        try:
            response = requests.post(
                callback_url,
                json=results,
                timeout=30,
                headers={"Content-Type": "application/json"},
            )
            if response.status_code < 500:
                logger.info(
                    "Callback sent successfully (status=%d, attempt=%d).",
                    response.status_code,
                    attempt,
                )
                return
            logger.warning(
                "Callback returned %d on attempt %d.",
                response.status_code,
                attempt,
            )
        except requests.RequestException as exc:
            logger.warning("Callback attempt %d failed: %s", attempt, exc)

    logger.error(
        "Failed to send callback after %d attempts to %s.",
        max_retries,
        callback_url,
    )
