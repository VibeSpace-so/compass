import {
  IntegrationConnector,
  IntegrationContext,
  IntegrationTestResult,
} from "@/lib/integration-service";
import { ChatTool, ToolCallResult, ToolCapableConnector } from "@/lib/tool-types";

export class GitHubConnector implements IntegrationConnector, ToolCapableConnector {
  readonly id = "github";
  readonly name = "GitHub";

  isConfigured(): boolean { return true; }
  async testConnection(): Promise<IntegrationTestResult> {
    return { success: true, message: "GitHub project tools ready." };
  }
  async fetchContext(_query?: string): Promise<IntegrationContext[]> { return []; }

  getTools(): ChatTool[] {
    const common = {
      projectName: { type: "string", description: "Name of the project" },
      description: { type: "string", description: "Project description" },
    };
    return [
      {
        name: "github_readme_prompt",
        description: "Generate a complete, copy-ready README.md scaffold for a project.",
        parameters: {
          type: "object",
          properties: {
            ...common,
            stage: { type: "string", description: "Current project stage" },
            techStack: { type: "string", description: "Technology stack (optional)" },
            features: { type: "array", items: { type: "string" }, description: "Project features (optional)" },
          },
          required: ["projectName", "description", "stage"],
        },
        integrationId: this.id,
      },
      {
        name: "github_setup_commands",
        description: "Generate copy-ready shell commands to initialize and push a project to GitHub.",
        parameters: {
          type: "object",
          properties: common,
          required: ["projectName", "description"],
        },
        integrationId: this.id,
      },
    ];
  }

  async executeTool(toolName: string, params: Record<string, unknown>): Promise<ToolCallResult> {
    if (toolName === "github_readme_prompt") {
      const features = (params.features as string[] | undefined) ?? [];
      const stack = params.techStack ? `\n## Tech Stack\n\n${params.techStack}\n` : "";
      const featureSection = features.length
        ? `\n## Features\n\n${features.map((feature) => `- ${feature}`).join("\n")}\n`
        : "\n## Features\n\n- Add your first feature here\n";
      return {
        success: true,
        data: `# ${params.projectName as string}\n\n${params.description as string}\n${featureSection}${stack}\n## Getting Started\n\n### Prerequisites\n\n- Node.js 20+\n- npm\n\n### Installation\n\n\`\`\`bash\n git clone https://github.com/YOUR_USERNAME/${params.projectName as string}.git\n cd ${params.projectName as string}\n npm install\n npm run dev\n\`\`\`\n\nOpen [http://localhost:3000](http://localhost:3000) in your browser.\n\n## License\n\nThis project is licensed under the MIT License.`,
      };
    }
    if (toolName === "github_setup_commands") {
      return {
        success: true,
        data: `# ${params.projectName as string}\n\n${params.description as string}\n\n\`\`\`bash\ngit init\ngit add .\ngit commit -m "Initial commit"\ngit branch -M main\n# Create a new repository at https://github.com/new, then run:\ngit remote add origin https://github.com/YOUR_USERNAME/${params.projectName as string}.git\ngit push -u origin main\n\`\`\`\n\nSuggested .gitignore for a Node/Next.js project:\n\n\`\`\ngitignore\nnode_modules/\n.next/\nout/\n.env\n.env.local\n.vercel/\n*.log\n\`\`\``,
      };
    }
    return { success: false, error: `Unknown tool: ${toolName}` };
  }
}
