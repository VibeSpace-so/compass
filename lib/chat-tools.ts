import { ChatTool, ToolCallResult, ToolCapableConnector } from "./tool-types";
import { getIntegrationRegistry } from "./integration-service";
import {
  addMemory,
  updateMemory,
  getCachedMemories,
  removeMemory,
  setMemoryFields,
  wordSimilarity,
  NEAR_DUP_THRESHOLD,
} from "./memories";
import { MemoryType, ProjectDocSectionId, StageId } from "./types";
import {
  appendMilestone,
  docToMarkdown,
  ensureProjectDoc,
  getSeededProjectDoc,
  seedDocFromMemories,
  updateDocSection,
} from "./project-doc";

// Context holders set by chat-service before each turn
let _activeProjectId: string | null = null;
let _activeStage: StageId | null = null;
let _activeProjectName = "Project";
let _onStageAdvance: ((newStage: StageId) => void) | null = null;

export function setToolContext(
  projectId: string,
  stage: StageId,
  onStageAdvance?: (newStage: StageId) => void,
  projectName?: string
): void {
  _activeProjectId = projectId;
  _activeStage = stage;
  _onStageAdvance = onStageAdvance || null;
  _activeProjectName = projectName || "Project";
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
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Optional tags for organizing this memory.",
          },
          pinned: {
            type: "boolean",
            description: "Whether to prioritize this memory in Compass context.",
          },
        },
        required: ["type", "content"],
      },
      integrationId: "_system",
    },
    {
      name: "list_memories",
      description: "Search the project's memories and discover IDs for targeted memory operations.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Optional text to search for." },
          type: { type: "string", enum: ["preference", "decision", "constraint", "context", "learning", "artifact"] },
        },
        required: [],
      },
      integrationId: "_system",
    },
    {
      name: "delete_memory",
      description: "Delete a memory by ID when it is obsolete or incorrect.",
      parameters: {
        type: "object",
        properties: { memory_id: { type: "string" } },
        required: ["memory_id"],
      },
      integrationId: "_system",
    },
    {
      name: "supersede_memory",
      description: "Replace an old memory with a new memory and a fresh ID.",
      parameters: {
        type: "object",
        properties: {
          old_memory_id: { type: "string" },
          content: { type: "string" },
          type: { type: "string", enum: ["preference", "decision", "constraint", "context", "learning", "artifact"] },
        },
        required: ["old_memory_id", "content"],
      },
      integrationId: "_system",
    },
    {
      name: "pin_memory",
      description: "Pin or unpin a memory so it is prioritized in Compass context.",
      parameters: {
        type: "object",
        properties: {
          memory_id: { type: "string" },
          pinned: { type: "boolean" },
        },
        required: ["memory_id", "pinned"],
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
        "Generate the living project brief from current memories, then refine its summary, problem, target user, tech stack, features, and open questions with update_project_doc.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
      integrationId: "_system",
    },
    {
      name: "update_project_doc",
      description: "Update one section of the living project document with a clear narrative.",
      parameters: {
        type: "object",
        properties: {
          section: {
            type: "string",
            enum: ["summary", "problem", "targetUser", "techStack", "features", "decisions", "constraints", "openQuestions", "milestones"],
          },
          content: { type: "string" },
        },
        required: ["section", "content"],
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
      const tags = Array.isArray(params.tags) ? params.tags.filter((tag): tag is string => typeof tag === "string") : undefined;
      const pinned = typeof params.pinned === "boolean" ? params.pinned : undefined;
      if (!memType || !content) {
        return { success: false, error: "Missing type or content." };
      }
      if (!VALID_MEMORY_TYPES.includes(memType as MemoryType)) {
        return { success: false, error: `Invalid memory type "${memType}". Must be one of: ${VALID_MEMORY_TYPES.join(", ")}` };
      }
      const normalizedContent = content.trim().replace(/\s+/g, " ").toLowerCase();
      const duplicate = getCachedMemories(_activeProjectId).find(
        (existing) =>
          existing.type === memType &&
          (existing.content.trim().replace(/\s+/g, " ").toLowerCase() === normalizedContent ||
            wordSimilarity(existing.content, content) >= NEAR_DUP_THRESHOLD ||
            existing.content.trim().replace(/\s+/g, " ").toLowerCase().includes(normalizedContent) ||
            normalizedContent.includes(existing.content.trim().replace(/\s+/g, " ").toLowerCase()))
      );
      const memory = addMemory(_activeProjectId, memType as MemoryType, content, _activeStage, "ai", { tags, pinned });
      return {
        success: true,
        data: { id: memory.id, type: memory.type, content: memory.content, ...(duplicate ? { deduped: true } : {}) },
      };
    }

    case "list_memories": {
      const query = typeof params.query === "string" ? params.query : "";
      const type = typeof params.type === "string" ? params.type : undefined;
      const memories = getCachedMemories(_activeProjectId)
        .filter((memory) => !type || memory.type === type)
        .filter((memory) => !query || memory.content.toLowerCase().includes(query.toLowerCase()));
      return {
        success: true,
        data: { memories: memories.map(({ id, type: memoryType, content: memoryContent, pinned }) => ({ id, type: memoryType, content: memoryContent, pinned: Boolean(pinned) })) },
      };
    }

    case "delete_memory": {
      const memoryId = params.memory_id as string;
      if (!memoryId) return { success: false, error: "Missing memory_id." };
      const removed = removeMemory(_activeProjectId, memoryId);
      return removed
        ? { success: true, data: { removed: true, id: memoryId } }
        : { success: false, error: `Memory '${memoryId}' not found.` };
    }

    case "supersede_memory": {
      const oldId = params.old_memory_id as string;
      const oldMemory = getCachedMemories(_activeProjectId).find((memory) => memory.id === oldId);
      const content = params.content as string;
      if (!oldId || !content) return { success: false, error: "Missing old_memory_id or content." };
      if (!oldMemory) return { success: false, error: `Memory '${oldId}' not found.` };
      if (params.type && !VALID_MEMORY_TYPES.includes(params.type as MemoryType)) {
        return { success: false, error: `Invalid memory type "${params.type}".` };
      }
      removeMemory(_activeProjectId, oldId);
      const created = addMemory(
        _activeProjectId,
        (params.type as MemoryType) || oldMemory.type,
        content,
        _activeStage,
        "ai"
      );
      return { success: true, data: { removed: oldId, created: { id: created.id, type: created.type, content: created.content } } };
    }

    case "pin_memory": {
      const memoryId = params.memory_id as string;
      const pinned = params.pinned as boolean;
      const updated = setMemoryFields(_activeProjectId, memoryId, { pinned });
      return updated
        ? { success: true, data: { id: updated.id, pinned: Boolean(updated.pinned) } }
        : { success: false, error: `Memory '${memoryId}' not found.` };
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
      appendMilestone(
        _activeProjectId,
        `Reached ${nextStage}: ${reason} (${new Date().toLocaleDateString()})`
      );
      return {
        success: true,
        data: { previousStage: _activeStage, newStage: nextStage, reason },
      };
    }

    case "generate_project_brief": {
      ensureProjectDoc(_activeProjectId);
      const generatedBrief = docToMarkdown(
        getSeededProjectDoc(_activeProjectId),
        _activeProjectName
      );
      const existingBrief = getCachedMemories(_activeProjectId).find(
        (memory) =>
          memory.type === "artifact" &&
          /^#.*project brief/im.test(memory.content.slice(0, 120))
      );
      if (existingBrief) {
        updateMemory(_activeProjectId, existingBrief.id, generatedBrief);
      } else {
        addMemory(
          _activeProjectId,
          "artifact",
          generatedBrief,
          _activeStage,
          "ai"
        );
      }
      const doc = seedDocFromMemories(_activeProjectId);
      return { success: true, data: { doc: docToMarkdown(doc, _activeProjectName) } };
    }

    case "update_project_doc": {
      const section = params.section as ProjectDocSectionId;
      const content = params.content as string;
      if (!section || !content) return { success: false, error: "Missing section or content." };
      if (!ensureProjectDoc(_activeProjectId).sections.some((item) => item.id === section)) {
        return { success: false, error: `Invalid project document section "${section}".` };
      }
      const updated = updateDocSection(_activeProjectId, section, content, "ai");
      return { success: true, data: { section, updatedAt: updated.updatedAt } };
    }

    default:
      return { success: false, error: `Unknown system tool: ${toolName}` };
  }
}

const SYSTEM_TOOL_NAMES = new Set([
  "save_memory", "list_memories", "update_memory", "delete_memory",
  "supersede_memory", "pin_memory", "advance_stage", "generate_project_brief",
  "update_project_doc",
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
