from .constants import RiskLevel

# Operations whose blast radius always warrants a human confirm, regardless of
# the specific resource. Fine-grained cost/security risk is layered on the
# client at apply time.
CONFIRM_OPERATIONS = {"remove"}


def classify_operation_risk(operation_name: str, operation_input: dict) -> RiskLevel:
    if operation_name in CONFIRM_OPERATIONS:
        return RiskLevel.CONFIRM
    return RiskLevel.SAFE
