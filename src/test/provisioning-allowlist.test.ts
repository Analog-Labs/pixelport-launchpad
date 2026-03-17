import { describe, expect, it } from "vitest";
import {
  isEmailAllowedForProvisioning,
  parseProvisioningAllowlist,
} from "../../api/lib/provisioning-allowlist";

describe("provisioning allowlist", () => {
  it("keeps provisioning open when allowlist env is not set", () => {
    const allowlist = parseProvisioningAllowlist(undefined);

    expect(allowlist.enabled).toBe(false);
    expect(isEmailAllowedForProvisioning("founder@example.com", allowlist)).toBe(true);
    expect(isEmailAllowedForProvisioning(undefined, allowlist)).toBe(true);
  });

  it("matches full email entries case-insensitively", () => {
    const allowlist = parseProvisioningAllowlist("Name@Example.com");

    expect(isEmailAllowedForProvisioning("name@example.com", allowlist)).toBe(true);
    expect(isEmailAllowedForProvisioning("NAME@EXAMPLE.COM", allowlist)).toBe(true);
    expect(isEmailAllowedForProvisioning("other@example.com", allowlist)).toBe(false);
  });

  it("matches bare domain entries against user email domain", () => {
    const allowlist = parseProvisioningAllowlist("example.com");

    expect(isEmailAllowedForProvisioning("person@example.com", allowlist)).toBe(true);
    expect(isEmailAllowedForProvisioning("person@sub.example.com", allowlist)).toBe(false);
    expect(isEmailAllowedForProvisioning("person@another.com", allowlist)).toBe(false);
  });

  it("ignores empty tokens while parsing", () => {
    const allowlist = parseProvisioningAllowlist(" , example.com ,, Name@Example.com, ");

    expect(allowlist.allowedDomains.has("example.com")).toBe(true);
    expect(allowlist.allowedEmails.has("name@example.com")).toBe(true);
    expect(allowlist.allowedDomains.size).toBe(1);
    expect(allowlist.allowedEmails.size).toBe(1);
  });

  it("keeps provisioning open when allowlist env is blank", () => {
    const allowlist = parseProvisioningAllowlist("   ,  ");

    expect(allowlist.enabled).toBe(false);
    expect(isEmailAllowedForProvisioning("founder@example.com", allowlist)).toBe(true);
    expect(isEmailAllowedForProvisioning(undefined, allowlist)).toBe(true);
  });

  it("blocks when allowlist is enabled and email is missing or unmatched", () => {
    const allowlist = parseProvisioningAllowlist("allowed.com");

    expect(isEmailAllowedForProvisioning(undefined, allowlist)).toBe(false);
    expect(isEmailAllowedForProvisioning("user@blocked.com", allowlist)).toBe(false);
  });
});
