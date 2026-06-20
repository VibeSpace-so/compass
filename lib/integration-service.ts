import { IntegrationContext, IntegrationTestResult } from "./types";
import {
  saveEncryptedKey,
  removeEncryptedKey,
  getCachedKey,
  hasCachedKey,
} from "./secure-storage";

// Re-export types for connector convenience
export type { IntegrationContext, IntegrationTestResult };

// ---------------------------------------------------------------------------
// IntegrationAuth – per-project integration token storage
// ---------------------------------------------------------------------------

export const IntegrationAuth = {
  saveIntegrationToken(projectId: string, integrationId: string, token: string): void {
    if (typeof window === "undefined") return;
    saveEncryptedKey(projectId, "integration-" + integrationId, token).catch(() => {
      // Fail closed: token remains in memory cache only
    });
  },

  getIntegrationToken(projectId: string, integrationId: string): string | null {
    if (typeof window === "undefined") return null;
    const cached = getCachedKey(projectId, "integration-" + integrationId);
    return cached || null;
  },

  removeIntegrationToken(projectId: string, integrationId: string): void {
    if (typeof window === "undefined") return;
    removeEncryptedKey(projectId, "integration-" + integrationId);
  },

  hasIntegrationToken(projectId: string, integrationId: string): boolean {
    if (typeof window === "undefined") return false;
    return hasCachedKey(projectId, "integration-" + integrationId);
  },
};

// Active project context for connectors (set by the UI layer when a project is opened)
let activeProjectId: string | null = null;

export function setActiveProjectForConnectors(projectId: string | null): void {
  activeProjectId = projectId;
}

export function getActiveProjectForConnectors(): string | null {
  return activeProjectId;
}

// Standalone function exports used by connectors (use active project context)
export function saveIntegrationToken(id: string, token: string): void {
  if (!activeProjectId) return;
  IntegrationAuth.saveIntegrationToken(activeProjectId, id, token);
}

export function getIntegrationToken(id: string): string | null {
  if (!activeProjectId) return null;
  return IntegrationAuth.getIntegrationToken(activeProjectId, id);
}

export function hasIntegrationToken(id: string): boolean {
  if (!activeProjectId) return false;
  return IntegrationAuth.hasIntegrationToken(activeProjectId, id);
}

export function removeIntegrationToken(id: string): void {
  if (!activeProjectId) return;
  IntegrationAuth.removeIntegrationToken(activeProjectId, id);
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
