from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("organisations", "0004_llmconfig")]

    operations = [
        migrations.AlterField(
            model_name="llmconfig",
            name="provider",
            field=models.CharField(
                choices=[
                    ("anthropic", "ANTHROPIC"),
                    ("gemini", "GEMINI"),
                    ("ollama", "OLLAMA"),
                    ("openai", "OPENAI"),
                ],
                max_length=32,
            ),
        ),
    ]
