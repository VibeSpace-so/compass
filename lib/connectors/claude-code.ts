import {
  IntegrationConnector,
  IntegrationContext,
  IntegrationTestResult,
} from "@/lib/integration-service";
import { ChatTool, ToolCallResult, ToolCapableConnector } from "@/lib/tool-types";

export class ClaudeCodeConnector implements IntegrationConnector, ToolCapableConnector {
  readonly id = "claude-code";
  readonly name = "Claude Code";

  isConfigured(): boolean {
    return true;
  }

  async testConnection(): Promise<IntegrationTestResult> {
    return { success: true, message: "Claude Code prompt generator ready." };
  }

  async fetchContext(_query?: string): Promise<IntegrationContext[]> {
    return [];
  }

  getTools(): ChatTool[] {
    return [
      {
        name: "claude_code_generate_prompt",
        description: "Generate a Claude Code task prompt for the current project context",
        parameters: {
          type: "object",
          properties: {
            projectName: { type: "string", description: "Name of the project" },
            description: { type: "string", description: "Project description" },
            stage: { type: "string", description: "Current project stage" },
            task: { type: "string", description: "Task or question for Claude Code" },
            techStack: { type: "string", description: "Tech stack in use (optional)" },
            constraints: {
              type: "array",
              items: { type: "string" },
              description: "Constraints or requirements (optional)",
            },
          },
          required: ["projectName", "description", "stage", "task"],
        },
        integrationId: this.id,
      },
      {
        name: "claude_code_implement_feature",
        description: "Generate implementation instructions for Claude Code to build a feature",
        parameters: {
          type: "object",
          properties: {
            projectName: { type: "string", description: "Name of the project" },
            description: { type: "string", description: "Project description" },
            feature: { type: "string", description: "Feature to implement" },
            techStack: { type: "string", description: "Tech stack in use" },
            acceptanceCriteria: {
              type: "array",
              items: { type: "string" },
              description: "Acceptance criteria for the feature",
            },
            existingPatterns: { type: "string", description: "Existing code patterns to follow (optional)" },
          },
          required: ["projectName", "description", "feature", "techStack"],
        },
        integrationId: this.id,
      },
    ];
  }

  async executeTool(toolName: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    switch (toolName) {
      case "claude_code_generate_prompt":
        return this.generatePrompt(params);
      case "claude_code_implement_feature":
        return this.implementFeature(params);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  }

  private generatePrompt(params: Record<string, unknown>): ToolCallResult {
    const constraints = (params.constraints as string[]) ?? [];
    const constraintList = constraints.length > 0
      ? `\nConstraints:\n${constraints.map((c) => `- ${c}`).join("\n")}`
      : "";
    const techNote = params.techStack
      ? `\nTech Stack: ${params.techStack as string}`
      : "";

    const prompt = `Project: ${params.projectName as string}
Description: ${params.description as string}
Stage: ${params.stage as string}${techNote}

Task: ${params.task as string}${constraintList}

Guidelines:
- Read the existing codebase before making changes
- Match the project's coding style and conventions
- Use the project's existing dependencies where possible
- Write comprehensive error handling
- Keep changes minimal and focused on the task
- Run tests after making changes if a test suite exists`;

    return { success: true, data: prompt };
  }

  private implementFeature(params: Record<string, unknown>): ToolCallResult {
    const criteria = (params.acceptanceCriteria as string[]) ?? [];
    const criteriaList = criteria.length > 0
      ? `\nAcceptance Criteria:\n${criteria.map((c) => `- [ ] ${c}`).join("\n")}`
      : "";
    const patternsNote = params.existingPatterns
      ? `\nExisting Patterns to Follow: ${params.existingPatterns as string}`
      : "";

    const prompt = `Implement the following feature in the "${params.projectName as string}" project.

Project Description: ${params.description as string}
Tech Stack: ${params.techStack as string}${patternsNote}

Feature: ${params.feature as string}${criteriaList}

Implementation Plan:
1. Analyze the existing codebase structure and identify where the feature fits
2. Create or modify the necessary files
3. Implement the core logic with proper TypeScript types
4. Add error handling and edge case management
5. Ensure the feature integrates with existing code without breaking changes
6. Run the build to verify no compilation errors
7. Test the feature manually if no automated tests exist

Keep the implementation clean, type-safe, and consistent with the rest of the codebase.`;

    return { success: true, data: prompt };
  }
}
