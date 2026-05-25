import json
import logging
import os
import shutil
import subprocess
import tempfile
import zipfile
from orqestra.env_variables import EnvVariable

logger = logging.getLogger(__name__)


def ensure_command(name):
    """
    Verify that a required CLI tool is available on the system PATH.

    Raises:
        FileNotFoundError: If the command is not found.
    """
    if shutil.which(name) is None:
        raise FileNotFoundError(
            f'Required command "{name}" was not found. Install it and try again.'
        )


def run_command(cmd, cwd=None, timeout=300):
    """
    Run a shell command and return a dict with code, stdout, stderr.
    """
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        return {
            "code": result.returncode,
            "stdout": result.stdout.strip(),
            "stderr": result.stderr.strip(),
            "error": "",
        }
    except subprocess.TimeoutExpired:
        return {
            "code": -1,
            "stdout": "",
            "stderr": "Command timed out.",
            "error": "Command timed out.",
        }


def run_aws_command(*args):
    """
    Run an AWS CLI command and return the result.

    Raises:
        RuntimeError: If the command fails.
    """
    endpoint_url = EnvVariable.AWS_ENDPOINT_URL.value.strip()
    cmd = ["aws"]
    if endpoint_url:
        cmd.extend(["--endpoint-url", endpoint_url])
    cmd.extend(list(args))

    result = run_command(cmd)
    if result["code"] != 0:
        error_msg = result["stderr"] or result["stdout"] or "AWS CLI command failed."
        raise RuntimeError(error_msg)
    return result


def normalize_environment_variables(entries):
    """
    Normalize environment variable entries, filtering out empty keys.
    """
    values = {}
    for entry in entries:
        key = entry.get("key", "").strip()
        if key:
            values[key] = entry.get("value", "")
    return values


def create_lambda_bundle(config):
    """
    Create a ZIP deployment package from Lambda inline code.

    Returns:
        tuple: (archive_path, temp_dir) — caller must clean up temp_dir.
    """
    temp_dir = tempfile.mkdtemp(prefix="orqestra-")

    try:
        runtime = config.get("runtime", "")
        if runtime.startswith("python"):
            entry_file = "lambda_function.py"
        else:
            entry_file = "index.js"

        # Write the entry file.
        entry_path = os.path.join(temp_dir, entry_file)
        with open(entry_path, "w") as f:
            f.write(config.get("code", ""))

        files_to_zip = [entry_file]

        # Add package.json for Node.js runtimes.
        if not runtime.startswith("python"):
            package_json_path = os.path.join(temp_dir, "package.json")
            with open(package_json_path, "w") as f:
                f.write('{\n  "type": "commonjs"\n}\n')
            files_to_zip.append("package.json")

        # Create the ZIP archive.
        archive_path = os.path.join(temp_dir, "function.zip")
        with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for file_name in files_to_zip:
                zf.write(os.path.join(temp_dir, file_name), file_name)

        return archive_path, temp_dir

    except Exception:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise


def deploy_lambda(node, settings, logs):
    """
    Deploy a single Lambda function (create or update).

    Args:
        node: Validated diagram node dict.
        settings: Deployment settings dict (region, execution_role_arn).
        logs: List to append deployment log dicts to.

    Raises:
        RuntimeError: If the deployment fails.
    """
    config = node["data"]["config"]
    function_name = config["function_name"]

    region = _first_non_empty(
        settings.get("region", ""),
        os.environ.get("AWS_REGION", ""),
        os.environ.get("AWS_DEFAULT_REGION", ""),
        "us-east-1",
    )

    role_arn = _first_non_empty(
        settings.get("execution_role_arn", ""),
        os.environ.get("AWS_LAMBDA_EXECUTION_ROLE_ARN", ""),
    )

    env_vars = normalize_environment_variables(config.get("environment_variables", []))
    environment_payload = json.dumps({"Variables": env_vars})

    # Create the deployment bundle.
    archive_path, temp_dir = create_lambda_bundle(config)

    try:
        # Check if the function already exists.
        exists_cmd = [
            "aws",
            "lambda",
            "get-function",
            "--function-name",
            function_name,
            "--region",
            region,
            "--output",
            "json",
        ]
        endpoint_url = EnvVariable.AWS_ENDPOINT_URL.value.strip()
        if endpoint_url:
            exists_cmd.insert(1, "--endpoint-url")
            exists_cmd.insert(2, endpoint_url)

        exists_result = run_command(exists_cmd)

        if exists_result["code"] == 0:
            # Update existing function.
            logs.append(
                {
                    "level": "info",
                    "message": f"Updating Lambda {function_name} in {region}.",
                }
            )

            run_aws_command(
                "lambda",
                "update-function-code",
                "--function-name",
                function_name,
                "--zip-file",
                f"fileb://{archive_path}",
                "--region",
                region,
            )

            update_args = [
                "lambda",
                "update-function-configuration",
                "--function-name",
                function_name,
                "--runtime",
                config["runtime"],
                "--handler",
                config["handler"],
                "--memory-size",
                str(config["memory_size"]),
                "--timeout",
                str(config["timeout"]),
                "--environment",
                environment_payload,
                "--region",
                region,
            ]
            description = config.get("description", "").strip()
            if description:
                update_args.extend(["--description", description])

            run_aws_command(*update_args)

            logs.append(
                {
                    "level": "success",
                    "message": f"Updated Lambda {function_name}.",
                }
            )
            return

        # Check if it was a genuine "not found" vs some other error.
        if "resourcenotfoundexception" not in exists_result["stderr"].lower():
            error_detail = exists_result["stderr"] or exists_result["stdout"]
            raise RuntimeError(
                f"Unable to determine whether Lambda {function_name} already exists: "
                f"{error_detail}"
            )

        # Create new function.
        if not role_arn.strip():
            raise RuntimeError(
                "An execution role ARN is required to create a new Lambda. "
                "Set it in the UI or export AWS_LAMBDA_EXECUTION_ROLE_ARN on the server."
            )

        logs.append(
            {
                "level": "info",
                "message": f"Creating Lambda {function_name} in {region}.",
            }
        )

        create_args = [
            "lambda",
            "create-function",
            "--function-name",
            function_name,
            "--runtime",
            config["runtime"],
            "--handler",
            config["handler"],
            "--role",
            role_arn,
            "--zip-file",
            f"fileb://{archive_path}",
            "--memory-size",
            str(config["memory_size"]),
            "--timeout",
            str(config["timeout"]),
            "--environment",
            environment_payload,
            "--region",
            region,
        ]
        description = config.get("description", "").strip()
        if description:
            create_args.extend(["--description", description])

        run_aws_command(*create_args)

        logs.append(
            {
                "level": "success",
                "message": f"Created Lambda {function_name}.",
            }
        )

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def _first_non_empty(*values):
    """Return the first non-empty stripped string from the arguments."""
    for value in values:
        if value and value.strip():
            return value.strip()
    return ""
