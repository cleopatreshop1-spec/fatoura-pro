import * as Sentry from "@sentry/nextjs";

export function captureError(
  error: unknown,
  context?: {
    action?: string;
    invoiceId?: string;
    invoiceNumber?: string;
    companyId?: string;
    userId?: string;
    extra?: Record<string, unknown>;
  }
) {
  Sentry.withScope((scope) => {
    if (context?.action)        scope.setTag("action", context.action);
    if (context?.invoiceId)     scope.setTag("invoice_id", context.invoiceId);
    if (context?.invoiceNumber) scope.setTag("invoice_number", context.invoiceNumber);
    if (context?.companyId)     scope.setContext("company", { id: context.companyId });
    if (context?.userId)        scope.setUser({ id: context.userId });
    if (context?.extra)         scope.setExtras(context.extra);
    Sentry.captureException(error);
  });
}

export function identifyUser(userId: string, companyId: string) {
  Sentry.setUser({ id: userId });
  Sentry.setTag("company_id", companyId);
}

export function clearUser() {
  Sentry.setUser(null);
}

export function captureMessage(
  message: string,
  level: "info" | "warning" | "error" = "info",
  extra?: Record<string, unknown>
) {
  Sentry.withScope((scope) => {
    if (extra) scope.setExtras(extra);
    Sentry.captureMessage(message, level);
  });
}
