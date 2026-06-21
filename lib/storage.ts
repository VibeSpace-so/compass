import { AppState, Project, BYOKProvider, ChatMessage, Integration, ProjectMemory } from "./types";
import { DEFAULT_INTEGRATIONS } from "./integrations";
import {
  saveEncryptedKey,
  removeEncryptedKey,
  getCachedKey,
  hasCachedKey,
  saveEncryptedChat,
  getCachedChat,
} from "./secure-storage";
import { getCachedMemories } from "./memories";

const STORAGE_KEY = "vibe-compass-state";

const DEFAULT_PROVIDERS: BYOKProvider[] = [
  { id: "openai", name: "OpenAI", enabled: false, keySet: false },
  { id: "anthropic", name: "Anthropic", enabled: false, keySet: false },
  { id: "google", name: "Google Gemini", enabled: false, keySet: false },
  { id: "groq", name: "Groq", enabled: false, keySet: false },
];

function defaultState(): AppState {
  return {
    projects: [],
    selectedProjectId: null,
    byokSettings: { providers: DEFAULT_PROVIDERS },
    integrations: DEFAULT_INTEGRATIONS,
    chatHistory: {},
    memories: {},
  };
}

export function loadState(): AppState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed.byokSettings) {
      parsed.byokSettings = { providers: DEFAULT_PROVIDERS };
    }
    if (!parsed.integrations) {
      parsed.integrations = DEFAULT_INTEGRATIONS;
    }
    if (!parsed.chatHistory) {
      parsed.chatHistory = {};
    }
    if (!parsed.memories) {
      parsed.memories = {};
    }
    parsed.projects = parsed.projects.map((p) => {
      if ((p.currentStage as string) === "build") {
        return { ...p, currentStage: "landing-page" as const };
      }
      return p;
    });
    return parsed;
  } catch {
    return defaultState();
  }
}

/**
 * Load state with per-project provider key status.
 * Call this after unlocking a project to reflect its keys.
 */
export function loadStateForProject(projectId: string): AppState {
  const state = loadState();
  state.byokSettings.providers = state.byokSettings.providers.map((p) => ({
    ...p,
    keySet: hasCachedKey(projectId, "byok-" + p.id),
  }));
  // Load chat from encrypted cache
  const cachedChat = getCachedChat(projectId);
  if (cachedChat.length > 0) {
    state.chatHistory = { ...state.chatHistory, [projectId]: cachedChat };
  }
  // Load memories from encrypted cache
  const cachedMem = getCachedMemories(projectId);
  if (cachedMem.length > 0) {
    state.memories = { ...state.memories, [projectId]: cachedMem };
  }
  return state;
}

export function saveState(state: AppState): void {
  if (typeof window === "undefined") return;
  // Don't persist chatHistory, memories, or keySet in plaintext state — those come from encrypted storage
  const toSave: AppState = {
    ...state,
    byokSettings: {
      providers: state.byokSettings.providers.map(({ id, name, enabled }) => ({
        id,
        name,
        enabled,
        keySet: false, // Always false in persisted state; loaded from cache
      })),
    },
    chatHistory: {}, // Chat is encrypted per-project, not in global state
    memories: {},    // Memories are encrypted per-project
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function createProject(
  state: AppState,
  name: string,
  description: string
): AppState {
  const project: Project = {
    id: generateId(),
    name,
    description,
    currentStage: "ideation",
    notes: "",
    selectedTool: "",
    technicalDebt: "low",
    cognitiveDebt: "low",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const newState: AppState = {
    ...state,
    projects: [...state.projects, project],
    selectedProjectId: project.id,
  };
  saveState(newState);
  return newState;
}

export function updateProject(
  state: AppState,
  id: string,
  updates: Partial<Project>
): AppState {
  const newState: AppState = {
    ...state,
    projects: state.projects.map((p) =>
      p.id === id
        ? { ...p, ...updates, updatedAt: new Date().toISOString() }
        : p
    ),
  };
  saveState(newState);
  return newState;
}

export function deleteProject(state: AppState, id: string): AppState {
  const { [id]: _removed, ...remainingChat } = state.chatHistory;
  const newState: AppState = {
    ...state,
    projects: state.projects.filter((p) => p.id !== id),
    selectedProjectId:
      state.selectedProjectId === id ? null : state.selectedProjectId,
    chatHistory: remainingChat,
  };
  saveState(newState);
  return newState;
}

export function selectProject(state: AppState, id: string | null): AppState {
  const newState: AppState = { ...state, selectedProjectId: id };
  saveState(newState);
  return newState;
}

// --- Per-project BYOK key management ---

export function saveBYOKKey(projectId: string, providerId: string, key: string): void {
  if (typeof window === "undefined") return;
  saveEncryptedKey(projectId, "byok-" + providerId, key).catch(() => {
    // Fail closed: key remains in memory cache only
  });
}

export function removeBYOKKey(projectId: string, providerId: string): void {
  if (typeof window === "undefined") return;
  removeEncryptedKey(projectId, "byok-" + providerId);
}

export function getBYOKKey(projectId: string, providerId: string): string {
  if (typeof window === "undefined") return "";
  return getCachedKey(projectId, "byok-" + providerId);
}

export function toggleProvider(
  state: AppState,
  providerId: string
): AppState {
  const newState: AppState = {
    ...state,
    byokSettings: {
      providers: state.byokSettings.providers.map((p) =>
        p.id === providerId ? { ...p, enabled: !p.enabled } : p
      ),
    },
  };
  saveState(newState);
  return newState;
}

export function hasAnyKeyConfigured(state: AppState): boolean {
  return state.byokSettings.providers.some(
    (p) => p.enabled && p.keySet
  );
}

export function toggleIntegration(
  state: AppState,
  integrationId: string
): AppState {
  const newState: AppState = {
    ...state,
    integrations: state.integrations.map((i) =>
      i.id === integrationId ? { ...i, connected: !i.connected } : i
    ),
  };
  saveState(newState);
  return newState;
}

export function addChatMessage(
  state: AppState,
  projectId: string,
  message: ChatMessage
): AppState {
  const existing = state.chatHistory[projectId] || [];
  const newMessages = [...existing, message];
  const newState: AppState = {
    ...state,
    chatHistory: {
      ...state.chatHistory,
      [projectId]: newMessages,
    },
  };
  // Persist encrypted chat (fire-and-forget, cache is already updated)
  saveEncryptedChat(projectId, newMessages).catch(() => {
    // Chat remains in memory only if encryption fails
  });
  saveState(newState);
  return newState;
}
