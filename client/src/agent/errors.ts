/** Pull the first human-readable string out of a DRF error body. */
function firstFieldError(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstFieldError(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const found = firstFieldError(item);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Turn an unknown thrown value (usually an Axios error) into a message worth
 * showing the user, preferring the server's detail over generic axios noise
 * like "[object Object]" or "Request failed with status code 500".
 */
export function describeAgentError(error: unknown): string {
  if (typeof error === 'string') return error;

  const anyError = error as {
    response?: { data?: Record<string, unknown> };
    message?: string;
  };
  const data = anyError?.response?.data;
  if (data) {
    const meta = data.meta as { message?: string } | undefined;
    const fromBody =
      meta?.message ||
      (typeof data.detail === 'string' ? data.detail : null) ||
      firstFieldError(data.errors) ||
      firstFieldError(data);
    if (fromBody) return fromBody;
  }

  if (anyError?.message) return anyError.message;
  return 'Something went wrong. Please try again.';
}
