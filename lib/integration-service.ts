import { IntegrationContext, IntegrationTestResult } from "./types";

const TOKEN_PREFIX = "vibe-compass-integration-";

// ---------------------------------------------------------------------------
// IntegrationAuth – per-integration token storage in localStorage
// ---------------------------------------------------------------------------

export const IntegrationAuth = {
  saveIntegrationToken(integrationId: string, token: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(TOKEN_PREFIX + integrationId, token);
  },

  getIntegrationToken(integrationId: string): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_PREFIX + integrationId);
  },

  removeIntegrationToken(integrationId: string): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(TOKEN_PREFIX + integrationId);
  },

  hasIntegrationToken(integrationId: string): boolean {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(TOKEN_PREFIX + integrationId) !== null;
  },
};

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
