import {
  IntegrationConnector,
  IntegrationContext,
  IntegrationTestResult,
  getIntegrationToken,
  hasIntegrationToken,
} from "@/lib/integration-service";

const SLACK_API = "https://slack.com/api";

/**
 * Slack connector.
 *
 * NOTE: Slack's Web API supports CORS for most methods when called with
 * a valid token, but some endpoints may require a server-side proxy in
 * production depending on the workspace security settings.
 */
export class SlackConnector implements IntegrationConnector {
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
      const res = await fetch(`${SLACK_API}/auth.test`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      if (!res.ok) {
        return {
          success: false,
          message: `Slack API error: ${res.statusText}`,
        };
      }

      const data = (await res.json()) as SlackResponse & {
        user?: string;
        team?: string;
      };

      if (!data.ok) {
        return { success: false, message: `Slack error: ${data.error ?? "unknown"}` };
      }

      return {
        success: true,
        message: `Connected as ${data.user ?? "unknown"} in ${data.team ?? "unknown"}.`,
      };
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
      const params = new URLSearchParams({
        query,
        count: "20",
        sort: "timestamp",
        sort_dir: "desc",
      });

      const res = await fetch(`${SLACK_API}/search.messages?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return [];

      const data = (await res.json()) as SlackResponse & {
        messages?: { matches?: SlackMessage[] };
      };

      if (!data.ok) return [];

      return (data.messages?.matches ?? []).map((msg) =>
        this.messageToContext(msg)
      );
    } catch {
      return [];
    }
  }

  private messageToContext(msg: SlackMessage): IntegrationContext {
    return {
      id: msg.iid ?? msg.ts,
      integrationId: this.id,
      title: msg.channel?.name
        ? `#${msg.channel.name}`
        : "Slack message",
      content: msg.text,
      url: msg.permalink,
      updatedAt: msg.ts
        ? new Date(parseFloat(msg.ts) * 1000).toISOString()
        : undefined,
    };
  }
}

interface SlackResponse {
  ok: boolean;
  error?: string;
}

interface SlackMessage {
  iid?: string;
  ts: string;
  text: string;
  permalink?: string;
  channel?: { name?: string };
}
