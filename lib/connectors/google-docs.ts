import {
  IntegrationContext,
  IntegrationTestResult,
  getIntegrationToken,
  hasIntegrationToken,
} from "@/lib/integration-service";
import { ToolCapableConnector, ChatTool, ToolCallResult } from "@/lib/tool-types";

const PROXY_URL = "/api/integrations/gdocs";

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

export class GoogleDocsConnector implements ToolCapableConnector {
  readonly id = "gdocs";
  readonly name = "Google Docs";

  isConfigured(): boolean {
    return hasIntegrationToken(this.id);
  }

  async testConnection(): Promise<IntegrationTestResult> {
    const token = getIntegrationToken(this.id);
    if (!token) {
      return { success: false, message: "No Google OAuth token configured." };
    }

    try {
      const result = await proxyCall("list_docs", {}, token);
      if (!result.success) {
        return { success: false, message: `Google API error: ${result.error ?? "unknown"}` };
      }
      return { success: true, message: "Connected to Google Docs." };
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
      const action = query ? "search" : "list_docs";
      const params: Record<string, unknown> = query ? { query } : {};
      const result = await proxyCall(action, params, token);
      if (!result.success || !result.data) return [];
      const data = result.data as { files?: DriveFile[] };
      return (data.files ?? []).map((file) => this.fileToContext(file));
    } catch {
      return [];
    }
  }

  getTools(): ChatTool[] {
    return [
      {
        name: "gdocs_search",
        description: "Search Google Drive for documents",
        integrationId: this.id,
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
          },
          required: ["query"],
        },
      },
      {
        name: "gdocs_get_doc",
        description: "Get document content",
        integrationId: this.id,
        parameters: {
          type: "object",
          properties: {
            doc_id: { type: "string", description: "Google Doc ID" },
          },
          required: ["doc_id"],
        },
      },
      {
        name: "gdocs_create_doc",
        description: "Create a new Google Docs document",
        integrationId: this.id,
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Document title" },
            content: { type: "string", description: "Initial document text" },
          },
          required: ["title"],
        },
      },
      {
        name: "gdocs_update_doc",
        description: "Update/append to a Google Docs document",
        integrationId: this.id,
        parameters: {
          type: "object",
          properties: {
            doc_id: { type: "string", description: "Google Doc ID" },
            content: { type: "string", description: "Text to append" },
          },
          required: ["doc_id", "content"],
        },
      },
    ];
  }

  async executeTool(toolName: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    const token = getIntegrationToken(this.id);
    if (!token) return { success: false, error: "No Google OAuth token configured." };

    const actionMap: Record<string, string> = {
      gdocs_search: "search",
      gdocs_get_doc: "get_doc",
      gdocs_create_doc: "create_doc",
      gdocs_update_doc: "update_doc",
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

  private fileToContext(file: DriveFile): IntegrationContext {
    return {
      id: file.id,
      integrationId: this.id,
      title: file.name,
      content: file.name,
      url: file.webViewLink,
      updatedAt: file.modifiedTime,
    };
  }
}

interface DriveFile {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}
