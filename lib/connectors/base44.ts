import {
  IntegrationConnector,
  IntegrationContext,
  IntegrationTestResult,
} from "@/lib/integration-service";
import { ChatTool, ToolCallResult, ToolCapableConnector } from "@/lib/tool-types";

export class Base44Connector implements IntegrationConnector, ToolCapableConnector {
  readonly id = "base44";
  readonly name = "Base44";

  isConfigured(): boolean {
    return true;
  }

  async testConnection(): Promise<IntegrationTestResult> {
    return { success: true, message: "Base44 prompt generator ready." };
  }

  async fetchContext(_query?: string): Promise<IntegrationContext[]> {
    return [];
  }

  getTools(): ChatTool[] {
    return [
      {
        name: "base44_generate_app",
        description: "Generate a Base44 app creation prompt from project context",
        parameters: {
          type: "object",
          properties: {
            projectName: { type: "string", description: "Name of the app" },
            description: { type: "string", description: "App description and purpose" },
            stage: { type: "string", description: "Current project stage" },
            entities: {
              type: "array",
              items: { type: "string" },
              description: "Data entities/models for the app (optional)",
            },
            userFlows: {
              type: "array",
              items: { type: "string" },
              description: "Key user flows (optional)",
            },
          },
          required: ["projectName", "description", "stage"],
        },
        integrationId: this.id,
      },
      {
        name: "base44_add_feature",
        description: "Generate a Base44 prompt for adding a feature to an existing app",
        parameters: {
          type: "object",
          properties: {
            projectName: { type: "string", description: "Name of the existing app" },
            feature: { type: "string", description: "Feature to add" },
            description: { type: "string", description: "Detailed feature description" },
            existingEntities: {
              type: "array",
              items: { type: "string" },
              description: "Existing data entities in the app (optional)",
            },
          },
          required: ["projectName", "feature", "description"],
        },
        integrationId: this.id,
      },
    ];
  }

  async executeTool(toolName: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    switch (toolName) {
      case "base44_generate_app":
        return this.generateApp(params);
      case "base44_add_feature":
        return this.addFeature(params);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  }

  private generateApp(params: Record<string, unknown>): ToolCallResult {
    const entities = (params.entities as string[]) ?? [];
    const entityList = entities.length > 0
      ? `\nData Entities:\n${entities.map((e) => `- ${e}`).join("\n")}`
      : "";
    const flows = (params.userFlows as string[]) ?? [];
    const flowList = flows.length > 0
      ? `\nKey User Flows:\n${flows.map((f) => `- ${f}`).join("\n")}`
      : "";

    const prompt = `Create an app called "${params.projectName as string}" on Base44.

Description: ${params.description as string}
Stage: ${params.stage as string}${entityList}${flowList}

App Requirements:
- Clean, intuitive user interface
- CRUD operations for all data entities
- Form validation on all inputs
- Responsive layout for mobile and desktop
- Dashboard or home view with key metrics
- Navigation between sections
- Search and filter capabilities where applicable

Design: Modern, clean, and professional. Prioritize usability over visual complexity.`;

    return { success: true, data: prompt };
  }

  private addFeature(params: Record<string, unknown>): ToolCallResult {
    const existing = (params.existingEntities as string[]) ?? [];
    const existingList = existing.length > 0
      ? `\nExisting Entities:\n${existing.map((e) => `- ${e}`).join("\n")}`
      : "";

    const prompt = `Add a new feature to the "${params.projectName as string}" app on Base44.

Feature: ${params.feature as string}
Description: ${params.description as string}${existingList}

Requirements:
- Integrate with existing app structure and navigation
- Reuse existing data entities where possible
- Add new entities only if necessary
- Include proper form validation
- Handle error states gracefully
- Maintain consistent styling with the rest of the app
- Ensure the feature is accessible from the main navigation`;

    return { success: true, data: prompt };
  }
}
