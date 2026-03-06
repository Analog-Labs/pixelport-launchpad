const DEFAULT_APP_URL = "https://pixelport-launchpad.vercel.app";

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isLocalHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function getAppUrl(): string {
  const configuredUrl = import.meta.env.VITE_APP_URL?.trim();
  if (configuredUrl) {
    return stripTrailingSlash(configuredUrl);
  }

  if (typeof window !== "undefined" && !isLocalHostname(window.location.hostname)) {
    return stripTrailingSlash(window.location.origin);
  }

  return DEFAULT_APP_URL;
}

export function getAuthRedirectUrl(path = "/dashboard"): string {
  return new URL(path, `${getAppUrl()}/`).toString();
}
