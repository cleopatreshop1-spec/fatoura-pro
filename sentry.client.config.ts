import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV ?? "development",

  tracesSampleRate: process.env.NEXT_PUBLIC_APP_ENV === "production" ? 0.2 : 1.0,

  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.05,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  enabled: process.env.NEXT_PUBLIC_APP_ENV !== "development",

  beforeSend(event) {
    if (event.request?.data) {
      const sensitiveKeys = [
        "password", "mot_de_passe", "own_key_pem", "own_cert_pem",
        "ttn_password", "key", "token", "authorization",
      ];
      sensitiveKeys.forEach(k => {
        if (event.request?.data?.[k]) {
          event.request.data[k] = "[REDACTED]";
        }
      });
    }
    return event;
  },
});
