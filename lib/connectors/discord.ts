import {
  IntegrationContext,
  IntegrationTestResult,
  getIntegrationToken,
  hasIntegrationToken,
} from "@/lib/integration-service";
import { ChatTool, ToolCallResult, ToolCapableConnector } from "@/lib/tool-types";

const PROXY_URL = "/api/integrations/discord";

export class DiscordConnector implements ToolCapableConnector {
  readonly id = "discord";
  readonly name = "Discord";

  isConfigured(): boolean {
    return hasIntegrationToken(this.id);
  }

  async testConnection(): Promise<IntegrationTestResult> {
    const token = getIntegrationToken(this.id);
    if (!token) {
      return { success: false, message: "No Discord token configured." };
    }

    try {
      const res = await this.proxyCall(token, "list_guilds", {});
      if (!res.success) {
        return { success: false, message: res.error ?? "Failed to connect to Discord." };
      }
      return { success: true, message: "Connected to Discord successfully." };
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
      const guildsRes = await this.proxyCall(token, "list_guilds", {});
      if (!guildsRes.success) return [];

      const guilds = guildsRes.data as DiscordGuild[];
      const contexts: IntegrationContext[] = [];

      for (const guild of guilds.slice(0, 3)) {
        const channelsRes = await this.proxyCall(token, "list_channels", {
          guild_id: guild.id,
        });
        if (!channelsRes.success) continue;

        const channels = channelsRes.data as DiscordChannel[];
        const textChannels = channels.filter((c) => c.type === 0).slice(0, 3);

        for (const channel of textChannels) {
          const msgsRes = await this.proxyCall(token, "read_messages", {
            channel_id: channel.id,
            limit: 5,
          });
          if (!msgsRes.success) continue;

          const msgs = msgsRes.data as DiscordMessage[];
          for (const msg of msgs) {
            if (!msg.content) continue;
            contexts.push({
              id: msg.id,
              integrationId: this.id,
              title: `#${channel.name} in ${guild.name}`,
              content: msg.content,
              url: `https://discord.com/channels/${guild.id}/${channel.id}/${msg.id}`,
              updatedAt: msg.timestamp,
            });
          }
        }
      }

      return contexts;
    } catch {
      return [];
    }
  }

  getTools(): ChatTool[] {
    return [
      {
        name: "discord_list_channels",
        description: "List Discord channels in a guild",
        parameters: {
          type: "object",
          properties: {
            guild_id: { type: "string", description: "The Discord guild (server) ID" },
          },
          required: ["guild_id"],
        },
        integrationId: this.id,
      },
      {
        name: "discord_read_messages",
        description: "Read recent messages from a Discord channel",
        parameters: {
          type: "object",
          properties: {
            channel_id: { type: "string", description: "The Discord channel ID" },
            limit: { type: "number", description: "Number of messages to fetch (default 20)" },
          },
          required: ["channel_id"],
        },
        integrationId: this.id,
      },
      {
        name: "discord_send_message",
        description: "Send a message to a Discord channel",
        parameters: {
          type: "object",
          properties: {
            channel_id: { type: "string", description: "The Discord channel ID" },
            content: { type: "string", description: "Message content to send" },
          },
          required: ["channel_id", "content"],
        },
        integrationId: this.id,
      },
      {
        name: "discord_search",
        description: "Search Discord messages in a guild",
        parameters: {
          type: "object",
          properties: {
            guild_id: { type: "string", description: "The Discord guild (server) ID" },
            query: { type: "string", description: "Search query" },
          },
          required: ["guild_id", "query"],
        },
        integrationId: this.id,
      },
    ];
  }

  async executeTool(toolName: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    const token = getIntegrationToken(this.id);
    if (!token) {
      return { success: false, error: "No Discord token configured." };
    }

    const actionMap: Record<string, string> = {
      discord_list_channels: "list_channels",
      discord_read_messages: "read_messages",
      discord_send_message: "send_message",
      discord_search: "search_messages",
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
        Authorization: `Bot ${token}`,
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
}

interface DiscordGuild {
  id: string;
  name: string;
}

interface DiscordChannel {
  id: string;
  name: string;
  type: number;
}

interface DiscordMessage {
  id: string;
  content: string;
  timestamp: string;
  author: { username: string };
}
