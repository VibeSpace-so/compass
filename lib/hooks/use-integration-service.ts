"use client";

import { useMemo, useCallback, useEffect } from "react";
import {
  IntegrationAuth,
  getIntegrationRegistry,
  setActiveProjectForConnectors,
} from "@/lib/integration-service";
import { createDefaultConnectors } from "@/lib/connectors";
import type { IntegrationContext } from "@/lib/types";

export function useIntegrationService(projectId: string | null) {
  const registry = useMemo(() => {
    const reg = getIntegrationRegistry();
    const connectors = createDefaultConnectors();
    for (const connector of connectors) {
      if (!reg.getConnector(connector.id)) {
        reg.registerConnector(connector);
      }
    }
    return reg;
  }, []);

  // Keep the active project context in sync for connectors
  useEffect(() => {
    setActiveProjectForConnectors(projectId);
  }, [projectId]);

  const saveToken = useCallback((integrationId: string, token: string) => {
    if (!projectId) return;
    IntegrationAuth.saveIntegrationToken(projectId, integrationId, token);
  }, [projectId]);

  const getToken = useCallback((integrationId: string) => {
    if (!projectId) return null;
    return IntegrationAuth.getIntegrationToken(projectId, integrationId);
  }, [projectId]);

  const removeToken = useCallback((integrationId: string) => {
    if (!projectId) return;
    IntegrationAuth.removeIntegrationToken(projectId, integrationId);
  }, [projectId]);

  const hasToken = useCallback((integrationId: string) => {
    if (!projectId) return false;
    return IntegrationAuth.hasIntegrationToken(projectId, integrationId);
  }, [projectId]);

  const fetchContext = useCallback(
    async (query?: string): Promise<IntegrationContext[]> => {
      return registry.fetchAllContext(query);
    },
    [registry],
  );

  return {
    registry,
    saveToken,
    getToken,
    removeToken,
    hasToken,
    fetchContext,
  };
}
