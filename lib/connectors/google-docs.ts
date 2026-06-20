import {
  IntegrationConnector,
  IntegrationContext,
  IntegrationTestResult,
  getIntegrationToken,
  hasIntegrationToken,
} from "@/lib/integration-service";

const DRIVE_API = "https://www.googleapis.com/drive/v3";

/**
 * Google Docs / Drive connector.
 *
 * NOTE: Google APIs enforce CORS restrictions for browser-only apps.
 * In production, proxy requests through a Next.js API route or use the
 * Google Identity Services library with a proper OAuth consent screen.
 * The fetch calls below are structurally complete and will work once a
 * proxy or server-side relay is in place.
 */
export class GoogleDocsConnector implements IntegrationConnector {
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
      const res = await fetch(
        `${DRIVE_API}/about?fields=user(displayName,emailAddress)`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        return {
          success: false,
          message: `Google API error: ${res.statusText}`,
        };
      }

      const data = (await res.json()) as {
        user?: { displayName?: string; emailAddress?: string };
      };
      const name = data.user?.displayName ?? data.user?.emailAddress ?? "unknown";
      return { success: true, message: `Connected as ${name}.` };
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
      const q = query
        ? `mimeType='application/vnd.google-apps.document' and fullText contains '${query.replace(/'/g, "\\'")}'`
        : "mimeType='application/vnd.google-apps.document'";

      const params = new URLSearchParams({
        q,
        fields: "files(id,name,modifiedTime,webViewLink)",
        pageSize: "20",
        orderBy: "modifiedTime desc",
      });

      const res = await fetch(`${DRIVE_API}/files?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return [];

      const data = (await res.json()) as { files?: DriveFile[] };
      return (data.files ?? []).map((file) => this.fileToContext(file));
    } catch {
      return [];
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
