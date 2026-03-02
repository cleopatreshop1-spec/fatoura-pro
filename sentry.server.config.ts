import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
  tracesSampleRate: process.env.NEXT_PUBLIC_APP_ENV === "production" ? 0.2 : 1.0,
  enabled: process.env.NEXT_PUBLIC_APP_ENV !== "development",

  beforeSend(event) {
    if (event.extra) {
      const sensitiveKeys = ["own_key_pem", "own_cert_pem", "ttn_password", "ttn_username"];
      sensitiveKeys.forEach(k => {
        if (event.extra?.[k]) event.extra[k] = "[REDACTED]";
      });
    }
    return event;
  },
});
