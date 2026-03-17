export interface ProvisioningAllowlist {
  enabled: boolean;
  allowedEmails: Set<string>;
  allowedDomains: Set<string>;
}

function normalizeEntry(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function parseProvisioningAllowlist(rawAllowlist: string | null | undefined): ProvisioningAllowlist {
  const enabled = rawAllowlist !== undefined && rawAllowlist !== null;
  const allowedEmails = new Set<string>();
  const allowedDomains = new Set<string>();

  if (!enabled) {
    return {
      enabled: false,
      allowedEmails,
      allowedDomains,
    };
  }

  for (const rawEntry of rawAllowlist.split(',')) {
    const entry = normalizeEntry(rawEntry);

    if (!entry) {
      continue;
    }

    if (entry.includes('@')) {
      allowedEmails.add(entry);
      continue;
    }

    allowedDomains.add(entry);
  }

  return {
    enabled: true,
    allowedEmails,
    allowedDomains,
  };
}

export function isEmailAllowedForProvisioning(
  userEmail: string | null | undefined,
  allowlist: ProvisioningAllowlist,
): boolean {
  if (!allowlist.enabled) {
    return true;
  }

  if (typeof userEmail !== 'string') {
    return false;
  }

  const normalizedEmail = normalizeEmail(userEmail);
  if (!normalizedEmail) {
    return false;
  }

  if (allowlist.allowedEmails.has(normalizedEmail)) {
    return true;
  }

  const atIndex = normalizedEmail.lastIndexOf('@');
  if (atIndex <= 0 || atIndex >= normalizedEmail.length - 1) {
    return false;
  }

  const domain = normalizedEmail.slice(atIndex + 1);
  return allowlist.allowedDomains.has(domain);
}
