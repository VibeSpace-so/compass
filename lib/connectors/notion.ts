import {
  IntegrationConnector,
  IntegrationContext,
  IntegrationTestResult,
  getIntegrationToken,
  hasIntegrationToken,
} from "@/lib/integration-service";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

/**
 * Notion integration connector.
 *
 * NOTE: The Notion API does not support browser-origin requests (CORS).
 * In production, requests should be proxied through a Next.js API route
 * or an external CORS proxy. The fetch calls below are structurally
 * complete and will work once a proxy is in place — swap NOTION_API for
 * the proxy URL.
 */
export class NotionConnector implements IntegrationConnector {
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
      const res = await fetch(`${NOTION_API}/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = (body as Record<string, string>).message ?? res.statusText;
        return { success: false, message: `Notion API error: ${msg}` };
      }

      const user = (await res.json()) as { name?: string; type?: string };
      return {
        success: true,
        message: `Connected as ${user.name ?? user.type ?? "unknown"}.`,
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
    if (!token) return [];

    try {
      const res = await fetch(`${NOTION_API}/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: query ?? "",
          filter: { value: "page", property: "object" },
          page_size: 20,
        }),
      });

      if (!res.ok) return [];

      const data = (await res.json()) as { results: NotionPage[] };
      return (data.results ?? []).map((page) => this.pageToContext(page));
    } catch {
      return [];
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
