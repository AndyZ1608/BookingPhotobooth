type AuthEvent =
  | "admin_login_success"
  | "admin_login_invalid_credentials"
  | "admin_login_rate_limited"
  | "admin_session_created"
  | "admin_session_invalid"
  | "admin_logout_success";

type SafeAuthLogMeta = {
  adminId?: string;
  sessionId?: string;
  identifier?: string;
  ipAddress?: string;
  reason?: string;
};

export function logAdminAuthEvent(event: AuthEvent, meta: SafeAuthLogMeta = {}) {
  console.info(
    JSON.stringify({
      event,
      ...meta,
    }),
  );
}
