from rest_framework import serializers

from .models import Project


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            "id",
            "organisation",
            "name",
            "description",
            "nodes",
            "edges",
            "deployment_settings",
            "aws_account",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "organisation", "created_at", "updated_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        aws_account = attrs.get("aws_account")
        if aws_account:
            from organisations.helpers import get_active_organisation
            active_org = get_active_organisation(request)
            if aws_account.organisation != active_org:
                raise serializers.ValidationError(
                    {"aws_account": "AWS account must belong to the active organisation."}
                )
        return attrs

