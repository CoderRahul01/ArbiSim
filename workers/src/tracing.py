"""
OpenTelemetry bootstrap for the simulation worker daemon.
Importing this module initializes the global TracerProvider so that any
module calling `trace.get_tracer(__name__)` afterward attaches to the same
provider/exporter as the gateway (same OTLP collector), keeping the
preflight_simulate -> worker_process_request trace connected.
"""
import os

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

_otlp_base = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318")

_resource = Resource.create({
    "service.name": os.getenv("OTEL_SERVICE_NAME", "arbisim-guard-worker"),
})

_provider = TracerProvider(resource=_resource)
_provider.add_span_processor(
    BatchSpanProcessor(OTLPSpanExporter(endpoint=f"{_otlp_base}/v1/traces"))
)
trace.set_tracer_provider(_provider)
