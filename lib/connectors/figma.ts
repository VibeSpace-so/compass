import {
  IntegrationConnector,
  IntegrationContext,
  IntegrationTestResult,
  getIntegrationToken,
  hasIntegrationToken,
} from "@/lib/integration-service";

const FIGMA_API = "https://api.figma.com/v1";

export class FigmaConnector implements IntegrationConnector {
  readonly id = "figma";
  readonly name = "Figma";

  isConfigured(): boolean {
    return hasIntegrationToken(this.id);
  }

  async testConnection(): Promise<IntegrationTestResult> {
    const token = getIntegrationToken(this.id);
    if (!token) {
      return { success: false, message: "No Figma token configured." };
    }

    try {
      const res = await fetch(`${FIGMA_API}/me`, {
        headers: { "X-Figma-Token": token },
      });

      if (!res.ok) {
        return {
          success: false,
          message: `Figma API error: ${res.statusText}`,
        };
      }

      const user = (await res.json()) as { handle?: string; email?: string };
      return {
        success: true,
        message: `Connected as ${user.handle ?? user.email ?? "unknown"}.`,
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
      const res = await fetch(`${FIGMA_API}/me/files/recent`, {
        headers: { "X-Figma-Token": token },
      });

      if (!res.ok) return [];

      const data = (await res.json()) as { files?: FigmaFile[] };
      return (data.files ?? []).map((file) => this.fileToContext(file));
    } catch {
      return [];
    }
  }

  private fileToContext(file: FigmaFile): IntegrationContext {
    return {
      id: file.key,
      integrationId: this.id,
      title: file.name,
      content: `Figma file: ${file.name}`,
      url: `https://www.figma.com/file/${file.key}`,
      updatedAt: file.last_modified,
    };
  }
}

interface FigmaFile {
  key: string;
  name: string;
  last_modified?: string;
  thumbnail_url?: string;
}
