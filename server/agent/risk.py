from .constants import RiskLevel

# Operations whose blast radius always warrants a human confirm, regardless of
# the specific resource. Fine-grained cost/security risk is layered on the
# client at apply time.
CONFIRM_OPS = {"remove"}


def classify_op_risk(op_name: str, op_input: dict) -> RiskLevel:
    if op_name in CONFIRM_OPS:
        return RiskLevel.CONFIRM
    return RiskLevel.SAFE
