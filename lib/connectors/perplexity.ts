/**
 * Perplexity Search connector — web research for idea validation and context gathering.
 * Uses the Perplexity Search API (POST /search) which returns structured results.
 */

import { ChatTool, ToolCallResult, ToolCapableConnector } from "../tool-types";
import {
  IntegrationContext,
  IntegrationTestResult,
  getIntegrationToken,
  hasIntegrationToken,
} from "../integration-service";

export class PerplexityConnector implements ToolCapableConnector {
  readonly id = "perplexity";
  readonly name = "Perplexity";

  isConfigured(): boolean {
    return hasIntegrationToken(this.id);
  }

  async testConnection(): Promise<IntegrationTestResult> {
    const token = getIntegrationToken(this.id);
    if (!token) {
      return { success: false, message: "No Perplexity API key configured." };
    }

    try {
      const response = await fetch("/api/integrations/perplexity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "search",
          params: { query: "test", max_results: 1 },
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          success: false,
          message: (data as { error?: string }).error || `HTTP ${response.status}`,
        };
      }
      return { success: true, message: "Connected to Perplexity Search API." };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : "Connection failed.",
      };
    }
  }

  async fetchContext(): Promise<IntegrationContext[]> {
    // Perplexity is search-based, not a persistent context source
    return [{
      id: "perplexity-info",
      integrationId: "perplexity",
      title: "Perplexity Search",
      content: "Web search available via chat tool calls.",
    }];
  }

  getTools(): ChatTool[] {
    return [
      {
        name: "perplexity_search",
        description:
          "Search the web using Perplexity to research ideas, validate concepts, find competitors, analyze markets, or gather best practices. Returns structured results with titles, URLs, and snippets.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The search query. Be specific and focused.",
            },
            max_results: {
              type: "number",
              description: "Number of results to return (1-10). Default: 5.",
            },
          },
          required: ["query"],
        },
        integrationId: "perplexity",
      },
    ];
  }

  async executeTool(
    toolName: string,
    params: Record<string, unknown>
  ): Promise<ToolCallResult> {
    if (toolName !== "perplexity_search") {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }

    const { getIntegrationToken } = await import("../integration-service");
    const token = getIntegrationToken("perplexity");
    if (!token) {
      return { success: false, error: "Perplexity API key not configured. Add it in Settings." };
    }

    try {
      const response = await fetch("/api/integrations/perplexity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "search",
          params: {
            query: params.query as string,
            max_results: (params.max_results as number) || 5,
          },
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        return {
          success: false,
          error: (data as { error?: string }).error || `Search failed (${response.status})`,
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Search request failed.",
      };
    }
  }
}
