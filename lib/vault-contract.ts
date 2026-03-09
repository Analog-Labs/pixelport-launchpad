export const VAULT_SECTION_KEYS = [
  "company_profile",
  "brand_voice",
  "icp",
  "competitors",
  "products",
] as const;

export type VaultSectionKey = (typeof VAULT_SECTION_KEYS)[number];

export const VAULT_SECTION_TITLES: Record<VaultSectionKey, string> = {
  company_profile: "Company Profile",
  brand_voice: "Brand Voice",
  icp: "Target Audience & ICP",
  competitors: "Competitors",
  products: "Products & Services",
};

export function isVaultSectionKey(value: unknown): value is VaultSectionKey {
  return typeof value === "string" && VAULT_SECTION_KEYS.includes(value as VaultSectionKey);
}

export function getVaultSectionTitle(sectionKey: VaultSectionKey): string {
  return VAULT_SECTION_TITLES[sectionKey];
}

export function getVaultSectionSnapshotPath(sectionKey: VaultSectionKey): string {
  return `pixelport/vault/snapshots/${sectionKey}.md`;
}
