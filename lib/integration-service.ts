import { IntegrationContext, IntegrationTestResult } from "./types";
import {
  saveEncrypted,
  removeEncrypted,
  getCachedKey,
  hasCachedKey,
} from "./secure-storage";

// Re-export types for connector convenience
export type { IntegrationContext, IntegrationTestResult };

const TOKEN_PREFIX = "vibe-compass-integration-";

// ---------------------------------------------------------------------------
// IntegrationAuth – per-integration token storage in localStorage
// ---------------------------------------------------------------------------

export const IntegrationAuth = {
  saveIntegrationToken(integrationId: string, token: string): void {
    if (typeof window === "undefined") return;
    saveEncrypted("integration-" + integrationId, token).catch(() => {
      localStorage.setItem(TOKEN_PREFIX + integrationId, token);
    });
  },

  getIntegrationToken(integrationId: string): string | null {
    if (typeof window === "undefined") return null;
    const cached = getCachedKey("integration-" + integrationId);
    if (cached) return cached;
    return localStorage.getItem(TOKEN_PREFIX + integrationId);
  },

  removeIntegrationToken(integrationId: string): void {
    if (typeof window === "undefined") return;
    removeEncrypted("integration-" + integrationId);
    localStorage.removeItem(TOKEN_PREFIX + integrationId);
  },

  hasIntegrationToken(integrationId: string): boolean {
    if (typeof window === "undefined") return false;
    return hasCachedKey("integration-" + integrationId) || localStorage.getItem(TOKEN_PREFIX + integrationId) !== null;
  },
};

// Standalone function exports used by connectors
export function saveIntegrationToken(id: string, token: string): void {
  IntegrationAuth.saveIntegrationToken(id, token);
}

export function getIntegrationToken(id: string): string | null {
  return IntegrationAuth.getIntegrationToken(id);
}

export function hasIntegrationToken(id: string): boolean {
  return IntegrationAuth.hasIntegrationToken(id);
}

export function removeIntegrationToken(id: string): void {
  IntegrationAuth.removeIntegrationToken(id);
}

/**
 * Re-check token status after decryption cache is loaded.
 * Call this after loadAllEncryptedKeys() to update integration connected state.
 */
export function refreshTokenStatus(integrationIds: string[]): Map<string, boolean> {
  const status = new Map<string, boolean>();
  for (const id of integrationIds) {
    status.set(id, IntegrationAuth.hasIntegrationToken(id));
  }
  return status;
}

// ---------------------------------------------------------------------------
// IntegrationConnector – abstract connector shape
// ---------------------------------------------------------------------------

export interface IntegrationConnector {
  id: string;
  name: string;
  isConfigured(): boolean;
  testConnection(): Promise<IntegrationTestResult>;
  fetchContext(query?: string): Promise<IntegrationContext[]>;
}

// ---------------------------------------------------------------------------
// IntegrationRegistry – manages connectors
// ---------------------------------------------------------------------------

class IntegrationRegistryImpl {
  private connectors = new Map<string, IntegrationConnector>();

  registerConnector(connector: IntegrationConnector): void {
    this.connectors.set(connector.id, connector);
  }

  getConnector(id: string): IntegrationConnector | undefined {
    return this.connectors.get(id);
  }

  getConfiguredConnectors(): IntegrationConnector[] {
    return Array.from(this.connectors.values()).filter((c) => c.isConfigured());
  }

  async fetchAllContext(query?: string): Promise<IntegrationContext[]> {
    const configured = this.getConfiguredConnectors();
    const results = await Promise.allSettled(
      configured.map((c) => c.fetchContext(query)),
    );
    return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  }
}

let registryInstance: IntegrationRegistryImpl | null = null;

export function getIntegrationRegistry(): IntegrationRegistryImpl {
  if (!registryInstance) {
    registryInstance = new IntegrationRegistryImpl();
  }
  return registryInstance;
}

export type IntegrationRegistry = IntegrationRegistryImpl;
