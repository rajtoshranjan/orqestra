const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Whether an organisation invite can be submitted: a syntactically valid email
 * and a selected role are both required.
 */
export function canSubmitInvite({
  email,
  role,
}: {
  email: string;
  role: string;
}): boolean {
  return EMAIL_RE.test(email.trim()) && role.trim().length > 0;
}
