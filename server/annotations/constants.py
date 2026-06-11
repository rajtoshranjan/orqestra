import re
from enum import Enum


class AnnotationTargetType(Enum):
    CANVAS = "canvas"
    NODE = "node"
    EDGE = "edge"
    DEPLOYMENT = "deployment"

    @classmethod
    def choices(cls):
        return [(key.value, key.name) for key in cls]


class AnnotationStatus(Enum):
    OPEN = "open"
    RESOLVED = "resolved"

    @classmethod
    def choices(cls):
        return [(key.value, key.name) for key in cls]


class AuthorType(Enum):
    USER = "user"
    # Reserved for future non-human authors (validation/security/cost engines, AI reviews).
    SYSTEM = "system"
    AGENT = "agent"

    @classmethod
    def choices(cls):
        return [(key.value, key.name) for key in cls]


class AnnotationEventType(Enum):
    CREATED = "created"
    RESOLVED = "resolved"
    REOPENED = "reopened"
    ARCHIVED = "archived"
    UNARCHIVED = "unarchived"
    MOVED = "moved"
    COMMENT_ADDED = "comment_added"
    COMMENT_DELETED = "comment_deleted"

    @classmethod
    def choices(cls):
        return [(key.value, key.name) for key in cls]


class NotificationVerb(Enum):
    MENTIONED = "mentioned"
    REPLIED = "replied"
    RESOLVED = "resolved"

    @classmethod
    def choices(cls):
        return [(key.value, key.name) for key in cls]


ALLOWED_REACTION_EMOJIS = ["👍", "👎", "❤️", "🎉", "👀", "🚀", "😄", "🤔"]

# Mention tokens are stored inline in comment bodies as: @[Display Name](user:<uuid>)
MENTION_TOKEN_RE = re.compile(r"@\[([^\]]+)\]\(user:([0-9a-fA-F-]{36})\)")

MAX_COMMENT_LENGTH = 5000
