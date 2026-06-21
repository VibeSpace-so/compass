import { ChatTool, ToolCallResult, ToolCapableConnector } from "./tool-types";
import { getIntegrationRegistry } from "./integration-service";
import { addMemory, updateMemory, getCachedMemories } from "./memories";
import { MemoryType, StageId } from "./types";

// Context holders set by chat-service before each turn
let _activeProjectId: string | null = null;
let _activeStage: StageId | null = null;
let _onStageAdvance: ((newStage: StageId) => void) | null = null;

export function setToolContext(
  projectId: string,
  stage: StageId,
  onStageAdvance?: (newStage: StageId) => void
): void {
  _activeProjectId = projectId;
  _activeStage = stage;
  _onStageAdvance = onStageAdvance || null;
}

/**
 * Built-in system tools always available (memory, research, stage mgmt).
 */
function getSystemTools(): ChatTool[] {
  return [
    {
      name: "save_memory",
      description:
        "Save an important piece of information to the project's core memories. Use this to remember user preferences, decisions, constraints, context, or learnings that should persist across conversations.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["preference", "decision", "constraint", "context", "learning"],
            description: "The type of memory to save.",
          },
          content: {
            type: "string",
            description: "The information to remember (concise, factual).",
          },
        },
        required: ["type", "content"],
      },
      integrationId: "_system",
    },
    {
      name: "update_memory",
      description:
        "Update an existing memory with new information. Use when a previous decision or preference has changed.",
      parameters: {
        type: "object",
        properties: {
          memory_id: {
            type: "string",
            description: "The ID of the memory to update.",
          },
          content: {
            type: "string",
            description: "The updated content.",
          },
        },
        required: ["memory_id", "content"],
      },
      integrationId: "_system",
    },
    {
      name: "advance_stage",
      description:
        "Advance the project to the next stage when the user has completed the key milestones for the current stage. Always confirm with the user before advancing.",
      parameters: {
        type: "object",
        properties: {
          next_stage: {
            type: "string",
            enum: [
              "ideation", "context", "landing-page", "github",
              "hosting", "domain", "build-prototype", "next-features",
            ],
            description: "The stage to advance to.",
          },
          reason: {
            type: "string",
            description: "Brief reason for advancing (what was completed).",
          },
        },
        required: ["next_stage", "reason"],
      },
      integrationId: "_system",
    },
    {
      name: "generate_project_brief",
      description:
        "Generate or update the project brief document based on current memories and context. Returns a structured brief with project summary, target user, features, constraints, and decisions.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      integrationId: "_system",
    },
  ];
}

/**
 * Execute a system tool.
 */
function executeSystemTool(
  toolName: string,
  params: Record<string, unknown>
): ToolCallResult {
  if (!_activeProjectId || !_activeStage) {
    return { success: false, error: "No active project context." };
  }

  const VALID_MEMORY_TYPES: MemoryType[] = [
    "preference", "decision", "constraint", "context", "learning", "artifact",
  ];

  switch (toolName) {
    case "save_memory": {
      const memType = params.type as string;
      const content = params.content as string;
      if (!memType || !content) {
        return { success: false, error: "Missing type or content." };
      }
      if (!VALID_MEMORY_TYPES.includes(memType as MemoryType)) {
        return { success: false, error: `Invalid memory type "${memType}". Must be one of: ${VALID_MEMORY_TYPES.join(", ")}` };
      }
      const memory = addMemory(_activeProjectId, memType as MemoryType, content, _activeStage, "ai");
      return {
        success: true,
        data: { id: memory.id, type: memory.type, content: memory.content },
      };
    }

    case "update_memory": {
      const memoryId = params.memory_id as string;
      const content = params.content as string;
      if (!memoryId || !content) {
        return { success: false, error: "Missing memory_id or content." };
      }
      const updated = updateMemory(_activeProjectId, memoryId, content);
      if (!updated) {
        return { success: false, error: `Memory '${memoryId}' not found.` };
      }
      return { success: true, data: { id: updated.id, content: updated.content } };
    }

    case "advance_stage": {
      const nextStage = params.next_stage as StageId;
      const reason = params.reason as string;
      if (!nextStage) {
        return { success: false, error: "Missing next_stage." };
      }
      if (_onStageAdvance) {
        _onStageAdvance(nextStage);
      }
      // Also save as a memory
      addMemory(
        _activeProjectId,
        "learning",
        `Advanced from ${_activeStage} to ${nextStage}: ${reason}`,
        _activeStage,
        "ai"
      );
      return {
        success: true,
        data: { previousStage: _activeStage, newStage: nextStage, reason },
      };
    }

    case "generate_project_brief": {
      const memories = getCachedMemories(_activeProjectId);
      const decisions = memories.filter((m) => m.type === "decision");
      const constraints = memories.filter((m) => m.type === "constraint");
      const preferences = memories.filter((m) => m.type === "preference");
      const context = memories.filter((m) => m.type === "context");

      const brief = [
        "## Project Brief",
        "",
        `**Decisions:** ${decisions.length > 0 ? decisions.map((d) => d.content).join("; ") : "None yet"}`,
        `**Constraints:** ${constraints.length > 0 ? constraints.map((c) => c.content).join("; ") : "None yet"}`,
        `**Preferences:** ${preferences.length > 0 ? preferences.map((p) => p.content).join("; ") : "None yet"}`,
        `**Context:** ${context.length > 0 ? context.map((c) => c.content).join("; ") : "None yet"}`,
      ].join("\n");

      // Save as artifact memory
      const existingBrief = memories.find(
        (m) => m.type === "artifact" && m.content.startsWith("## Project Brief")
      );
      if (existingBrief) {
        updateMemory(_activeProjectId, existingBrief.id, brief);
      } else {
        addMemory(_activeProjectId, "artifact", brief, _activeStage, "ai");
      }

      return { success: true, data: { brief } };
    }

    default:
      return { success: false, error: `Unknown system tool: ${toolName}` };
  }
}

const SYSTEM_TOOL_NAMES = new Set([
  "save_memory", "update_memory", "advance_stage", "generate_project_brief",
]);

/**
 * Collect all available tools from configured connectors that implement
 * the ToolCapableConnector interface, plus built-in system tools.
 */
export function getAvailableTools(): ChatTool[] {
  const registry = getIntegrationRegistry();
  const configured = registry.getConfiguredConnectors();
  const tools: ChatTool[] = [...getSystemTools()];

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
 * delegating the call. System tools are executed synchronously.
 */
export async function executeTool(
  toolName: string,
  params: Record<string, unknown>
): Promise<ToolCallResult> {
  // Check system tools first
  if (SYSTEM_TOOL_NAMES.has(toolName)) {
    return executeSystemTool(toolName, params);
  }

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
