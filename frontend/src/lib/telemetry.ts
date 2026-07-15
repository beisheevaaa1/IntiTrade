import { API_URL } from "../api/config";

type TelemetryEvent = {
  type: "frontend_error" | "api_error";
  message: string;
  path?: string;
  requestId?: string;
};

function safeMessage(message: string) {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[email]")
    .replace(/[A-Za-z0-9_-]{32,}/g, "[token]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[phone]")
    .slice(0, 300);
}

export function reportClientError(event: TelemetryEvent) {
  const payload = JSON.stringify({
    ...event,
    message: safeMessage(event.message || "Client error"),
    path: (event.path ?? window.location.pathname).slice(0, 300)
  });

  void fetch(`${API_URL}/api/telemetry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true
  }).catch(() => undefined);
}
