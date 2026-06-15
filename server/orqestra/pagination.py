from rest_framework.pagination import PageNumberPagination


class StandardResultsSetPagination(PageNumberPagination):
    """Default page-number pagination for list endpoints.

    Returns ``{count, next, previous, results}`` (wrapped under ``data`` by the
    custom renderer). Clients pass ``?page=`` and optionally ``?page_size=``.
    """

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
