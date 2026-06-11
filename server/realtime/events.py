import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)


def emit_event(group_name, event_type, payload):
    """
    Sends an event to a channel layer group.
    """
    try:
        channel_layer = get_channel_layer()
        if channel_layer is not None:
            async_to_sync(channel_layer.group_send)(
                group_name,
                {
                    "type": "broadcast_event",
                    "event_type": event_type,
                    "payload": payload,
                },
            )
        else:
            logger.warning("Channel layer not configured. Event not sent.")
    except Exception as e:
        logger.error(f"Failed to send event to channel layer: {e}")


def send_deployment_event(deployment_id, event_type, payload):
    """
    Emits an event for a specific deployment.
    """
    group_name = f"deployment_{deployment_id}"
    full_event_type = f"deployment.{event_type}"
    emit_event(group_name, full_event_type, payload)


def send_annotation_event(project_id, event_type, payload):
    """
    Emits an event for a specific project's annotations.
    """
    group_name = f"project_{project_id}"
    full_event_type = f"annotation.{event_type}"
    emit_event(group_name, full_event_type, payload)


def send_notification_event(org_id, event_type, payload):
    """
    Emits an event for a specific organization's notifications.
    """
    group_name = f"org_{org_id}"
    full_event_type = f"notification.{event_type}"
    emit_event(group_name, full_event_type, payload)
