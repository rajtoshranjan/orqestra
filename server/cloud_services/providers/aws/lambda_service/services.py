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
