import {
  ChatMessage,
  DebtLevel,
  MemoryType,
  Project,
  ProjectDoc,
  ProjectDocSectionId,
  ProjectMemory,
  StageId,
} from "./types";
import { STAGES } from "./stages";
import { loadState, saveState, generateId } from "./storage";
import {
  getCachedMemories,
  replaceProjectMemories,
} from "./memories";
import {
  getCachedProjectDoc,
  ensureProjectDoc,
  docToMarkdown,
  replaceProjectDoc,
} from "./project-doc";
import {
  getCachedChat,
  replaceProjectChat,
  isProjectUnlocked,
} from "./secure-storage";
import { isProjectEncrypted } from "./crypto";

const EXPORT_VERSION = 1;

export interface ProjectExport {
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  project: {
    name: string;
    description: string;
    currentStage: StageId;
    technicalDebt: DebtLevel;
    cognitiveDebt: DebtLevel;
    notes: string;
    selectedTool: string;
  };
  memories: ProjectMemory[];
  doc: ProjectDoc;
  chat: ChatMessage[];
}

const MEMORY_TYPES: MemoryType[] = [
  "preference",
  "decision",
  "constraint",
  "context",
  "learning",
  "artifact",
];
const DOC_SECTION_IDS: ProjectDocSectionId[] = [
  "summary",
  "problem",
  "targetUser",
  "techStack",
  "features",
  "decisions",
  "constraints",
  "openQuestions",
  "milestones",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function invalidExport(message: string): never {
  throw new Error(`Invalid project export: ${message}`);
}

function requireString(
  value: unknown,
  field: string,
  allowEmpty = false
): string {
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) {
    invalidExport(`${field} must be a string.`);
  }
  return value;
}

function isStageId(value: unknown): value is StageId {
  return typeof value === "string" && STAGES.some((stage) => stage.id === value);
}

function isDebtLevel(value: unknown): value is DebtLevel {
  return value === "low" || value === "medium" || value === "high";
}

function validateMemories(value: unknown): ProjectMemory[] {
  if (!Array.isArray(value)) invalidExport("memories must be an array.");

  return value.map((item, index) => {
    if (!isRecord(item)) invalidExport(`memory ${index + 1} is invalid.`);
    const type = item.type;
    const stage = item.stage;
    const source = item.source;
    if (!MEMORY_TYPES.includes(type as MemoryType)) {
      invalidExport(`memory ${index + 1} has an invalid type.`);
    }
    if (!isStageId(stage)) {
      invalidExport(`memory ${index + 1} has an invalid stage.`);
    }
    if (source !== "user" && source !== "ai") {
      invalidExport(`memory ${index + 1} has an invalid source.`);
    }

    const memory: ProjectMemory = {
      id: requireString(item.id, `memory ${index + 1} id`),
      type: type as MemoryType,
      content: requireString(item.content, `memory ${index + 1} content`, true),
      stage,
      createdAt: requireString(item.createdAt, `memory ${index + 1} createdAt`),
      source,
    };
    if (item.updatedAt !== undefined) {
      memory.updatedAt = requireString(
        item.updatedAt,
        `memory ${index + 1} updatedAt`
      );
    }
    if (item.pinned !== undefined) {
      if (typeof item.pinned !== "boolean") {
        invalidExport(`memory ${index + 1} pinned must be a boolean.`);
      }
      memory.pinned = item.pinned;
    }
    if (item.tags !== undefined) {
      if (
        !Array.isArray(item.tags) ||
        item.tags.some((tag) => typeof tag !== "string")
      ) {
        invalidExport(`memory ${index + 1} tags must be strings.`);
      }
      memory.tags = item.tags as string[];
    }
    return memory;
  });
}

function validateChat(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) invalidExport("chat must be an array.");

  return value.map((item, index) => {
    if (!isRecord(item)) invalidExport(`chat message ${index + 1} is invalid.`);
    if (item.role !== "user" && item.role !== "assistant" && item.role !== "system") {
      invalidExport(`chat message ${index + 1} has an invalid role.`);
    }
    const message: ChatMessage = {
      id: requireString(item.id, `chat message ${index + 1} id`),
      role: item.role,
      content: requireString(
        item.content,
        `chat message ${index + 1} content`,
        true
      ),
      timestamp: requireString(
        item.timestamp,
        `chat message ${index + 1} timestamp`
      ),
    };
    if (item.toolCalls !== undefined) {
      if (!Array.isArray(item.toolCalls)) {
        invalidExport(`chat message ${index + 1} toolCalls must be an array.`);
      }
      message.toolCalls = item.toolCalls.map((toolCall, toolIndex) => {
        if (!isRecord(toolCall)) {
          invalidExport(
            `chat message ${index + 1} tool call ${toolIndex + 1} is invalid.`
          );
        }
        if (toolCall.status !== "success" && toolCall.status !== "error") {
          invalidExport(
            `chat message ${index + 1} tool call ${toolIndex + 1} has an invalid status.`
          );
        }
        const validated = {
          toolName: requireString(
            toolCall.toolName,
            `chat message ${index + 1} tool call ${toolIndex + 1} toolName`
          ),
          integrationId: requireString(
            toolCall.integrationId,
            `chat message ${index + 1} tool call ${toolIndex + 1} integrationId`,
            true
          ),
          status: toolCall.status,
        } as NonNullable<ChatMessage["toolCalls"]>[number];
        if (toolCall.result !== undefined) {
          validated.result = requireString(
            toolCall.result,
            `chat message ${index + 1} tool call ${toolIndex + 1} result`,
            true
          );
        }
        return validated;
      });
    }
    return message;
  });
}

function validateDoc(value: unknown): ProjectDoc {
  if (!isRecord(value)) invalidExport("doc must be an object.");
  const sections = value.sections;
  if (!Array.isArray(sections)) invalidExport("doc sections must be an array.");

  return {
    projectId: requireString(value.projectId, "doc projectId"),
    updatedAt: requireString(value.updatedAt, "doc updatedAt"),
    sections: sections.map((item, index) => {
      if (!isRecord(item)) invalidExport(`doc section ${index + 1} is invalid.`);
      if (!DOC_SECTION_IDS.includes(item.id as ProjectDocSectionId)) {
        invalidExport(`doc section ${index + 1} has an invalid id.`);
      }
      if (item.source !== "user" && item.source !== "ai") {
        invalidExport(`doc section ${index + 1} has an invalid source.`);
      }
      return {
        id: item.id as ProjectDocSectionId,
        title: requireString(item.title, `doc section ${index + 1} title`),
        content: requireString(
          item.content,
          `doc section ${index + 1} content`,
          true
        ),
        updatedAt: requireString(
          item.updatedAt,
          `doc section ${index + 1} updatedAt`
        ),
        source: item.source,
      };
    }),
  };
}

function parseProjectExport(json: string): ProjectExport {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    invalidExport("file is not valid JSON.");
  }
  if (!isRecord(value) || value.version !== EXPORT_VERSION) {
    invalidExport(`unsupported version (expected ${EXPORT_VERSION}).`);
  }
  if (!isRecord(value.project)) invalidExport("project metadata is missing.");
  if (!isStageId(value.project.currentStage)) {
    invalidExport("project has an invalid stage.");
  }
  if (!isDebtLevel(value.project.technicalDebt) || !isDebtLevel(value.project.cognitiveDebt)) {
    invalidExport("project has an invalid debt level.");
  }

  return {
    version: EXPORT_VERSION,
    exportedAt: requireString(value.exportedAt, "exportedAt"),
    project: {
      name: requireString(value.project.name, "project name"),
      description: requireString(value.project.description, "project description", true),
      currentStage: value.project.currentStage,
      technicalDebt: value.project.technicalDebt,
      cognitiveDebt: value.project.cognitiveDebt,
      notes: requireString(value.project.notes, "project notes", true),
      selectedTool: requireString(
        value.project.selectedTool,
        "project selectedTool",
        true
      ),
    },
    memories: validateMemories(value.memories),
    doc: validateDoc(value.doc),
    chat: validateChat(value.chat),
  };
}

function assertProjectAvailable(projectId: string): void {
  if (isProjectEncrypted(projectId) && !isProjectUnlocked(projectId)) {
    throw new Error("Unlock this project before exporting its data.");
  }
}

function fileStem(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project"
  );
}

function downloadFile(filename: string, content: string, type: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportProject(projectId: string): ProjectExport {
  assertProjectAvailable(projectId);
  const project = loadState().projects.find((item) => item.id === projectId);
  if (!project) throw new Error("Project not found.");

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    project: {
      name: project.name,
      description: project.description,
      currentStage: project.currentStage,
      technicalDebt: project.technicalDebt,
      cognitiveDebt: project.cognitiveDebt,
      notes: project.notes,
      selectedTool: project.selectedTool,
    },
    memories: getCachedMemories(projectId),
    doc: getCachedProjectDoc(projectId) ?? ensureProjectDoc(projectId),
    chat: getCachedChat(projectId),
  };
}

export async function importProject(json: string): Promise<Project> {
  const imported = parseProjectExport(json);
  const state = loadState();
  let projectId = generateId();
  while (state.projects.some((project) => project.id === projectId)) {
    projectId = generateId();
  }
  const now = new Date().toISOString();
  const project: Project = {
    id: projectId,
    name: imported.project.name,
    description: imported.project.description,
    currentStage: imported.project.currentStage,
    notes: imported.project.notes,
    selectedTool: imported.project.selectedTool,
    technicalDebt: imported.project.technicalDebt,
    cognitiveDebt: imported.project.cognitiveDebt,
    createdAt: now,
    updatedAt: now,
  };

  saveState({
    ...state,
    projects: [...state.projects, project],
    selectedProjectId: projectId,
  });
  await replaceProjectMemories(projectId, imported.memories);
  await replaceProjectDoc(projectId, { ...imported.doc, projectId });
  await replaceProjectChat(projectId, imported.chat);
  return project;
}

export function downloadProjectDocMarkdown(
  projectId: string,
  projectName: string
): void {
  assertProjectAvailable(projectId);
  const doc = getCachedProjectDoc(projectId) ?? ensureProjectDoc(projectId);
  downloadFile(`${fileStem(projectName)}.md`, docToMarkdown(doc, projectName), "text/markdown");
}
