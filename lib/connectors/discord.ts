import {
  IntegrationConnector,
  IntegrationContext,
  IntegrationTestResult,
  getIntegrationToken,
  hasIntegrationToken,
} from "@/lib/integration-service";

const DISCORD_API = "https://discord.com/api/v10";

/**
 * Discord bot connector.
 *
 * Expects a bot token stored via the integration service. The token is
 * sent as `Bot <token>` in the Authorization header.
 *
 * NOTE: Discord API does not allow browser-origin requests (CORS). In
 * production, proxy through a Next.js API route or server-side relay.
 */
export class DiscordConnector implements IntegrationConnector {
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
      const res = await fetch(`${DISCORD_API}/users/@me`, {
        headers: { Authorization: `Bot ${token}` },
      });

      if (!res.ok) {
        return {
          success: false,
          message: `Discord API error: ${res.statusText}`,
        };
      }

      const user = (await res.json()) as { username?: string; id?: string };
      return {
        success: true,
        message: `Connected as ${user.username ?? user.id ?? "unknown"}.`,
      };
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
      const guildsRes = await fetch(`${DISCORD_API}/users/@me/guilds`, {
        headers: { Authorization: `Bot ${token}` },
      });

      if (!guildsRes.ok) return [];

      const guilds = (await guildsRes.json()) as DiscordGuild[];
      const contexts: IntegrationContext[] = [];

      for (const guild of guilds.slice(0, 3)) {
        const messages = await this.fetchGuildMessages(token, guild);
        contexts.push(...messages);
      }

      return contexts;
    } catch {
      return [];
    }
  }

  private async fetchGuildMessages(
    token: string,
    guild: DiscordGuild
  ): Promise<IntegrationContext[]> {
    try {
      const channelsRes = await fetch(
        `${DISCORD_API}/guilds/${guild.id}/channels`,
        { headers: { Authorization: `Bot ${token}` } }
      );

      if (!channelsRes.ok) return [];

      const channels = (await channelsRes.json()) as DiscordChannel[];
      const textChannels = channels
        .filter((c) => c.type === 0)
        .slice(0, 3);

      const contexts: IntegrationContext[] = [];

      for (const channel of textChannels) {
        const msgsRes = await fetch(
          `${DISCORD_API}/channels/${channel.id}/messages?limit=5`,
          { headers: { Authorization: `Bot ${token}` } }
        );

        if (!msgsRes.ok) continue;

        const msgs = (await msgsRes.json()) as DiscordMessage[];

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

      return contexts;
    } catch {
      return [];
    }
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
