"""Providers are built from an organisation's stored config, not the environment.

Credentials are per-organisation now, so a provider can no longer be a
singleton registered at startup — the registry holds classes and each run
instantiates one with the config it resolved.
"""

from accounts.models import User
from agent.llm.base import BaseLLMProvider
from agent.llm.registry import LLMProviderRegistry, build_provider
from django.test import SimpleTestCase, TestCase
from organisations.constants import LLMProviderChoice
from organisations.models import LLMConfig, Organisation
from projects.models import Project
from utils.encryption import encrypt_val


class _StubProvider(BaseLLMProvider):
    name = "stub"

    def stream(self, **kwargs):  # pragma: no cover - never streamed here
        yield from ()


class RegistryTests(SimpleTestCase):
    def test_the_registry_holds_classes_not_instances(self):
        registry = LLMProviderRegistry()
        registry.register(_StubProvider)

        self.assertIs(registry.get("stub"), _StubProvider)

    def test_an_unregistered_provider_is_reported_clearly(self):
        registry = LLMProviderRegistry()

        with self.assertRaises(ValueError) as caught:
            registry.get("nope")

        self.assertIn("nope", str(caught.exception))


class BuildProviderTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="a@example.com", password="TestPassword123!", name="A"
        )
        self.org = Organisation.objects.create(name="Org", owner=self.user)

    def _config(self, **overrides):
        data = {
            "organisation": self.org,
            "name": "Default",
            "provider": LLMProviderChoice.ANTHROPIC.value,
            "model": "claude-sonnet-5",
            "api_key": encrypt_val("sk-ant-secret"),
        }
        data.update(overrides)
        return LLMConfig.objects.create(**data)

    def test_the_stored_model_reaches_the_provider(self):
        provider = build_provider(self._config(model="claude-opus-5"))

        self.assertEqual(provider._get_model(), "claude-opus-5")

    def test_the_api_key_is_decrypted_on_the_way_in(self):
        provider = build_provider(self._config())

        self.assertEqual(provider._api_key, "sk-ant-secret")

    def test_ollama_receives_its_base_url_and_context_window(self):
        provider = build_provider(
            self._config(
                provider=LLMProviderChoice.OLLAMA.value,
                model="qwen3:8b",
                api_key="",
                base_url="http://host.docker.internal:11434",
                context_window=16384,
            )
        )

        self.assertEqual(provider._get_base_url(), "http://host.docker.internal:11434")
        self.assertEqual(provider._context_window, 16384)

    def test_each_call_builds_a_fresh_provider(self):
        """Two organisations must never share one provider instance."""
        config = self._config()

        self.assertIsNot(build_provider(config), build_provider(config))


class ResolveConfigTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="a@example.com", password="TestPassword123!", name="A"
        )
        self.org = Organisation.objects.create(name="Org", owner=self.user)
        self.project = Project.objects.create(
            organisation=self.org, name="P", nodes=[], edges=[]
        )

    def _config(self, name, **overrides):
        data = {
            "organisation": self.org,
            "name": name,
            "provider": LLMProviderChoice.ANTHROPIC.value,
            "model": "claude-sonnet-5",
            "api_key": encrypt_val("k"),
        }
        data.update(overrides)
        return LLMConfig.objects.create(**data)

    def test_the_organisation_default_is_used_when_a_project_names_none(self):
        from agent.llm.registry import resolve_llm_config

        default = self._config("Org default")

        self.assertEqual(resolve_llm_config(self.project), default)

    def test_a_project_override_wins_over_the_organisation_default(self):
        from agent.llm.registry import resolve_llm_config

        self._config("Org default")
        override = self._config("Project pick", model="claude-opus-5")
        self.project.llm_config = override
        self.project.save(update_fields=["llm_config"])

        self.assertEqual(resolve_llm_config(self.project), override)

    def test_nothing_configured_resolves_to_none(self):
        from agent.llm.registry import resolve_llm_config

        self.assertIsNone(resolve_llm_config(self.project))
