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

const PROXY = "/api/integrations/vercel";

async function proxyCall(
  token: string,
  action: string,
  params: Record<string, unknown>,
): Promise<{ ok: boolean; data: unknown; status: number }> {
  const res = await fetch(PROXY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, params }),
  });

  const data = await res.json();
  return { ok: res.ok, data, status: res.status };
}

export class VercelConnector implements ToolCapableConnector {
  readonly id = "vercel";
  readonly name = "Vercel";

  isConfigured(): boolean {
    return hasIntegrationToken(this.id);
  }

  async testConnection(): Promise<IntegrationTestResult> {
    const token = getIntegrationToken(this.id);
    if (!token) {
      return { success: false, message: "No Vercel token configured." };
    }

    try {
      const result = await proxyCall(token, "list_projects", {});
      if (!result.ok) {
        return {
          success: false,
          message: `Vercel API error: status ${result.status}`,
        };
      }
      return { success: true, message: "Connected to Vercel." };
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
      const result = await proxyCall(token, "list_deployments", { limit: 10 });
      if (!result.ok) return [];

      const data = result.data as { deployments?: VercelDeployment[] };
      return (data.deployments ?? []).map((d) => this.deploymentToContext(d));
    } catch {
      return [];
    }
  }

  getTools(): ChatTool[] {
    return [
      {
        name: "vercel_list_projects",
        description: "List all Vercel projects",
        parameters: {
          type: "object",
          properties: {},
        },
        integrationId: this.id,
      },
      {
        name: "vercel_list_deployments",
        description: "List recent Vercel deployments",
        parameters: {
          type: "object",
          properties: {
            project_id: {
              type: "string",
              description: "Filter by project ID (optional)",
            },
            limit: {
              type: "number",
              description: "Max results to return (optional)",
            },
          },
        },
        integrationId: this.id,
      },
      {
        name: "vercel_deploy",
        description: "Trigger a new Vercel deployment",
        parameters: {
          type: "object",
          properties: {
            project_name: {
              type: "string",
              description: "Vercel project name",
            },
            git_ref: {
              type: "string",
              description: "Git branch or ref to deploy (optional)",
            },
          },
          required: ["project_name"],
        },
        integrationId: this.id,
      },
      {
        name: "vercel_get_deployment",
        description: "Check the status of a Vercel deployment",
        parameters: {
          type: "object",
          properties: {
            deployment_id: {
              type: "string",
              description: "Deployment ID",
            },
          },
          required: ["deployment_id"],
        },
        integrationId: this.id,
      },
      {
        name: "vercel_list_domains",
        description: "List domains for a Vercel project",
        parameters: {
          type: "object",
          properties: {
            project_id: {
              type: "string",
              description: "Project ID or name",
            },
          },
          required: ["project_id"],
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
      return { success: false, error: "No Vercel token configured." };
    }

    const actionMap: Record<string, string> = {
      vercel_list_projects: "list_projects",
      vercel_list_deployments: "list_deployments",
      vercel_deploy: "create_deployment",
      vercel_get_deployment: "get_deployment",
      vercel_list_domains: "list_domains",
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

  private deploymentToContext(deployment: VercelDeployment): IntegrationContext {
    const state = deployment.state ?? deployment.readyState ?? "unknown";
    return {
      id: deployment.uid,
      integrationId: this.id,
      title: `${deployment.name} (${state})`,
      content: `Deployment: ${deployment.name} — ${state}`,
      url: deployment.url ? `https://${deployment.url}` : undefined,
      updatedAt: deployment.createdAt
        ? new Date(deployment.createdAt).toISOString()
        : undefined,
    };
  }
}

interface VercelDeployment {
  uid: string;
  name: string;
  url?: string;
  state?: string;
  readyState?: string;
  createdAt?: number;
}
