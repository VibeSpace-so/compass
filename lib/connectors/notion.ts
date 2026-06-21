import {
  IntegrationContext,
  IntegrationTestResult,
  getIntegrationToken,
  hasIntegrationToken,
} from "@/lib/integration-service";
import { ToolCapableConnector, ChatTool, ToolCallResult } from "@/lib/tool-types";

const PROXY_URL = "/api/integrations/notion";

async function proxyCall(
  action: string,
  params: Record<string, unknown>,
  token: string
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  const res = await fetch(PROXY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, params }),
  });
  return res.json() as Promise<{ success: boolean; data?: unknown; error?: string }>;
}

export class NotionConnector implements ToolCapableConnector {
  readonly id = "notion";
  readonly name = "Notion";

  isConfigured(): boolean {
    return hasIntegrationToken(this.id);
  }

  async testConnection(): Promise<IntegrationTestResult> {
    const token = getIntegrationToken(this.id);
    if (!token) {
      return { success: false, message: "No Notion token configured." };
    }

    try {
      const result = await proxyCall("search", { page_size: 1 }, token);
      if (!result.success) {
        return { success: false, message: `Notion API error: ${result.error ?? "unknown"}` };
      }
      return { success: true, message: "Connected to Notion." };
    } catch (err) {
      return {
        success: false,
        message: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async fetchContext(query?: string): Promise<IntegrationContext[]> {
    const token = getIntegrationToken(this.id);
    if (!token) return [];

    try {
      const result = await proxyCall("search", { query: query ?? "", page_size: 20 }, token);
      if (!result.success || !result.data) return [];
      const data = result.data as { results?: NotionPage[] };
      return (data.results ?? []).map((page) => this.pageToContext(page));
    } catch {
      return [];
    }
  }

  getTools(): ChatTool[] {
    return [
      {
        name: "notion_search",
        description: "Search Notion pages by query",
        integrationId: this.id,
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            page_size: { type: "number", description: "Max results (default 20)" },
          },
          required: ["query"],
        },
      },
      {
        name: "notion_get_page",
        description: "Get full content of a Notion page",
        integrationId: this.id,
        parameters: {
          type: "object",
          properties: {
            page_id: { type: "string", description: "Notion page ID" },
          },
          required: ["page_id"],
        },
      },
      {
        name: "notion_create_page",
        description: "Create a new page in Notion",
        integrationId: this.id,
        parameters: {
          type: "object",
          properties: {
            parent_id: { type: "string", description: "Parent page ID" },
            title: { type: "string", description: "Page title" },
            content: { type: "string", description: "Page body text" },
          },
          required: ["parent_id", "title"],
        },
      },
      {
        name: "notion_list_databases",
        description: "List available Notion databases",
        integrationId: this.id,
        parameters: {
          type: "object",
          properties: {
            page_size: { type: "number", description: "Max results (default 20)" },
          },
        },
      },
    ];
  }

  async executeTool(toolName: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    const token = getIntegrationToken(this.id);
    if (!token) return { success: false, error: "No Notion token configured." };

    const actionMap: Record<string, string> = {
      notion_search: "search",
      notion_get_page: "get_page",
      notion_create_page: "create_page",
      notion_list_databases: "list_databases",
    };
    const action = actionMap[toolName];
    if (!action) return { success: false, error: `Unknown tool: ${toolName}` };

    try {
      return await proxyCall(action, params, token);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private pageToContext(page: NotionPage): IntegrationContext {
    const titleProp = Object.values(page.properties ?? {}).find(
      (p) => p.type === "title"
    );
    const titleText =
      titleProp?.title?.map((t: { plain_text: string }) => t.plain_text).join("") ??
      "Untitled";

    return {
      id: page.id,
      integrationId: this.id,
      title: titleText,
      content: titleText,
      url: page.url,
      updatedAt: page.last_edited_time,
    };
  }
}

interface NotionPage {
  id: string;
  url: string;
  last_edited_time: string;
  properties: Record<
    string,
    {
      type: string;
      title?: { plain_text: string }[];
    }
  >;
}
