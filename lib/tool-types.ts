import { IntegrationConnector } from "@/lib/integration-service";

export interface ChatTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
  integrationId: string;
}

export interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ToolCapableConnector extends IntegrationConnector {
  getTools(): ChatTool[];
  executeTool(
    toolName: string,
    params: Record<string, unknown>
  ): Promise<ToolCallResult>;
}
