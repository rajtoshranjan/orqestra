"""AWS Lambda entry point for the deployer."""

from deployer.callback import send_callback
from deployer.executor import execute_deployment


def lambda_handler(event, context):
    """
    AWS Lambda entry point.

    Expects the same payload structure as the /deploy HTTP endpoint.
    """
    callback_url = event.get("callback_url")
    results = execute_deployment(event)

    if callback_url:
        send_callback(callback_url, results)

    return results
