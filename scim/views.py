"""SCIM view customizations"""

import copy
import json

from django.http import HttpResponse
from django.urls.resolvers import get_resolver
from django_scim import exceptions, constants as djs_constants, views as djs_views

from scim import constants


class InMemoryHttpRequest(HttpRequest):
    """
    A spoofed HttpRequest that only exists in-memory.
    It does not implement all features of HttpRequest and is only used
    for the bulk SCIM operations here so we can reuse view implementations.
    """

    def __init__(self, request, path, method, body):
        super().__init__()

        self.META = copy.deepcopy(request.META)
        self.path = path
        self.method = method
        self.content_type = djs_constants.SCIM_CONTENT_TYPE

        # normally HttpRequest would read this in, but we already have the value
        self._body = body


class BulkView(djs_views.SCIMView):
    http_method_names = ["post"]

    def post(self, request, *args, **kwargs):
        body = self.load_body(request.body)

        if body.get("schemas") != [constants.SchemaURI.BULK_REQUEST]:
            raise exceptions.BadRequestError(
                "Invalid schema uri. Must be SearchRequest."
            )

        fail_on_errors = body.get("failOnErrors", None)

        if fail_on_errors is not None and isinstance(int, fail_on_errors):
            raise exceptions.BaseRequestError(
                "Invalid failOnErrors. Must be an integer."
            )

        operations = body.get("Operations")

        results = self._attempt_operations(request, operations, fail_on_errors)

        response = {
            "schemas": [constants.SchemaURI.BATCH_RESPONSE],
            "Operations": results,
        }

        content = json.dumps(response)

        return HttpResponse(
            content=content, content_type=djs_constants.SCIM_CONTENT_TYPE, status=200
        )

    def _attempt_operations(self, request, operations, fail_on_errors):
        """Attempt to run the operations that were passed"""
        responses = []
        num_errors = 0

        for operation in operations:
            # per-spec,if we've hit the error threshold stop processing and return
            if fail_on_errors is not None and num_errors >= fail_on_errors:
                break

            op_response = self._attempt_operation(request, operation)

            # if the operation returned a non-2xx status code, record it as a failure
            if int(op_response.get("status")) >= 300:
                num_errors += 1

            responses.append(op_response)

        return responses

    def _attempt_operation(self, bulk_request, operation):
        """Attempt an operation as part of a bulk request"""

        method = operation.get("method")
        bulk_id = operation.get("bulkId")
        path = operation.get("path")
        data = operation.get("data")

        if path.startswith("/Users/"):
            return self._attempt_user_operation(
                bulk_request, method, path, bulk_id, data
            )
        elif path.startswith("/Groups/"):
            return self._attempt_group_operation(
                bulk_request, method, path, bulk_id, data
            )
        else:
            return self._operation_error(
                bulk_id, 501, "Endpoint is not supported for /Bulk"
            )

    def _operation_error(self, method, bulk_id, status_code, detail):
        """Return a failure response"""
        status_code = str(status_code)
        return {
            "method": method,
            "status": status_code,
            "bulkId": bulk_id,
            "response": {
                "schemas": [djs_constants.SchemaURI.ERROR],
                "status": status_code,
                "detail": detail,
            },
        }

    def _attempt_user_operation(self, bulk_request, method, path, bulk_id, data):
        op_request = InMemoryHttpRequest(bulk_request, path, method, data)
        # resolve the operation's path against the django_scim urls
        url_match = get_resolver("django_scim.urls").resolve(path)
        response = djs_views.UserView.dispatch(
            op_request, *url_match.args, **url_match.kwargs
        )

        return {
            **response,
            "bulkId": bulk_id,
        }

    def _attempt_group_operation(self, bulk_request, method, path, bulk_id, data):
        return self._operation_error(
            method, bulk_id, 501, "Group operations not implemented for /Bulk"
        )
