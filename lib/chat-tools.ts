import { ChatTool, ToolCallResult, ToolCapableConnector } from "./tool-types";
import { getIntegrationRegistry } from "./integration-service";

/**
 * Collect all available tools from configured connectors that implement
 * the ToolCapableConnector interface.
 */
export function getAvailableTools(): ChatTool[] {
  const registry = getIntegrationRegistry();
  const configured = registry.getConfiguredConnectors();
  const tools: ChatTool[] = [];

  for (const connector of configured) {
    if (
      "getTools" in connector &&
      typeof (connector as ToolCapableConnector).getTools === "function"
    ) {
      tools.push(...(connector as ToolCapableConnector).getTools());
    }
  }

  return tools;
}

/**
 * Execute a named tool by finding the connector that owns it and
 * delegating the call.
 */
export async function executeTool(
  toolName: string,
  params: Record<string, unknown>
): Promise<ToolCallResult> {
  const registry = getIntegrationRegistry();
  const configured = registry.getConfiguredConnectors();

  for (const connector of configured) {
    if (
      "executeTool" in connector &&
      typeof (connector as ToolCapableConnector).executeTool === "function"
    ) {
      const toolConnector = connector as ToolCapableConnector;
      const tools = toolConnector.getTools();
      if (tools.some((t) => t.name === toolName)) {
        return toolConnector.executeTool(toolName, params);
      }
    }
  }

  return {
    success: false,
    error: `Tool '${toolName}' not found or integration not configured.`,
  };
}

/**
 * Convert ChatTools to the OpenAI / Groq function-calling format.
 */
export function toolsToOpenAIFormat(
  tools: ChatTool[]
): { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } }[] {
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/**
 * Convert ChatTools to Anthropic's tool format.
 */
export function toolsToAnthropicFormat(
  tools: ChatTool[]
): { name: string; description: string; input_schema: Record<string, unknown> }[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
}

/**
 * Convert ChatTools to Google Gemini functionDeclarations format.
 */
export function toolsToGeminiFormat(
  tools: ChatTool[]
): { functionDeclarations: { name: string; description: string; parameters: Record<string, unknown> }[] } {
  return {
    functionDeclarations: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    })),
  };
}
