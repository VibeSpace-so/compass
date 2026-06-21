import {
  IntegrationConnector,
  IntegrationContext,
  IntegrationTestResult,
  getIntegrationToken,
  hasIntegrationToken,
} from "@/lib/integration-service";
import { ChatTool, ToolCallResult, ToolCapableConnector } from "@/lib/tool-types";

export class DevinConnector implements IntegrationConnector, ToolCapableConnector {
  readonly id = "devin";
  readonly name = "Devin";

  isConfigured(): boolean {
    return hasIntegrationToken(this.id);
  }

  async testConnection(): Promise<IntegrationTestResult> {
    const token = getIntegrationToken(this.id);
    if (!token) {
      return { success: false, message: "No Devin API token configured." };
    }

    try {
      const res = await fetch("/api/integrations/devin", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "list_sessions", params: {} }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as Record<string, string>;
        return {
          success: false,
          message: `Devin API error: ${data.error ?? res.statusText}`,
        };
      }

      return { success: true, message: "Connected to Devin API." };
    } catch (err) {
      return {
        success: false,
        message: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async fetchContext(_query?: string): Promise<IntegrationContext[]> {
    const token = getIntegrationToken(this.id);
    if (!token) return [];

    try {
      const res = await fetch("/api/integrations/devin", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "list_sessions", params: {} }),
      });

      if (!res.ok) return [];

      const data = (await res.json()) as { sessions?: DevinSession[] };
      return (data.sessions ?? []).map((s) => this.sessionToContext(s));
    } catch {
      return [];
    }
  }

  getTools(): ChatTool[] {
    return [
      {
        name: "devin_create_session",
        description: "Create a Devin session to implement a feature or fix a bug",
        parameters: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "Task description for Devin" },
            repos: {
              type: "array",
              items: { type: "string" },
              description: "Repository URLs to work with (optional)",
            },
          },
          required: ["prompt"],
        },
        integrationId: this.id,
      },
      {
        name: "devin_check_session",
        description: "Check the status of a Devin session",
        parameters: {
          type: "object",
          properties: {
            session_id: { type: "string", description: "The Devin session ID" },
          },
          required: ["session_id"],
        },
        integrationId: this.id,
      },
      {
        name: "devin_send_message",
        description: "Send instructions to a running Devin session",
        parameters: {
          type: "object",
          properties: {
            session_id: { type: "string", description: "The Devin session ID" },
            message: { type: "string", description: "Message to send" },
          },
          required: ["session_id", "message"],
        },
        integrationId: this.id,
      },
      {
        name: "devin_list_sessions",
        description: "List recent Devin sessions",
        parameters: {
          type: "object",
          properties: {},
        },
        integrationId: this.id,
      },
    ];
  }

  async executeTool(toolName: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    const token = getIntegrationToken(this.id);
    if (!token) {
      return { success: false, error: "No Devin API token configured." };
    }

    const actionMap: Record<string, string> = {
      devin_create_session: "create_session",
      devin_check_session: "get_session",
      devin_send_message: "send_message",
      devin_list_sessions: "list_sessions",
    };

    const action = actionMap[toolName];
    if (!action) {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }

    try {
      const res = await fetch("/api/integrations/devin", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, params }),
      });

      const data: unknown = await res.json();

      if (!res.ok) {
        const errorData = data as Record<string, string>;
        return { success: false, error: errorData.error ?? `API error: ${res.status}` };
      }

      return { success: true, data };
    } catch (err) {
      return {
        success: false,
        error: `Request failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private sessionToContext(session: DevinSession): IntegrationContext {
    return {
      id: session.session_id,
      integrationId: this.id,
      title: session.title ?? session.prompt?.slice(0, 80) ?? "Devin session",
      content: session.status
        ? `Status: ${session.status} — ${session.prompt ?? ""}`
        : session.prompt ?? "",
      url: session.url,
      updatedAt: session.updated_at,
    };
  }
}

interface DevinSession {
  session_id: string;
  title?: string;
  prompt?: string;
  status?: string;
  url?: string;
  updated_at?: string;
}
