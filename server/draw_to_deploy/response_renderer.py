from rest_framework.renderers import JSONRenderer


class CustomJsonRenderer(JSONRenderer):
    def render(
        self,
        response_body,
        accepted_media_type=None,
        renderer_context=None,
    ):
        response_instance = renderer_context["response"]
        status_code = response_instance.status_code
        is_success = 200 <= status_code < 300

        response = {
            "data": response_body if is_success else {},
            "meta": {
                "success": is_success,
                "status_code": status_code,
                "message": self._get_message(response_body, is_success),
                "type": "success" if is_success else "error",
            },
        }

        if not is_success:
            response["errors"] = response_body

        return super().render(response, accepted_media_type, renderer_context)

    @staticmethod
    def _get_message(response_body, is_success):
        if is_success:
            return "Request processed successfully."
        if isinstance(response_body, dict):
            return response_body.get(
                "detail", response_body.get("error", "An error occurred.")
            )
        return "An error occurred."
