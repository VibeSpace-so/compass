import {
  IntegrationConnector,
  IntegrationContext,
  IntegrationTestResult,
} from "@/lib/integration-service";
import { ChatTool, ToolCallResult, ToolCapableConnector } from "@/lib/tool-types";

export class CodexConnector implements IntegrationConnector, ToolCapableConnector {
  readonly id = "codex";
  readonly name = "Codex";

  isConfigured(): boolean {
    return true;
  }

  async testConnection(): Promise<IntegrationTestResult> {
    return { success: true, message: "Codex prompt generator ready." };
  }

  async fetchContext(_query?: string): Promise<IntegrationContext[]> {
    return [];
  }

  getTools(): ChatTool[] {
    return [
      {
        name: "codex_generate_task",
        description: "Generate a Codex task description from project context",
        parameters: {
          type: "object",
          properties: {
            projectName: { type: "string", description: "Name of the project" },
            description: { type: "string", description: "Project description" },
            stage: { type: "string", description: "Current project stage" },
            task: { type: "string", description: "Task to accomplish" },
            techStack: { type: "string", description: "Tech stack in use (optional)" },
          },
          required: ["projectName", "description", "stage", "task"],
        },
        integrationId: this.id,
      },
      {
        name: "codex_implement_feature",
        description: "Generate a feature implementation prompt for Codex",
        parameters: {
          type: "object",
          properties: {
            projectName: { type: "string", description: "Name of the project" },
            description: { type: "string", description: "Project description" },
            feature: { type: "string", description: "Feature to implement" },
            techStack: { type: "string", description: "Tech stack in use" },
            scope: { type: "string", description: "Scope: small, medium, or large (optional)" },
            requirements: {
              type: "array",
              items: { type: "string" },
              description: "Specific requirements (optional)",
            },
          },
          required: ["projectName", "description", "feature", "techStack"],
        },
        integrationId: this.id,
      },
    ];
  }

  async executeTool(toolName: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    switch (toolName) {
      case "codex_generate_task":
        return this.generateTask(params);
      case "codex_implement_feature":
        return this.implementFeature(params);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  }

  private generateTask(params: Record<string, unknown>): ToolCallResult {
    const techNote = params.techStack
      ? `\nTech Stack: ${params.techStack as string}`
      : "";

    const prompt = `Project: ${params.projectName as string}
Description: ${params.description as string}
Stage: ${params.stage as string}${techNote}

Task: ${params.task as string}

Instructions for Codex:
1. Understand the project structure and existing code
2. Implement the task following the project's conventions
3. Write clean, readable code with proper types
4. Handle errors gracefully
5. Minimize the number of files changed
6. Verify the changes compile without errors`;

    return { success: true, data: prompt };
  }

  private implementFeature(params: Record<string, unknown>): ToolCallResult {
    const scope = (params.scope as string) ?? "medium";
    const requirements = (params.requirements as string[]) ?? [];
    const reqList = requirements.length > 0
      ? `\nRequirements:\n${requirements.map((r) => `- ${r}`).join("\n")}`
      : "";

    const prompt = `Implement a feature in "${params.projectName as string}".

Project Description: ${params.description as string}
Tech Stack: ${params.techStack as string}
Scope: ${scope}

Feature: ${params.feature as string}${reqList}

Implementation Guidelines:
1. Read the existing codebase to understand patterns and conventions
2. Plan the implementation before writing code
3. Create necessary files and modify existing ones as needed
4. Use TypeScript with strict typing — avoid \`any\`
5. Follow the existing project structure
6. Add error handling for edge cases
7. Ensure backward compatibility with existing features
8. Run build verification after implementation

Keep the change set focused and minimal. Prefer extending existing abstractions over creating new ones.`;

    return { success: true, data: prompt };
  }
}
