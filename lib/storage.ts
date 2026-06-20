import { AppState, Project, BYOKProvider, ChatMessage, Integration } from "./types";
import { DEFAULT_INTEGRATIONS } from "./integrations";

const STORAGE_KEY = "vibe-compass-state";
const BYOK_KEYS_PREFIX = "vibe-compass-key-";

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
    parsed.byokSettings.providers = parsed.byokSettings.providers.map((p) => ({
      ...p,
      keySet: !!localStorage.getItem(BYOK_KEYS_PREFIX + p.id),
    }));
    if (!parsed.integrations) {
      parsed.integrations = DEFAULT_INTEGRATIONS;
    }
    if (!parsed.chatHistory) {
      parsed.chatHistory = {};
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

export function saveState(state: AppState): void {
  if (typeof window === "undefined") return;
  const toSave: AppState = {
    ...state,
    byokSettings: {
      providers: state.byokSettings.providers.map(({ id, name, enabled }) => ({
        id,
        name,
        enabled,
        keySet: !!localStorage.getItem(BYOK_KEYS_PREFIX + id),
      })),
    },
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

export function saveBYOKKey(providerId: string, key: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(BYOK_KEYS_PREFIX + providerId, key);
}

export function removeBYOKKey(providerId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(BYOK_KEYS_PREFIX + providerId);
}

export function getBYOKKey(providerId: string): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(BYOK_KEYS_PREFIX + providerId) || "";
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
  const newState: AppState = {
    ...state,
    chatHistory: {
      ...state.chatHistory,
      [projectId]: [...existing, message],
    },
  };
  saveState(newState);
  return newState;
}
