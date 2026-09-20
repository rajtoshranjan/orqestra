from unittest import mock

import httpx
from accounts.models import User
from agent.tests.http_fakes import CatalogResponse, json_response, openai_text_response
from django.urls import reverse
from orqestra.tests import BaseTestCase
from utils.encryption import decrypt_val, encrypt_val

from .constants import OrganisationMemberRole
from .models import AuditLog, LLMConfig, Organisation, OrganisationMember


class LLMSetupTestBase(BaseTestCase):
    def setUp(self):
        super().setUp()
        self.source = LLMConfig.objects.create(
            organisation=self.organisation, name="Existing", provider="openai",
            model="gpt-4o", api_key=encrypt_val("sk-stored-secret"),
        )
        request_patch = mock.patch("httpx.AsyncClient.stream")
        self.request = request_patch.start()
        self.addCleanup(request_patch.stop)
        self.request.return_value = CatalogResponse({"data": [{"id": "gpt-4o"}]})
        post_patch = mock.patch("requests.post")
        self.post = post_patch.start()
        self.addCleanup(post_patch.stop)
        self.post.return_value = openai_text_response()

    def send(self, operation, data):
        data = dict(data)
        if operation == "update":
            return self.client.patch(
                reverse("organisation-llm-config-detail", args=[self.source.id]),
                data, format="json",
            )
        if operation == "create":
            data.setdefault("name", "Another model")
            data.setdefault("model", "gpt-4o-mini")
            route = "organisation-llm-config-list"
        else:
            if operation == "test":
                data.setdefault("model", "gpt-4o")
            route = f"organisation-llm-config-{operation}"
        return self.client.post(reverse(route), data, format="json")

    def foreign_config(self):
        owner = User.objects.create_user(
            email="foreign@example.com", password="TestPassword123!", name="Other",
        )
        organisation = Organisation.objects.create(name="Other", owner=owner)
        return LLMConfig.objects.create(
            organisation=organisation, name="Other", provider="openai",
            model="gpt-4o", api_key=encrypt_val("foreign-secret"),
        )

    def assert_no_key(self, response):
        content = response.content.decode()
        self.assertNotIn("sk-stored-secret", content)
        self.assertNotIn(self.source.api_key, content)
        self.assertNotIn('"api_key":', content)


class LLMSetupApiTests(LLMSetupTestBase):
    def test_models_needs_neither_name_nor_model_and_uses_standard_envelope(self):
        response = self.send("models", {"provider": "openai", "api_key": "new-key"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["data"], {
            "ok": True, "models": [{"id": "gpt-4o", "name": "gpt-4o"}],
        })
        self.assertEqual(LLMConfig.objects.count(), 1)
        self.assertNotIn("new-key", response.content.decode())

    def test_all_four_providers_are_discovered_through_registry(self):
        cases = [
            ("openai", {"data": [{"id": "gpt-4o"}]}, "gpt-4o"),
            ("anthropic", {"data": [{"id": "claude-sonnet-4-20250514"}]}, "claude-sonnet-4-20250514"),
            ("gemini", {"models": [{
                "name": "models/gemini-2.5-flash",
                "supportedGenerationMethods": ["generateContent"],
            }]}, "gemini-2.5-flash"),
            ("ollama", {"models": [{"name": "qwen3:8b"}]}, "qwen3:8b"),
        ]
        for provider, catalog, model_id in cases:
            with self.subTest(provider=provider):
                self.request.side_effect = [
                    CatalogResponse(catalog), CatalogResponse({"capabilities": ["tools"]}),
                ]
                response = self.send("models", {
                    "provider": provider, "api_key": "new-key",
                    "base_url": "https://ollama.com" if provider == "ollama" else "",
                })
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data["models"][0]["id"], model_id)

    def test_saved_key_can_discover_and_test_without_returning_it(self):
        for operation in ("models", "test"):
            with self.subTest(operation=operation):
                response = self.send(operation, {
                    "provider": "openai", "config": str(self.source.id), "api_key": "",
                })
                self.assertEqual(response.status_code, 200)
                self.assertTrue(response.data["ok"])
                self.assert_no_key(response)
        for request in (self.request, self.post):
            self.assertEqual(request.call_args.kwargs["headers"], {
                "Authorization": "Bearer sk-stored-secret",
            })

    def test_create_copies_ciphertext_without_returning_a_credential(self):
        response = self.send("create", {"provider": "openai", "config": str(self.source.id)})
        self.assertEqual(response.status_code, 201)
        created = LLMConfig.objects.get(pk=response.data["id"])
        self.assertEqual(created.api_key, self.source.api_key)
        self.assertEqual(created.organisation, self.organisation)
        self.assertEqual(decrypt_val(created.api_key), "sk-stored-secret")
        self.assertTrue(response.data["has_api_key"])
        self.assertNotIn("config", response.data)
        self.assert_no_key(response)
        self.assertNotIn("sk-stored-secret", str(list(AuditLog.objects.values_list("details", flat=True))))
        self.request.assert_not_called()
        self.post.assert_not_called()

    def test_omitted_ollama_endpoint_inherits_saved_destination(self):
        self.source.provider = "ollama"
        self.source.base_url = "https://ollama.com"
        self.source.save()
        self.request.side_effect = [
            CatalogResponse({"models": [{"name": "custom:latest"}]}),
            CatalogResponse({"capabilities": ["tools"]}),
        ]
        response = self.send("models", {"provider": "ollama", "config": str(self.source.id)})
        self.assertTrue(response.data["ok"])
        self.assertEqual(self.request.call_args_list[0].args[1], "https://ollama.com/api/tags")
        self.assertEqual(self.request.call_args.kwargs["headers"]["Authorization"], "Bearer sk-stored-secret")

    def test_equivalent_normalized_endpoint_can_reuse_key_for_all_flows(self):
        self.source.provider = "ollama"
        self.source.base_url = "https://ollama.com/"
        self.source.save()
        self.request.return_value = CatalogResponse({"models": []})
        self.post.return_value = json_response({"message": {"content": "ok"}, "done": True})
        for operation in ("models", "test", "create", "update"):
            data = {"provider": "ollama", "base_url": "HTTPS://OLLAMA.COM:443/"}
            if operation != "update":
                data["config"] = str(self.source.id)
            with self.subTest(operation=operation):
                response = self.send(operation, data)
                self.assertIn(response.status_code, (200, 201))
        self.source.refresh_from_db()
        self.assertEqual(self.source.base_url, "https://ollama.com")
        self.assertEqual(decrypt_val(self.source.api_key), "sk-stored-secret")

    def test_blank_key_update_preserves_key_and_model_changes_are_safe(self):
        response = self.send("update", {"model": "gpt-4o-mini", "api_key": ""})
        self.assertEqual(response.status_code, 200)
        self.source.refresh_from_db()
        self.assertEqual(decrypt_val(self.source.api_key), "sk-stored-secret")
        self.assertEqual(self.source.model, "gpt-4o-mini")

    def test_explicit_key_allows_provider_change_without_forwarding_stored_key(self):
        self.request.return_value = CatalogResponse({"models": []})
        self.post.return_value = json_response({"message": {"content": "ok"}, "done": True})
        for operation in ("models", "test", "create", "update"):
            data = {"provider": "ollama", "base_url": "https://new.example", "api_key": "explicit-new-key"}
            if operation != "update":
                data["config"] = str(self.source.id)
            with self.subTest(operation=operation):
                response = self.send(operation, data)
                self.assertIn(response.status_code, (200, 201))
                self.assertNotIn("explicit-new-key", response.content.decode())
        self.source.refresh_from_db()
        self.assertEqual(decrypt_val(self.source.api_key), "explicit-new-key")
        for request in (self.request, self.post):
            self.assertEqual(request.call_args.kwargs["headers"]["Authorization"], "Bearer explicit-new-key")

    def test_explicit_key_allows_same_provider_endpoint_change(self):
        self.source.provider = "ollama"
        self.source.base_url = "https://old.example"
        self.source.save()
        response = self.send("update", {
            "base_url": "https://new.example", "api_key": "new-destination-key",
        })
        self.assertEqual(response.status_code, 200)
        self.source.refresh_from_db()
        self.assertEqual(self.source.base_url, "https://new.example")
        self.assertEqual(decrypt_val(self.source.api_key), "new-destination-key")

    def test_errors_never_include_keys_or_raw_provider_messages(self):
        for status_code in (401, 403, 429, 500, 302):
            self.request.return_value = CatalogResponse({"error": "sk-stored-secret"}, status_code)
            self.post.return_value = json_response({"error": "sk-stored-secret"}, status_code)
            for operation in ("models", "test"):
                with self.subTest(status=status_code, operation=operation):
                    response = self.send(operation, {"provider": "openai", "config": str(self.source.id)})
                    self.assertEqual(response.status_code, 200)
                    self.assertFalse(response.data["ok"])
                    self.assertIsInstance(response.data["error"], str)
                    self.assert_no_key(response)

    def test_transport_and_decryption_errors_are_safe(self):
        self.request.side_effect = httpx.ConnectError("sk-stored-secret")
        response = self.send("models", {"provider": "openai", "config": str(self.source.id)})
        self.assertFalse(response.data["ok"])
        self.assertIn("server container", response.data["error"])
        self.assert_no_key(response)
        self.source.api_key = "invalid-ciphertext"
        self.source.save()
        response = self.send("models", {"provider": "openai", "config": str(self.source.id)})
        self.assertFalse(response.data["ok"])
        self.assertNotIn("invalid-ciphertext", response.content.decode())

    def test_custom_catalog_cannot_reflect_a_key_in_model_names(self):
        self.request.return_value = CatalogResponse({"data": [{
            "id": "claude-sonnet-4", "display_name": "sk-stored-secret",
        }]})
        response = self.send("models", {"provider": "anthropic", "api_key": "sk-stored-secret"})
        self.assertFalse(response.data["ok"])
        self.assert_no_key(response)


class LLMSetupCredentialProtectionTests(LLMSetupTestBase):
    def test_provider_change_requires_explicit_nonblank_key_in_every_flow(self):
        for operation in ("models", "test", "create", "update"):
            for key in (None, "", "   "):
                data = {"provider": "ollama", "base_url": "https://attacker.example"}
                if operation != "update":
                    data["config"] = str(self.source.id)
                if key is not None:
                    data["api_key"] = key
                with self.subTest(operation=operation, key=key):
                    response = self.send(operation, data)
                    self.assertEqual(response.status_code, 400)
                    self.assertIn("api_key", response.data)
                    self.assertIn("new API key", str(response.data))
                    self.assertNotIn("sk-stored-secret", response.content.decode())
        self.request.assert_not_called()
        self.post.assert_not_called()
        self.source.refresh_from_db()
        self.assertEqual(self.source.provider, "openai")
        self.assertEqual(decrypt_val(self.source.api_key), "sk-stored-secret")

    def test_same_provider_destination_change_cannot_reuse_stored_key(self):
        self.source.provider = "ollama"
        self.source.base_url = "https://models.example/prefix"
        self.source.save()
        for endpoint in (
            "https://attacker.example/prefix", "http://models.example/prefix",
            "https://models.example:8443/prefix", "https://models.example/different",
        ):
            for operation in ("models", "test", "create", "update"):
                data = {"provider": "ollama", "base_url": endpoint}
                if operation != "update":
                    data["config"] = str(self.source.id)
                with self.subTest(endpoint=endpoint, operation=operation):
                    self.assertEqual(self.send(operation, data).status_code, 400)
        self.request.assert_not_called()
        self.post.assert_not_called()

    def test_hosted_endpoint_overrides_rejected_even_with_explicit_key(self):
        for provider in ("openai", "anthropic", "gemini"):
            for operation in ("models", "test", "create", "update"):
                with self.subTest(provider=provider, operation=operation):
                    response = self.send(operation, {
                        "provider": provider, "base_url": "https://attacker.example",
                        "api_key": "explicit-new-key",
                    })
                    self.assertEqual(response.status_code, 400)
                    self.assertIn("base_url", response.data)
        self.request.assert_not_called()
        self.post.assert_not_called()

    def test_unsafe_endpoint_syntax_rejected_without_echoing_it(self):
        for endpoint in (
            "file:///tmp/secret", "ftp://host", "//host", "https://user:sk-stored-secret@host",
            "https://host?key=sk-stored-secret", "https://host#sk-stored-secret",
        ):
            for operation in ("models", "test", "create", "update"):
                with self.subTest(endpoint=endpoint, operation=operation):
                    response = self.send(operation, {
                        "provider": "ollama", "base_url": endpoint, "api_key": "explicit-new-key",
                    })
                    self.assertEqual(response.status_code, 400)
                    self.assertNotIn("sk-stored-secret", response.content.decode())
        self.request.assert_not_called()
        self.post.assert_not_called()

    def test_cross_org_sources_are_rejected_even_when_new_key_is_supplied(self):
        foreign = self.foreign_config()
        for operation in ("models", "test", "create"):
            for key in ("", "new-key"):
                with self.subTest(operation=operation, key=key):
                    response = self.send(operation, {
                        "provider": "openai", "config": str(foreign.id), "api_key": key,
                    })
                    self.assertEqual(response.status_code, 400)
                    self.assertNotIn("foreign-secret", response.content.decode())
        self.request.assert_not_called()
        self.post.assert_not_called()

    def test_update_does_not_accept_a_create_credential_source(self):
        response = self.send("update", {"config": str(self.source.id)})
        self.assertEqual(response.status_code, 400)
        self.assertIn("config", response.data)

    def test_missing_provider_or_credentials_and_invalid_source_are_validation_errors(self):
        for data in ({}, {"provider": "unknown"}, {"provider": "openai"}, {
            "provider": "openai", "config": "invalid-id",
        }):
            with self.subTest(data=data):
                self.assertEqual(self.send("models", data).status_code, 400)
        self.request.assert_not_called()

    def test_validation_accumulates_endpoint_and_key_errors(self):
        response = self.send("models", {
            "provider": "openai", "base_url": "https://attacker.example",
        })
        self.assertEqual(response.status_code, 400)
        self.assertIn("base_url", response.data)
        self.assertIn("api_key", response.data)

    def test_source_without_a_key_cannot_satisfy_hosted_key_requirement(self):
        self.source.api_key = ""
        self.source.save()
        for operation in ("models", "test", "create"):
            with self.subTest(operation=operation):
                response = self.send(operation, {"provider": "openai", "config": str(self.source.id)})
                self.assertEqual(response.status_code, 400)


class LLMSetupPermissionTests(LLMSetupTestBase):
    def as_role(self, role):
        user = User.objects.create_user(
            email=f"{role}@example.com", password="TestPassword123!", name=role,
        )
        OrganisationMember.objects.create(organisation=self.organisation, user=user, role=role)
        self.client.force_authenticate(user=user)
        self.client.credentials(HTTP_X_ACTIVE_ORG_ID=str(self.organisation.id))

    def test_admin_can_discover_test_create_and_update(self):
        self.as_role(OrganisationMemberRole.ADMIN.value)
        for operation in ("models", "test", "create", "update"):
            data = {"provider": "openai"}
            if operation != "update":
                data["config"] = str(self.source.id)
            with self.subTest(operation=operation):
                self.assertIn(self.send(operation, data).status_code, (200, 201))

    def test_members_and_guests_cannot_dial_or_write(self):
        for role in (OrganisationMemberRole.REGULAR.value, OrganisationMemberRole.GUEST.value):
            self.as_role(role)
            for operation in ("models", "test", "create", "update"):
                with self.subTest(role=role, operation=operation):
                    response = self.send(operation, {"provider": "openai", "api_key": "new-key"})
                    self.assertEqual(response.status_code, 403)
        self.request.assert_not_called()
        self.post.assert_not_called()

    def test_unauthenticated_requests_cannot_dial_or_write(self):
        self.client.force_authenticate(user=None)
        for operation in ("models", "test", "create", "update"):
            with self.subTest(operation=operation):
                self.assertIn(self.send(operation, {"provider": "openai"}).status_code, (401, 403))
        self.request.assert_not_called()
        self.post.assert_not_called()

    def test_nonmember_cannot_use_another_active_org(self):
        foreign = self.foreign_config()
        self.client.credentials(HTTP_X_ACTIVE_ORG_ID=str(foreign.organisation_id))
        response = self.send("models", {"provider": "openai", "config": str(foreign.id)})
        self.assertEqual(response.status_code, 403)
        self.request.assert_not_called()

    def test_cross_org_detail_update_is_not_found(self):
        foreign = self.foreign_config()
        response = self.client.patch(
            reverse("organisation-llm-config-detail", args=[foreign.id]),
            {"api_key": "new-key"}, format="json",
        )
        self.assertEqual(response.status_code, 404)
