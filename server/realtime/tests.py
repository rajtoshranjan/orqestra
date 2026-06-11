import asyncio

from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase, override_settings
from organisations.models import Organisation
from orqestra.asgi import application
from realtime.events import emit_event
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()


@override_settings(
    CHANNEL_LAYERS={
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        }
    }
)
class WebSocketConsumerTests(TransactionTestCase):
    """
    Integration tests for the WebSocket consumer, including authentication,
    subscription, permissions, and event broadcasting.
    """

    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user(
            email="testuser@example.com",
            password="TestPassword123!",
            name="Test User",
        )
        self.organisation = Organisation.objects.create(
            name="Test Organisation",
            owner=self.user,
        )

    async def test_auth_success(self):
        # Generate token for the test user
        token = await database_sync_to_async(
            lambda: str(AccessToken.for_user(self.user))
        )()

        # Connect to the communicator
        communicator = WebsocketCommunicator(application, "ws/")
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Authenticate
        await communicator.send_json_to({"action": "authenticate", "token": token})
        response = await communicator.receive_json_from()
        self.assertEqual(response["type"], "authenticated")

        await communicator.disconnect()

    async def test_auth_failure(self):
        communicator = WebsocketCommunicator(application, "ws/")
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Send invalid token
        await communicator.send_json_to(
            {"action": "authenticate", "token": "invalid-token"}
        )
        response = await communicator.receive_json_from()
        self.assertEqual(response["type"], "error")
        self.assertIn("Invalid or expired token", response["message"])

        # Expect socket to close
        await communicator.disconnect()

    async def test_auth_timeout(self):
        communicator = WebsocketCommunicator(application, "ws/")
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Don't authenticate, wait 5.5 seconds (timeout is 5 seconds)
        await asyncio.sleep(5.5)

        # Expect connection to close
        response = await communicator.receive_json_from()
        self.assertEqual(response["type"], "error")
        self.assertEqual(response["message"], "Authentication timeout")

        close_event = await communicator.receive_output()
        self.assertEqual(close_event["type"], "websocket.close")
        self.assertEqual(close_event["code"], 4001)

    async def test_subscription_and_broadcast(self):
        token = await database_sync_to_async(
            lambda: str(AccessToken.for_user(self.user))
        )()
        org_id = str(self.organisation.id)

        # Connect and authenticate
        communicator = WebsocketCommunicator(application, "ws/")
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.send_json_to({"action": "authenticate", "token": token})
        await communicator.receive_json_from()

        # Subscribe to organization channel
        await communicator.send_json_to(
            {"action": "subscribe", "group": "org", "id": org_id}
        )
        sub_response = await communicator.receive_json_from()
        self.assertEqual(sub_response["type"], "subscribed")
        self.assertEqual(sub_response["group"], "org")
        self.assertEqual(sub_response["id"], org_id)

        # Emit an event to the organization group
        payload = {"alert": "Test Notification"}
        await database_sync_to_async(
            lambda: emit_event(f"org_{org_id}", "notification.created", payload)
        )()

        # Expect the event to be received by the client
        event_response = await communicator.receive_json_from()
        self.assertEqual(event_response["type"], "notification.created")
        self.assertEqual(event_response["payload"], payload)

        await communicator.disconnect()

    async def test_subscription_unauthorized(self):
        token = await database_sync_to_async(
            lambda: str(AccessToken.for_user(self.user))
        )()

        # Create another organization owned by a different user
        other_user = await database_sync_to_async(
            lambda: User.objects.create_user(
                email="other@example.com",
                password="OtherPassword123!",
                name="Other User",
            )
        )()
        other_org = await database_sync_to_async(
            lambda: Organisation.objects.create(
                name="Other Org",
                owner=other_user,
            )
        )()
        other_org_id = str(other_org.id)

        # Connect and authenticate
        communicator = WebsocketCommunicator(application, "ws/")
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        await communicator.send_json_to({"action": "authenticate", "token": token})
        await communicator.receive_json_from()

        # Attempt to subscribe to the other organization channel
        await communicator.send_json_to(
            {"action": "subscribe", "group": "org", "id": other_org_id}
        )
        response = await communicator.receive_json_from()
        self.assertEqual(response["type"], "error")
        self.assertIn("Permission denied", response["message"])

        await communicator.disconnect()
