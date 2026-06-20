"use client";

import { useMemo, useCallback } from "react";
import {
  IntegrationAuth,
  getIntegrationRegistry,
} from "@/lib/integration-service";
import type { IntegrationContext } from "@/lib/types";

export function useIntegrationService() {
  const registry = useMemo(() => getIntegrationRegistry(), []);

  const saveToken = useCallback((integrationId: string, token: string) => {
    IntegrationAuth.saveIntegrationToken(integrationId, token);
  }, []);

  const getToken = useCallback((integrationId: string) => {
    return IntegrationAuth.getIntegrationToken(integrationId);
  }, []);

  const removeToken = useCallback((integrationId: string) => {
    IntegrationAuth.removeIntegrationToken(integrationId);
  }, []);

  const hasToken = useCallback((integrationId: string) => {
    return IntegrationAuth.hasIntegrationToken(integrationId);
  }, []);

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
