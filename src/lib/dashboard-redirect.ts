const DASHBOARD_PATH_PATTERN = /^\/dashboard(?:[/?#].*)?$/;

type RedirectState = {
  from?: unknown;
};

export function isDashboardRedirectPath(value: unknown): value is string {
  return typeof value === "string" && DASHBOARD_PATH_PATTERN.test(value);
}

export function getRedirectPathFromState(state: unknown): string | null {
  if (!state || typeof state !== "object") {
    return null;
  }

  const candidate = (state as RedirectState).from;
  return isDashboardRedirectPath(candidate) ? candidate : null;
}

export function getRequestedDashboardPath(pathname: string, search = "", hash = ""): string {
  const requestedPath = `${pathname}${search}${hash}`;
  return isDashboardRedirectPath(requestedPath) ? requestedPath : "/dashboard";
}

export function getPostAuthRedirectPath(state: unknown): string {
  return getRedirectPathFromState(state) || "/dashboard";
}
