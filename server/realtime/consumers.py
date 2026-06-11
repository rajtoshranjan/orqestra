import asyncio
import logging

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from deployments.models import Deployment
from django.contrib.auth import get_user_model
from organisations.models import Organisation, OrganisationMember
from projects.models import Project
from rest_framework_simplejwt.tokens import AccessToken

logger = logging.getLogger(__name__)
User = get_user_model()


@database_sync_to_async
def get_user_from_token(token_str):
    try:
        token = AccessToken(token_str)
        user_id = token["user_id"]
        return User.objects.get(id=user_id)
    except Exception as e:
        logger.warning(f"WebSocket auth failed: {str(e)}")
        return None


@database_sync_to_async
def verify_org_access(user, org_id):
    try:
        return (
            Organisation.objects.filter(id=org_id, owner=user).exists()
            or OrganisationMember.objects.filter(
                organisation_id=org_id, user=user
            ).exists()
        )
    except Exception as e:
        logger.error(f"Error verifying org access: {e}")
        return False


@database_sync_to_async
def verify_project_access(user, project_id):
    try:
        project = Project.objects.select_related("organisation").get(id=project_id)
        org = project.organisation
        return (
            org.owner == user
            or OrganisationMember.objects.filter(organisation=org, user=user).exists()
        )
    except Exception as e:
        logger.error(f"Error verifying project access: {e}")
        return False


@database_sync_to_async
def verify_deployment_access(user, deployment_id):
    try:
        deployment = Deployment.objects.select_related("project__organisation").get(
            id=deployment_id
        )
        org = deployment.project.organisation
        return (
            org.owner == user
            or OrganisationMember.objects.filter(organisation=org, user=user).exists()
        )
    except Exception as e:
        logger.error(f"Error verifying deployment access: {e}")
        return False


class OrqestraConsumer(AsyncJsonWebsocketConsumer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.authenticated = False
        self.user = None
        self.auth_timeout_task = None
        self.joined_groups = set()
        self.timing_out = False

    async def connect(self):
        # Always accept the connection first, then wait for authentication
        await self.accept()
        # Start a 5-second timer for authentication
        self.auth_timeout_task = asyncio.create_task(self.auth_timeout_check())

    async def auth_timeout_check(self):
        try:
            await asyncio.sleep(5)
            if not self.authenticated:
                self.timing_out = True
                logger.warning("WebSocket authentication timeout. Closing connection.")
                await self.send_json(
                    {"type": "error", "message": "Authentication timeout"}
                )
                await self.close(code=4001)
        except asyncio.CancelledError:
            pass

    async def disconnect(self, close_code):
        # Cancel the timeout task if it's still running and we didn't time out
        if (
            self.auth_timeout_task
            and not self.timing_out
            and not self.auth_timeout_task.done()
        ):
            self.auth_timeout_task.cancel()

        # Clean up and discard all groups
        for group_name in list(self.joined_groups):
            try:
                await self.channel_layer.group_discard(group_name, self.channel_name)
            except Exception as e:
                logger.error(f"Error leaving group {group_name} on disconnect: {e}")
        self.joined_groups.clear()

    async def receive_json(self, content, **kwargs):
        action = content.get("action")

        if not self.authenticated:
            if action == "authenticate":
                token = content.get("token")
                if not token:
                    await self.send_json(
                        {"type": "error", "message": "Token is required"}
                    )
                    await self.close(code=4001)
                    return

                user = await get_user_from_token(token)
                if user:
                    self.authenticated = True
                    self.user = user
                    if self.auth_timeout_task:
                        self.auth_timeout_task.cancel()
                    await self.send_json({"type": "authenticated"})
                else:
                    await self.send_json(
                        {"type": "error", "message": "Invalid or expired token"}
                    )
                    await self.close(code=4001)
            else:
                # Reject any other message if not authenticated
                await self.send_json(
                    {"type": "error", "message": "Authentication required"}
                )
                await self.close(code=4001)
            return

        # Authenticated message handling
        if action == "subscribe":
            group_type = content.get("group")
            group_id = content.get("id")

            if not group_type or not group_id:
                await self.send_json(
                    {
                        "type": "error",
                        "message": "group and id are required for subscription",
                    }
                )
                return

            if group_type not in ["org", "project", "deployment"]:
                await self.send_json(
                    {
                        "type": "error",
                        "message": f"Invalid subscription group: {group_type}",
                    }
                )
                return

            # Perform permission checks
            is_authorized = False
            if group_type == "org":
                is_authorized = await verify_org_access(self.user, group_id)
            elif group_type == "project":
                is_authorized = await verify_project_access(self.user, group_id)
            elif group_type == "deployment":
                is_authorized = await verify_deployment_access(self.user, group_id)

            if is_authorized:
                group_name = f"{group_type}_{group_id}"
                await self.channel_layer.group_add(group_name, self.channel_name)
                self.joined_groups.add(group_name)
                logger.info(f"User {self.user.email} subscribed to {group_name}")
                await self.send_json(
                    {"type": "subscribed", "group": group_type, "id": group_id}
                )
            else:
                logger.warning(
                    f"Unauthorized subscription attempt by {self.user.email} to {group_type}:{group_id}"
                )
                await self.send_json({"type": "error", "message": "Permission denied"})

        elif action == "unsubscribe":
            group_type = content.get("group")
            group_id = content.get("id")

            if not group_type or not group_id:
                await self.send_json(
                    {
                        "type": "error",
                        "message": "group and id are required for unsubscription",
                    }
                )
                return

            group_name = f"{group_type}_{group_id}"
            if group_name in self.joined_groups:
                await self.channel_layer.group_discard(group_name, self.channel_name)
                self.joined_groups.remove(group_name)
                await self.send_json(
                    {"type": "unsubscribed", "group": group_type, "id": group_id}
                )
            else:
                await self.send_json(
                    {"type": "error", "message": "Not subscribed to this group"}
                )

        else:
            await self.send_json(
                {"type": "error", "message": f"Unknown action: {action}"}
            )

    async def broadcast_event(self, event):
        """
        Receives an event sent via channel layer group_send and forwards it to the WebSocket.
        Expected format of event sent to group:
        {
            "type": "broadcast_event",
            "event_type": "<e.g. deployment.status_changed>",
            "payload": {...}
        }
        """
        logger.info(
            f"Consumer sending broadcast_event to user {self.user.email if self.user else 'anonymous'}: {event}"
        )
        if self.authenticated:
            event_type = event.get("event_type")
            payload = event.get("payload") or {}

            # Filter notification events by recipient user ID if present in payload
            if event_type == "notification.created" and "recipient_id" in payload:
                recipient_id = payload["recipient_id"]
                if recipient_id and str(recipient_id) != str(self.user.id):
                    logger.debug(
                        f"Filtering out notification event for recipient {recipient_id} from user {self.user.id}"
                    )
                    return

            await self.send_json({"type": event_type, "payload": payload})
