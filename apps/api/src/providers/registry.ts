import { ProviderInfo } from "./types.js";

const providers: Record<string, ProviderInfo> = {
  whoop: { slug: "whoop", displayName: "WHOOP", authType: "oauth" },
  apple_health: { slug: "apple_health", displayName: "Apple Health", authType: "device" },
};

export function getProvider(slug: string): ProviderInfo | undefined {
  return providers[slug];
}

export function getAllProviders(): ProviderInfo[] {
  return Object.values(providers);
}
