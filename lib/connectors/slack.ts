import {
  IntegrationContext,
  IntegrationTestResult,
  getIntegrationToken,
  hasIntegrationToken,
} from "@/lib/integration-service";
import { ChatTool, ToolCallResult, ToolCapableConnector } from "@/lib/tool-types";

const PROXY_URL = "/api/integrations/slack";

export class SlackConnector implements ToolCapableConnector {
  readonly id = "slack";
  readonly name = "Slack";

  isConfigured(): boolean {
    return hasIntegrationToken(this.id);
  }

  async testConnection(): Promise<IntegrationTestResult> {
    const token = getIntegrationToken(this.id);
    if (!token) {
      return { success: false, message: "No Slack token configured." };
    }

    try {
      const res = await this.proxyCall(token, "list_channels", {});
      if (!res.success) {
        return { success: false, message: res.error ?? "Failed to connect to Slack." };
      }
      return { success: true, message: "Connected to Slack successfully." };
    } catch (err) {
      return {
        success: false,
        message: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  async fetchContext(query?: string): Promise<IntegrationContext[]> {
    const token = getIntegrationToken(this.id);
    if (!token || !query) return [];

    try {
      const res = await this.proxyCall(token, "search_messages", { query });
      if (!res.success) return [];

      const data = res.data as { matches?: SlackMessage[] };
      return (data?.matches ?? []).map((msg) => this.messageToContext(msg));
    } catch {
      return [];
    }
  }

  getTools(): ChatTool[] {
    return [
      {
        name: "slack_list_channels",
        description: "List available Slack channels",
        parameters: {
          type: "object",
          properties: {},
        },
        integrationId: this.id,
      },
      {
        name: "slack_read_messages",
        description: "Read recent messages from a Slack channel",
        parameters: {
          type: "object",
          properties: {
            channel_id: { type: "string", description: "The Slack channel ID" },
            limit: { type: "number", description: "Number of messages to fetch (default 20)" },
          },
          required: ["channel_id"],
        },
        integrationId: this.id,
      },
      {
        name: "slack_send_message",
        description: "Send a message to a Slack channel",
        parameters: {
          type: "object",
          properties: {
            channel_id: { type: "string", description: "The Slack channel ID" },
            text: { type: "string", description: "Message text to send" },
          },
          required: ["channel_id", "text"],
        },
        integrationId: this.id,
      },
      {
        name: "slack_search",
        description: "Search Slack messages",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
          },
          required: ["query"],
        },
        integrationId: this.id,
      },
    ];
  }

  async executeTool(toolName: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    const token = getIntegrationToken(this.id);
    if (!token) {
      return { success: false, error: "No Slack token configured." };
    }

    const actionMap: Record<string, string> = {
      slack_list_channels: "list_channels",
      slack_read_messages: "read_messages",
      slack_send_message: "send_message",
      slack_search: "search_messages",
    };

    const action = actionMap[toolName];
    if (!action) {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }

    return this.proxyCall(token, action, params);
  }

  private async proxyCall(
    token: string,
    action: string,
    params: Record<string, unknown>
  ): Promise<ToolCallResult> {
    const res = await fetch(PROXY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, params }),
    });

    const json = (await res.json()) as { success: boolean; data?: unknown; error?: string };
    return {
      success: json.success,
      data: json.data,
      error: json.error,
    };
  }

  private messageToContext(msg: SlackMessage): IntegrationContext {
    return {
      id: msg.iid ?? msg.ts,
      integrationId: this.id,
      title: msg.channel?.name ? `#${msg.channel.name}` : "Slack message",
      content: msg.text,
      url: msg.permalink,
      updatedAt: msg.ts
        ? new Date(parseFloat(msg.ts) * 1000).toISOString()
        : undefined,
    };
  }
}

interface SlackMessage {
  iid?: string;
  ts: string;
  text: string;
  permalink?: string;
  channel?: { name?: string };
}
