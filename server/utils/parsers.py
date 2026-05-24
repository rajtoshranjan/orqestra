from typing import List, Union


def unwrap_boolean(value: Union[int, str]) -> bool:
    """
    Convert various representations of boolean values to Python bool.

    Args:
        value: The value to convert to Python bool.

    Returns: The Python bool representation of the value.

    Raises:
        ValueError: If the value does not match any known boolean representation.
    """

    TRUE_VALUES = {"true", "True", "y", "yes", "1", 1, True}
    FALSE_VALUES = {"false", "False", "n", "no", "0", 0, False}

    if value in TRUE_VALUES:
        return True
    if value in FALSE_VALUES:
        return False

    raise ValueError(f"Cannot convert '{value}' to boolean.")


def unwrap_list(value: str) -> List[str]:
    """
    Convert a comma-separated string to a list of stripped strings.

    Args:
        value: The comma-separated string.

    Returns: A list of stripped, non-empty strings.
    """

    if not value:
        return []

    return [item.strip() for item in value.split(",") if item.strip()]
