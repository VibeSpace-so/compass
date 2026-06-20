export type DebtLevel = "low" | "medium" | "high";

export type StageId =
  | "ideation"
  | "context"
  | "landing-page"
  | "github"
  | "hosting"
  | "domain"
  | "build-prototype"
  | "next-features";

export interface StageMetadata {
  id: StageId;
  label: string;
  description: string;
  lucideIcon: string;
  risk: DebtLevel;
  complexity: DebtLevel;
  nextAction: string;
  tools: string[];
  links: { label: string; url: string }[];
  debtNote: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  currentStage: StageId;
  notes: string;
  selectedTool: string;
  technicalDebt: DebtLevel;
  cognitiveDebt: DebtLevel;
  createdAt: string;
  updatedAt: string;
}

export interface BYOKProvider {
  id: string;
  name: string;
  enabled: boolean;
  keySet: boolean;
}

export interface BYOKSettings {
  providers: BYOKProvider[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export type IntegrationCategory = "context" | "communication" | "design" | "build";

export interface Integration {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  connected: boolean;
  url?: string;
}

export interface IntegrationContext {
  id: string;
  integrationId: string;
  title: string;
  content: string;
  url?: string;
  updatedAt?: string;
}

export interface IntegrationTestResult {
  success: boolean;
  message: string;
}

export interface AppState {
  projects: Project[];
  selectedProjectId: string | null;
  byokSettings: BYOKSettings;
  integrations: Integration[];
  chatHistory: Record<string, ChatMessage[]>;
}
