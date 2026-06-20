import { Integration } from "./types";

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
