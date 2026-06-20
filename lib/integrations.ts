import { Integration, StageId } from "./types";

export const DEFAULT_INTEGRATIONS: Integration[] = [
  // Context
  {
    id: "notion",
    name: "Notion",
    category: "context",
    description: "Import pages, databases, and project docs as context.",
    connected: false,
    url: "https://notion.so",
  },
  {
    id: "gdocs",
    name: "Google Docs",
    category: "context",
    description: "Pull specs, briefs, and shared documents.",
    connected: false,
    url: "https://docs.google.com",
  },

  // Communication
  {
    id: "slack",
    name: "Slack",
    category: "communication",
    description: "Surface relevant threads and decisions from channels.",
    connected: false,
    url: "https://slack.com",
  },
  {
    id: "discord",
    name: "Discord",
    category: "communication",
    description: "Pull context from community and team discussions.",
    connected: false,
    url: "https://discord.com",
  },

  // Design
  {
    id: "figma",
    name: "Figma",
    category: "design",
    description: "Reference designs, components, and design tokens.",
    connected: false,
    url: "https://figma.com",
  },

  // Build & Deploy
  {
    id: "vercel",
    name: "Vercel",
    category: "build",
    description: "Deploy and manage frontend projects.",
    connected: false,
    url: "https://vercel.com",
  },
  {
    id: "lovable",
    name: "Lovable",
    category: "build",
    description: "AI-powered full-stack app builder.",
    connected: false,
    url: "https://lovable.dev",
  },
  {
    id: "cursor",
    name: "Cursor",
    category: "build",
    description: "AI-first code editor for fast iteration.",
    connected: false,
    url: "https://cursor.com",
  },
  {
    id: "claude-code",
    name: "Claude Code",
    category: "build",
    description: "Agentic coding tool from Anthropic.",
    connected: false,
    url: "https://docs.anthropic.com/en/docs/claude-code",
  },
  {
    id: "codex",
    name: "Codex",
    category: "build",
    description: "OpenAI's cloud software engineering agent.",
    connected: false,
    url: "https://openai.com/index/introducing-codex/",
  },
  {
    id: "devin",
    name: "Devin",
    category: "build",
    description: "Autonomous AI software engineer.",
    connected: false,
    url: "https://devin.ai",
  },
  {
    id: "base44",
    name: "Base44",
    category: "build",
    description: "AI app development platform.",
    connected: false,
    url: "https://base44.com",
  },
];

export const CATEGORY_LABELS: Record<string, string> = {
  context: "Context sources",
  communication: "Communication",
  design: "Design",
  build: "Build & Deploy",
};

export interface StageSuggestion {
  integrationId: string;
  purpose: string;
  outcome: string;
}

export const STAGE_SUGGESTIONS: Record<StageId, StageSuggestion[]> = {
  ideation: [
    {
      integrationId: "notion",
      purpose: "Pull your brainstorming notes and idea docs into Compass.",
      outcome: "Your ideas stay organized and accessible as you refine your concept.",
    },
    {
      integrationId: "gdocs",
      purpose: "Import shared docs where you've been drafting ideas with collaborators.",
      outcome: "Keep all ideation context in one place without switching tabs.",
    },
    {
      integrationId: "discord",
      purpose: "Surface feedback and ideas from your community discussions.",
      outcome: "Validate your idea with real signals from people who care.",
    },
  ],
  context: [
    {
      integrationId: "notion",
      purpose: "Pull your project briefs, specs, and research notes.",
      outcome: "Your AI tools get better context, leading to better output.",
    },
    {
      integrationId: "gdocs",
      purpose: "Import requirements docs and shared specifications.",
      outcome: "All your project context lives alongside your guidance.",
    },
    {
      integrationId: "figma",
      purpose: "Reference your wireframes and design explorations.",
      outcome: "Visual context helps you make better technical decisions.",
    },
    {
      integrationId: "slack",
      purpose: "Pull decisions and conversations from project channels.",
      outcome: "Never lose track of why a decision was made.",
    },
  ],
  "landing-page": [
    {
      integrationId: "lovable",
      purpose: "Generate a landing page from your project brief.",
      outcome: "Go from idea to live page in minutes, not hours.",
    },
    {
      integrationId: "cursor",
      purpose: "Use AI-assisted coding to customize your landing page.",
      outcome: "Full control over your page with AI doing the heavy lifting.",
    },
    {
      integrationId: "figma",
      purpose: "Reference your design mockups while building.",
      outcome: "Your landing page matches your vision from the start.",
    },
    {
      integrationId: "vercel",
      purpose: "Preview your landing page with instant deploys.",
      outcome: "See your changes live as you iterate on the design.",
    },
  ],
  github: [
    {
      integrationId: "cursor",
      purpose: "Push code to GitHub directly from your editor.",
      outcome: "Seamless version control without leaving your workflow.",
    },
    {
      integrationId: "devin",
      purpose: "Let Devin set up your repo structure and CI pipeline.",
      outcome: "Professional repo setup without the manual configuration.",
    },
    {
      integrationId: "claude-code",
      purpose: "Generate a README and project documentation.",
      outcome: "Your repo is well-documented from day one.",
    },
  ],
  hosting: [
    {
      integrationId: "vercel",
      purpose: "Deploy your project with one click from GitHub.",
      outcome: "Your project is live and accessible to users in minutes.",
    },
    {
      integrationId: "devin",
      purpose: "Let Devin configure your deployment pipeline.",
      outcome: "Automated deploys on every push — no manual work.",
    },
    {
      integrationId: "slack",
      purpose: "Get deploy notifications in your team channel.",
      outcome: "Everyone knows when new versions go live.",
    },
  ],
  domain: [
    {
      integrationId: "vercel",
      purpose: "Connect a custom domain to your Vercel deployment.",
      outcome: "Your project has a real URL that users can remember.",
    },
  ],
  "build-prototype": [
    {
      integrationId: "cursor",
      purpose: "Build your prototype with AI-powered code editing.",
      outcome: "Ship features faster with AI handling boilerplate and patterns.",
    },
    {
      integrationId: "lovable",
      purpose: "Generate full-stack features from natural language prompts.",
      outcome: "Turn feature descriptions into working code quickly.",
    },
    {
      integrationId: "claude-code",
      purpose: "Use Claude Code to implement complex features and refactor.",
      outcome: "Tackle harder engineering problems with an AI pair programmer.",
    },
    {
      integrationId: "codex",
      purpose: "Let Codex handle feature implementation autonomously.",
      outcome: "Parallelize development by delegating tasks to AI agents.",
    },
    {
      integrationId: "devin",
      purpose: "Assign entire feature branches to Devin for implementation.",
      outcome: "Scale your development capacity without hiring.",
    },
    {
      integrationId: "base44",
      purpose: "Build and iterate on features using a visual AI platform.",
      outcome: "Non-technical teammates can contribute to the build.",
    },
    {
      integrationId: "figma",
      purpose: "Reference your design system while building components.",
      outcome: "Your prototype matches the intended design language.",
    },
    {
      integrationId: "notion",
      purpose: "Pull feature specs and user stories as you build.",
      outcome: "Stay aligned with requirements without context-switching.",
    },
  ],
  "next-features": [
    {
      integrationId: "notion",
      purpose: "Pull your feature backlog and roadmap into Compass.",
      outcome: "Prioritize features with full context on user needs.",
    },
    {
      integrationId: "slack",
      purpose: "Surface feature requests from user conversations.",
      outcome: "Build what users actually ask for, not what you assume.",
    },
    {
      integrationId: "discord",
      purpose: "Track community feedback and feature discussions.",
      outcome: "Your roadmap is informed by real community signals.",
    },
    {
      integrationId: "cursor",
      purpose: "Start implementing prioritized features immediately.",
      outcome: "Go from decision to code without friction.",
    },
    {
      integrationId: "devin",
      purpose: "Delegate feature implementation to Devin.",
      outcome: "Ship more features in parallel while you focus on strategy.",
    },
  ],
};

export function getSuggestionsForStage(stageId: StageId): StageSuggestion[] {
  return STAGE_SUGGESTIONS[stageId] || [];
}
