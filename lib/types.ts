export type DebtLevel = "low" | "medium" | "high";

export type StageId =
  | "ideation"
  | "context"
  | "build"
  | "github"
  | "hosting"
  | "domain"
  | "next-features";

export interface StageMetadata {
  id: StageId;
  label: string;
  description: string;
  icon: string;
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

export interface AppState {
  projects: Project[];
  selectedProjectId: string | null;
  byokSettings: BYOKSettings;
}
