import logging
import threading

from flask import Flask, jsonify, request

from deployer import DEPLOYER_PORT
from deployer.callback import send_callback
from deployer.executor import execute_deployment

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s %(asctime)s %(module)s %(message)s",
)
logger = logging.getLogger(__name__)

app = Flask(__name__)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True})


@app.route("/deploy", methods=["POST"])
def deploy():
    """
    Accept a deployment request, run it in a background thread,
    and return 202 Accepted immediately.
    """
    payload = request.get_json()
    if not payload:
        return jsonify({"error": "Request body must be valid JSON."}), 400

    deployment_id = payload.get("deployment_id", "unknown")
    callback_url = payload.get("callback_url")

    if not callback_url:
        return jsonify({"error": "callback_url is required."}), 400

    logger.info("Received deployment request: %s", deployment_id)

    # Run the deployment in a background thread so we return immediately.
    thread = threading.Thread(
        target=_run_deployment,
        args=(payload, callback_url),
        daemon=True,
    )
    thread.start()

    return jsonify({"accepted": True, "deployment_id": deployment_id}), 202


def _run_deployment(payload: dict, callback_url: str) -> None:
    """Execute the deployment and send results via callback."""
    deployment_id = payload.get("deployment_id", "unknown")
    logger.info("Starting deployment execution: %s", deployment_id)

    results = execute_deployment(payload)

    logger.info(
        "Deployment %s finished with status: %s",
        deployment_id,
        results.get("status"),
    )

    send_callback(callback_url, results)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=DEPLOYER_PORT, debug=False)
