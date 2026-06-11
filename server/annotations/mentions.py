from django.contrib.auth import get_user_model
from django.db.models import Q

from .constants import MENTION_TOKEN_RE, NotificationVerb
from .models import Mention, Notification


def extract_mention_user_ids(body):
    """Extract the set of user ids referenced by @[Name](user:<uuid>) tokens."""
    return {match.group(2).lower() for match in MENTION_TOKEN_RE.finditer(body)}


def sync_mentions(comment, organisation, actor):
    """
    Reconcile Mention rows with the tokens in the comment body and notify
    newly mentioned users. Mentions of users outside the organisation are
    silently dropped so bodies cannot leak cross-org user references.
    """
    user_model = get_user_model()
    mentioned_ids = extract_mention_user_ids(comment.body)

    mentioned_users = user_model.objects.filter(id__in=mentioned_ids).filter(
        Q(owned_organisations=organisation)
        | Q(organisation_memberships__organisation=organisation)
    ).distinct()

    existing_user_ids = set(
        comment.mentions.values_list("user_id", flat=True)
    )
    next_user_ids = {user.id for user in mentioned_users}

    stale_user_ids = existing_user_ids - next_user_ids
    if stale_user_ids:
        comment.mentions.filter(user_id__in=stale_user_ids).delete()

    new_users = [user for user in mentioned_users if user.id not in existing_user_ids]
    Mention.objects.bulk_create(
        [Mention(comment=comment, user=user) for user in new_users]
    )

    notifications = [
        Notification(
            recipient=user,
            actor=actor,
            organisation=organisation,
            verb=NotificationVerb.MENTIONED.value,
            annotation=comment.annotation,
            comment=comment,
        )
        for user in new_users
        if user != actor
    ]
    Notification.objects.bulk_create(notifications)

    return next_user_ids
