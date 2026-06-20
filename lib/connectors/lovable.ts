import {
  IntegrationConnector,
  IntegrationContext,
  IntegrationTestResult,
} from "@/lib/integration-service";
import { ChatTool, ToolCallResult, ToolCapableConnector } from "@/lib/tool-types";

export class LovableConnector implements IntegrationConnector, ToolCapableConnector {
  readonly id = "lovable";
  readonly name = "Lovable";

  isConfigured(): boolean {
    return true;
  }

  async testConnection(): Promise<IntegrationTestResult> {
    return { success: true, message: "Lovable prompt generator ready." };
  }

  async fetchContext(_query?: string): Promise<IntegrationContext[]> {
    return [];
  }

  getTools(): ChatTool[] {
    return [
      {
        name: "lovable_generate_prompt",
        description:
          "Generate a Lovable-ready prompt from project context that can be pasted into lovable.dev",
        parameters: {
          type: "object",
          properties: {
            projectName: { type: "string", description: "Name of the project" },
            description: { type: "string", description: "Project description" },
            stage: { type: "string", description: "Current project stage" },
            features: {
              type: "array",
              items: { type: "string" },
              description: "List of features to include",
            },
            techStack: { type: "string", description: "Preferred tech stack (optional)" },
          },
          required: ["projectName", "description", "stage"],
        },
        integrationId: this.id,
      },
      {
        name: "lovable_landing_page",
        description:
          "Generate a landing page prompt optimized for Lovable with project details",
        parameters: {
          type: "object",
          properties: {
            projectName: { type: "string", description: "Name of the project" },
            description: { type: "string", description: "Project description and value proposition" },
            stage: { type: "string", description: "Current project stage" },
            ctaText: { type: "string", description: "Call-to-action button text (optional)" },
            colorScheme: { type: "string", description: "Preferred color scheme (optional)" },
          },
          required: ["projectName", "description", "stage"],
        },
        integrationId: this.id,
      },
    ];
  }

  async executeTool(toolName: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    switch (toolName) {
      case "lovable_generate_prompt":
        return this.generatePrompt(params);
      case "lovable_landing_page":
        return this.generateLandingPage(params);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  }

  private generatePrompt(params: Record<string, unknown>): ToolCallResult {
    const features = (params.features as string[]) ?? [];
    const featureList = features.length > 0
      ? `\nKey Features:\n${features.map((f) => `- ${f}`).join("\n")}`
      : "";
    const techNote = params.techStack
      ? `\nTech Stack: ${params.techStack as string}`
      : "";

    const prompt = `Build a web application called "${params.projectName as string}".

Description: ${params.description as string}
Stage: ${params.stage as string}${featureList}${techNote}

Requirements:
- Clean, modern UI with intuitive navigation
- Mobile responsive design
- Proper error handling and loading states
- Type-safe implementation with TypeScript
- Component-based architecture

Design Guidelines:
- Use a consistent design system
- Accessible (WCAG 2.1 AA)
- Fast initial load time
- Smooth transitions and micro-interactions`;

    return { success: true, data: prompt };
  }

  private generateLandingPage(params: Record<string, unknown>): ToolCallResult {
    const cta = (params.ctaText as string) ?? "Get Started";
    const color = params.colorScheme
      ? `\nColor Scheme: ${params.colorScheme as string}`
      : "";

    const prompt = `Create a landing page for "${params.projectName as string}".

Description: ${params.description as string}
Stage: ${params.stage as string}${color}

Requirements:
- Hero section with clear value proposition
- Call-to-action button: "${cta}"
- Social proof section (testimonials or metrics)
- Feature highlights with icons
- Clean, modern design
- Mobile responsive
- Fast loading
- SEO-friendly structure

Style: Professional, minimal, focused on conversion.
Layout: Single-page with smooth scroll navigation.`;

    return { success: true, data: prompt };
  }
}
