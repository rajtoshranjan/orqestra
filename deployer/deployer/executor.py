import json
import logging
import os
import shutil
import subprocess
import tempfile
import zipfile

logger = logging.getLogger(__name__)

PLUGIN_CACHE_DIR = "/tofu-deploy/plugin-cache"
WORKSPACE_PARENT_DIR = "/tofu-deploy/workspaces"


def execute_deployment(payload: dict) -> dict:
    """
    Execute an OpenTofu deployment.

    1. Write .tf.json to a temporary workspace.
    2. Write code bundles (Lambda zips, etc.) to the workspace.
    3. Restore existing state if provided.
    4. Run tofu init.
    5. Run tofu plan (capture output).
    6. Run tofu apply -auto-approve.
    7. Read the resulting terraform.tfstate.
    8. Return structured results.
    """
    # Enable persistent plugin caching to avoid re-downloading providers.
    os.makedirs(PLUGIN_CACHE_DIR, exist_ok=True)
    os.makedirs(WORKSPACE_PARENT_DIR, exist_ok=True)

    project_id = payload.get("project_id")
    if project_id:
        workspace = os.path.join(WORKSPACE_PARENT_DIR, f"project-{project_id}")
        os.makedirs(workspace, exist_ok=True)
    else:
        workspace = tempfile.mkdtemp(
            prefix="orqestra-deploy-", dir=WORKSPACE_PARENT_DIR
        )
    logs = []

    try:
        aws_env = _build_aws_env(payload.get("aws_credentials", {}))

        # Write the OpenTofu configuration.
        tofu_config = payload.get("tofu_config", {})
        config_path = os.path.join(workspace, "main.tf.json")
        with open(config_path, "w") as config_file:
            json.dump(tofu_config, config_file, indent=2)
        logs.append(_log("info", "Wrote OpenTofu configuration."))

        # Write code bundles.
        bundles = payload.get("code_bundles", {})
        if bundles:
            bundles_dir = os.path.join(workspace, "bundles")
            os.makedirs(bundles_dir, exist_ok=True)
            for logical_name, bundle_data in bundles.items():
                _create_code_bundle(bundles_dir, logical_name, bundle_data)
            logs.append(_log("info", f"Created {len(bundles)} code bundle(s)."))

        # Restore existing state.
        existing_state = payload.get("existing_state")
        if existing_state:
            state_path = os.path.join(workspace, "terraform.tfstate")
            with open(state_path, "w") as state_file:
                json.dump(existing_state, state_file, indent=2)
            logs.append(_log("info", "Restored existing state."))

        # Run tofu init.
        init_result = _run_tofu(["init", "-no-color"], workspace, env=aws_env)
        logger.info("tofu init stdout:\n%s", init_result.get("stdout"))
        logger.info("tofu init stderr:\n%s", init_result.get("stderr"))
        if init_result["code"] != 0:
            logs.append(_log("error", f"tofu init failed: {init_result['stderr']}"))
            return _failure_result(logs, init_result["stderr"])
        logs.append(_log("info", "OpenTofu initialized."))

        # Run tofu plan.
        plan_result = _run_tofu(
            ["plan", "-no-color", "-input=false", "-out=tfplan"], workspace, env=aws_env
        )
        plan_output = plan_result["stdout"]
        if plan_result["code"] != 0:
            logs.append(_log("error", f"tofu plan failed: {plan_result['stderr']}"))
            return _failure_result(logs, plan_result["stderr"], plan_output=plan_output)
        logs.append(_log("info", "Plan completed successfully."))

        # Run tofu apply.
        apply_result = _run_tofu(
            ["apply", "-no-color", "tfplan"],
            workspace,
            env=aws_env,
        )
        if apply_result["code"] != 0:
            logs.append(_log("error", f"tofu apply failed: {apply_result['stderr']}"))
            # Still try to read state — partial applies may have modified it.
            tofu_state = _read_state(workspace)
            return _failure_result(
                logs,
                apply_result["stderr"],
                plan_output=plan_output,
                tofu_state=tofu_state,
            )
        logs.append(_log("success", "Apply completed successfully."))

        # Read the final state.
        tofu_state = _read_state(workspace)

        return {
            "status": "succeeded",
            "logs": logs,
            "tofu_state": tofu_state,
            "plan_output": plan_output,
            "error_message": "",
            "outputs": _extract_outputs(tofu_state),
        }

    except Exception as exc:
        logger.exception("Deployment execution failed")
        logs.append(_log("error", f"Unexpected error: {exc}"))
        return _failure_result(logs, str(exc))

    finally:
        if not project_id:
            shutil.rmtree(workspace, ignore_errors=True)
        else:
            # Clean up config, plan, and state files so they are not left stale.
            # But leave .terraform/ and .terraform.lock.hcl to preserve cache/init status.
            for file_name in ["main.tf.json", "tfplan", "terraform.tfstate"]:
                file_path = os.path.join(workspace, file_name)
                if os.path.exists(file_path):
                    try:
                        os.remove(file_path)
                    except Exception:
                        pass
            bundles_dir = os.path.join(workspace, "bundles")
            if os.path.exists(bundles_dir):
                shutil.rmtree(bundles_dir, ignore_errors=True)


def _build_aws_env(credentials: dict) -> dict:
    """
    Build a subprocess environment for OpenTofu sourced entirely from the
    project's linked AWS account (passed in via `credentials`). Any AWS_*
    variables inherited from the container environment are stripped so
    deployments have no dependency on container-level configuration.
    """
    env = os.environ.copy()

    for key in list(env):
        if key.startswith("AWS_"):
            env.pop(key, None)

    # Always set the plugin cache dir so providers aren't re-downloaded.
    env["TF_PLUGIN_CACHE_DIR"] = PLUGIN_CACHE_DIR

    access_key_id = credentials.get("access_key_id", "") or ""
    secret_access_key = credentials.get("secret_access_key", "") or ""
    region = credentials.get("region", "us-east-1") or "us-east-1"
    endpoint_url = credentials.get("endpoint_url", "") or ""

    if access_key_id:
        env["AWS_ACCESS_KEY_ID"] = access_key_id
    if secret_access_key:
        env["AWS_SECRET_ACCESS_KEY"] = secret_access_key

    env["AWS_DEFAULT_REGION"] = region
    env["AWS_REGION"] = region

    if endpoint_url:
        env["AWS_ENDPOINT_URL"] = endpoint_url

    return env


def _run_tofu(
    args: list[str], workspace: str, timeout: int = 300, env: dict | None = None
) -> dict:
    """Run an OpenTofu command in the workspace directory."""
    cmd = ["tofu"] + args
    logger.info("Running: %s (cwd=%s)", " ".join(cmd), workspace)

    try:
        result = subprocess.run(
            cmd,
            cwd=workspace,
            capture_output=True,
            text=True,
            timeout=timeout,
            env=env,
        )
        return {
            "code": result.returncode,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
        }
    except FileNotFoundError:
        return {
            "code": -1,
            "stdout": "",
            "stderr": "OpenTofu (tofu) command not found. Ensure it is installed.",
        }
    except subprocess.TimeoutExpired:
        return {
            "code": -1,
            "stdout": "",
            "stderr": f"Command timed out after {timeout} seconds.",
        }


def _create_code_bundle(
    bundles_dir: str,
    logical_name: str,
    bundle_data: dict,
) -> None:
    """Create a ZIP bundle for a Lambda function's inline code."""
    runtime = bundle_data.get("runtime", "")
    code = bundle_data.get("code", "")

    if runtime.startswith("python"):
        entry_file = "lambda_function.py"
    else:
        entry_file = "index.js"

    bundle_temp_dir = tempfile.mkdtemp(prefix="bundle-")
    try:
        entry_path = os.path.join(bundle_temp_dir, entry_file)
        with open(entry_path, "w") as source_file:
            source_file.write(code)

        files_to_zip = [entry_file]

        # Add package.json for Node.js runtimes.
        if not runtime.startswith("python"):
            package_json_path = os.path.join(bundle_temp_dir, "package.json")
            with open(package_json_path, "w") as package_file:
                package_file.write('{\n  "type": "commonjs"\n}\n')
            files_to_zip.append("package.json")

        archive_path = os.path.join(bundles_dir, f"{logical_name}.zip")
        with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for file_name in files_to_zip:
                zip_file.write(os.path.join(bundle_temp_dir, file_name), file_name)
    finally:
        shutil.rmtree(bundle_temp_dir, ignore_errors=True)


def _read_state(workspace: str) -> dict | None:
    """Read the terraform.tfstate file from the workspace."""
    state_path = os.path.join(workspace, "terraform.tfstate")
    if not os.path.exists(state_path):
        return None
    with open(state_path) as state_file:
        return json.load(state_file)


def _extract_outputs(tofu_state: dict | None) -> dict:
    """Extract output values from the tofu state."""
    if not tofu_state:
        return {}
    outputs = tofu_state.get("outputs", {})
    return {key: value.get("value") for key, value in outputs.items()}


def _failure_result(
    logs: list,
    error_message: str,
    plan_output: str = "",
    tofu_state: dict | None = None,
) -> dict:
    """Build a failure result dict."""
    return {
        "status": "failed",
        "logs": logs,
        "tofu_state": tofu_state,
        "plan_output": plan_output,
        "error_message": error_message,
        "outputs": {},
    }


def _log(level: str, message: str) -> dict:
    """Create a structured log entry."""
    from datetime import datetime, timezone

    return {
        "level": level,
        "message": message,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
