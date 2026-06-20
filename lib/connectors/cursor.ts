import {
  IntegrationConnector,
  IntegrationContext,
  IntegrationTestResult,
} from "@/lib/integration-service";
import { ChatTool, ToolCallResult, ToolCapableConnector } from "@/lib/tool-types";

export class CursorConnector implements IntegrationConnector, ToolCapableConnector {
  readonly id = "cursor";
  readonly name = "Cursor";

  isConfigured(): boolean {
    return true;
  }

  async testConnection(): Promise<IntegrationTestResult> {
    return { success: true, message: "Cursor prompt generator ready." };
  }

  async fetchContext(_query?: string): Promise<IntegrationContext[]> {
    return [];
  }

  getTools(): ChatTool[] {
    return [
      {
        name: "cursor_generate_prompt",
        description: "Generate a Cursor Composer prompt tailored to the current project stage",
        parameters: {
          type: "object",
          properties: {
            projectName: { type: "string", description: "Name of the project" },
            description: { type: "string", description: "Project description" },
            stage: { type: "string", description: "Current project stage" },
            task: { type: "string", description: "Specific task or feature to implement" },
            techStack: { type: "string", description: "Tech stack in use (optional)" },
            existingFiles: {
              type: "array",
              items: { type: "string" },
              description: "Key files to reference (optional)",
            },
          },
          required: ["projectName", "description", "stage", "task"],
        },
        integrationId: this.id,
      },
      {
        name: "cursor_setup_project",
        description: "Generate setup instructions for a new project in Cursor",
        parameters: {
          type: "object",
          properties: {
            projectName: { type: "string", description: "Name of the project" },
            description: { type: "string", description: "Project description" },
            techStack: { type: "string", description: "Desired tech stack" },
            features: {
              type: "array",
              items: { type: "string" },
              description: "Initial features to scaffold",
            },
          },
          required: ["projectName", "description", "techStack"],
        },
        integrationId: this.id,
      },
    ];
  }

  async executeTool(toolName: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    switch (toolName) {
      case "cursor_generate_prompt":
        return this.generatePrompt(params);
      case "cursor_setup_project":
        return this.setupProject(params);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  }

  private generatePrompt(params: Record<string, unknown>): ToolCallResult {
    const filesRef = (params.existingFiles as string[]) ?? [];
    const filesNote = filesRef.length > 0
      ? `\nRelevant files to reference:\n${filesRef.map((f) => `- ${f}`).join("\n")}`
      : "";
    const techNote = params.techStack
      ? `\nTech Stack: ${params.techStack as string}`
      : "";

    const prompt = `@Composer

Project: ${params.projectName as string}
Description: ${params.description as string}
Stage: ${params.stage as string}${techNote}

Task: ${params.task as string}${filesNote}

Instructions:
1. Analyze the existing codebase structure before making changes
2. Follow the project's existing patterns and conventions
3. Write type-safe TypeScript code
4. Include proper error handling
5. Add brief inline comments only where logic is non-obvious
6. Ensure changes are backwards-compatible where possible

Output the complete implementation with all necessary file changes.`;

    return { success: true, data: prompt };
  }

  private setupProject(params: Record<string, unknown>): ToolCallResult {
    const features = (params.features as string[]) ?? [];
    const featureList = features.length > 0
      ? `\nInitial Features:\n${features.map((f) => `- ${f}`).join("\n")}`
      : "";

    const prompt = `@Composer

Set up a new project called "${params.projectName as string}".

Description: ${params.description as string}
Tech Stack: ${params.techStack as string}${featureList}

Setup Requirements:
1. Initialize the project with the specified tech stack
2. Configure TypeScript with strict mode
3. Set up linting (ESLint) and formatting (Prettier)
4. Create the folder structure following best practices
5. Add a .gitignore appropriate for the stack
6. Include a README.md with setup instructions
7. Add initial component/module scaffolding
8. Configure environment variables template (.env.example)

Start with the project initialization and core structure, then scaffold the initial features.`;

    return { success: true, data: prompt };
  }
}
