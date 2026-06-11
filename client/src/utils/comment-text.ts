const MENTION_TOKEN_PATTERN = /@\[([^\]]+)\]\(user:([0-9a-fA-F-]{36})\)/g;

/** Strips formatting tokens for plain-text previews (sidebars, notifications). */
export const commentBodyToPlainText = (body: string): string =>
  body
    .replace(MENTION_TOKEN_PATTERN, '@$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1');

export const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
