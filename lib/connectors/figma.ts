import {
  IntegrationContext,
  IntegrationTestResult,
  getIntegrationToken,
  hasIntegrationToken,
} from "@/lib/integration-service";
import {
  ChatTool,
  ToolCallResult,
  ToolCapableConnector,
} from "@/lib/tool-types";

const PROXY = "/api/integrations/figma";

async function proxyCall(
  token: string,
  action: string,
  params: Record<string, unknown>,
): Promise<{ ok: boolean; data: unknown; status: number }> {
  const res = await fetch(PROXY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: token,
    },
    body: JSON.stringify({ action, params }),
  });

  const data = await res.json();
  return { ok: res.ok, data, status: res.status };
}

export class FigmaConnector implements ToolCapableConnector {
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
      const res = await fetch("https://api.figma.com/v1/me", {
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
      const res = await fetch("https://api.figma.com/v1/me/files/recent", {
        headers: { "X-Figma-Token": token },
      });

      if (!res.ok) return [];

      const data = (await res.json()) as { files?: FigmaFile[] };
      return (data.files ?? []).map((file) => this.fileToContext(file));
    } catch {
      return [];
    }
  }

  getTools(): ChatTool[] {
    return [
      {
        name: "figma_get_file",
        description: "Get Figma file structure and content",
        parameters: {
          type: "object",
          properties: {
            file_key: { type: "string", description: "Figma file key" },
          },
          required: ["file_key"],
        },
        integrationId: this.id,
      },
      {
        name: "figma_get_components",
        description: "List reusable components in a Figma file",
        parameters: {
          type: "object",
          properties: {
            file_key: { type: "string", description: "Figma file key" },
          },
          required: ["file_key"],
        },
        integrationId: this.id,
      },
      {
        name: "figma_get_styles",
        description: "Get design tokens and styles from a Figma file",
        parameters: {
          type: "object",
          properties: {
            file_key: { type: "string", description: "Figma file key" },
          },
          required: ["file_key"],
        },
        integrationId: this.id,
      },
      {
        name: "figma_export_images",
        description: "Export nodes from a Figma file as images",
        parameters: {
          type: "object",
          properties: {
            file_key: { type: "string", description: "Figma file key" },
            node_ids: {
              type: "array",
              items: { type: "string" },
              description: "Node IDs to export",
            },
            format: {
              type: "string",
              enum: ["png", "jpg", "svg", "pdf"],
              description: "Export format (default: png)",
            },
            scale: {
              type: "number",
              description: "Export scale (default: 1)",
            },
          },
          required: ["file_key", "node_ids"],
        },
        integrationId: this.id,
      },
      {
        name: "figma_post_comment",
        description: "Add a comment to a Figma file",
        parameters: {
          type: "object",
          properties: {
            file_key: { type: "string", description: "Figma file key" },
            message: { type: "string", description: "Comment text" },
            x: { type: "number", description: "X coordinate (optional)" },
            y: { type: "number", description: "Y coordinate (optional)" },
          },
          required: ["file_key", "message"],
        },
        integrationId: this.id,
      },
    ];
  }

  async executeTool(
    toolName: string,
    params: Record<string, unknown>,
  ): Promise<ToolCallResult> {
    const token = getIntegrationToken(this.id);
    if (!token) {
      return { success: false, error: "No Figma token configured." };
    }

    const actionMap: Record<string, string> = {
      figma_get_file: "get_file",
      figma_get_components: "get_components",
      figma_get_styles: "get_styles",
      figma_export_images: "get_images",
      figma_post_comment: "post_comment",
    };

    const action = actionMap[toolName];
    if (!action) {
      return { success: false, error: `Unknown tool: ${toolName}` };
    }

    try {
      const result = await proxyCall(token, action, params);
      if (!result.ok) {
        const errMsg =
          typeof result.data === "object" &&
          result.data !== null &&
          "error" in result.data
            ? String((result.data as Record<string, unknown>).error)
            : `API error (${result.status})`;
        return { success: false, error: errMsg };
      }
      return { success: true, data: result.data };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
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
