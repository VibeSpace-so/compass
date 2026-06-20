export interface IntegrationConnector {
  id: string;
  name: string;
  isConfigured(): boolean;
  testConnection(): Promise<IntegrationTestResult>;
  fetchContext(query?: string): Promise<IntegrationContext[]>;
}

export interface IntegrationContext {
  id: string;
  integrationId: string;
  title: string;
  content: string;
  url?: string;
  updatedAt?: string;
}

export interface IntegrationTestResult {
  success: boolean;
  message: string;
}

const TOKEN_PREFIX = "vibe-compass-integration-";

export function saveIntegrationToken(id: string, token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_PREFIX + id, token);
}

export function getIntegrationToken(id: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_PREFIX + id);
}

export function hasIntegrationToken(id: string): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(TOKEN_PREFIX + id);
}
