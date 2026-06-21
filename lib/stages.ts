import { StageMetadata } from "./types";

export const STAGES: StageMetadata[] = [
  {
    id: "ideation",
    label: "Ideation",
    description: "Define what you're building and why it matters.",
    lucideIcon: "Lightbulb",
    risk: "low",
    complexity: "low",
    nextAction: "Write a one-sentence project description and identify your core user.",
    tools: ["Perplexity", "ChatGPT", "Claude", "Notion", "Google Docs"],
    links: [
      { label: "How to validate an idea fast", url: "https://www.ycombinator.com/library/8h-how-to-get-startup-ideas" },
      { label: "Lean Canvas template", url: "https://leanstack.com/lean-canvas" },
    ],
    debtNote: "Low debt at this stage. Skipping ideation entirely adds cognitive debt later — you'll forget why you started.",
  },
  {
    id: "context",
    label: "Context",
    description: "Gather references, specs, and constraints before building.",
    lucideIcon: "FileText",
    risk: "low",
    complexity: "medium",
    nextAction: "Create a project brief with target user, key features, and constraints.",
    tools: ["Perplexity", "Cursor", "v0.dev", "Claude"],
    links: [
      { label: "Writing effective AI prompts", url: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview" },
      { label: "Context-first development", url: "https://cursor.com/blog/context" },
    ],
    debtNote: "Spending time here reduces technical debt later. Skipping context leads to more rework in the build phase.",
  },
  {
    id: "landing-page",
    label: "Landing Page",
    description: "Build a simple landing page to validate your idea and collect interest.",
    lucideIcon: "Layout",
    risk: "low",
    complexity: "medium",
    nextAction: "Create a single-page site that explains what you're building and has a clear call to action.",
    tools: ["Lovable", "Bolt", "v0.dev", "Framer", "Cursor"],
    links: [
      { label: "Landing page best practices", url: "https://unbounce.com/landing-page-articles/landing-page-best-practices/" },
      { label: "Lovable quickstart", url: "https://docs.lovable.dev" },
    ],
    debtNote: "A landing page is low-debt by nature. Keep it simple — one page, one message, one action.",
  },
  {
    id: "github",
    label: "GitHub",
    description: "Push your code to version control.",
    lucideIcon: "GitBranch",
    risk: "low",
    complexity: "low",
    nextAction: "Create a GitHub repo, push your code, and write a basic README.",
    tools: ["GitHub", "GitHub Desktop", "Git CLI"],
    links: [
      { label: "GitHub quickstart", url: "https://docs.github.com/en/get-started/quickstart" },
      { label: "Good README template", url: "https://github.com/othneildrew/Best-README-Template" },
    ],
    debtNote: "Version control is debt-reducing. The longer you go without it, the more risk you carry.",
  },
  {
    id: "hosting",
    label: "Hosting",
    description: "Deploy your project so others can use it.",
    lucideIcon: "Rocket",
    risk: "medium",
    complexity: "medium",
    nextAction: "Deploy to Vercel, Netlify, or Railway from your GitHub repo.",
    tools: ["Vercel", "Netlify", "Railway", "Cloudflare Pages"],
    links: [
      { label: "Vercel deploy guide", url: "https://vercel.com/docs/getting-started-with-vercel" },
      { label: "Netlify quickstart", url: "https://docs.netlify.com/get-started/" },
    ],
    debtNote: "Hosting adds infra complexity. Keep it simple for now — one-click deploys from GitHub are your friend.",
  },
  {
    id: "domain",
    label: "Domain",
    description: "Set up a custom domain for your project.",
    lucideIcon: "Globe",
    risk: "low",
    complexity: "low",
    nextAction: "Register a domain and point DNS to your hosting provider.",
    tools: ["Namecheap", "Cloudflare", "Google Domains", "Vercel Domains"],
    links: [
      { label: "Vercel custom domains", url: "https://vercel.com/docs/projects/domains" },
      { label: "Cloudflare DNS setup", url: "https://developers.cloudflare.com/dns/manage-dns-records/" },
    ],
    debtNote: "Minimal debt impact. But a custom domain signals you're serious — do it early.",
  },
  {
    id: "build-prototype",
    label: "Build Prototype",
    description: "Build a functional prototype with real features and user flows.",
    lucideIcon: "Hammer",
    risk: "medium",
    complexity: "high",
    nextAction: "Pick your core feature and build a working version users can try.",
    tools: ["Cursor", "Lovable", "Bolt", "Replit", "Windsurf"],
    links: [
      { label: "Cursor docs", url: "https://docs.cursor.com" },
      { label: "Bolt.new guide", url: "https://docs.bolt.new" },
      { label: "How to build an MVP", url: "https://www.ycombinator.com/library/4Q-a-minimum-viable-product-is-not-a-product-it-s-a-process" },
    ],
    debtNote: "This is where technical debt accumulates fastest. Each AI-generated file you don't review adds to the pile. Be deliberate.",
  },
  {
    id: "next-features",
    label: "Next Features",
    description: "Plan and prioritize what comes after the MVP.",
    lucideIcon: "Sparkles",
    risk: "high",
    complexity: "high",
    nextAction: "List three features users actually asked for. Build only those.",
    tools: ["Linear", "Notion", "GitHub Issues", "Cursor"],
    links: [
      { label: "Prioritization frameworks", url: "https://www.productplan.com/glossary/prioritization-frameworks/" },
      { label: "Ship fast, learn faster", url: "https://www.ycombinator.com/library/4D-yc-s-essential-startup-advice" },
    ],
    debtNote: "This is the highest-debt stage. Every feature you add increases maintenance cost. Be ruthless about scope.",
  },
];

export function getStage(id: string): StageMetadata | undefined {
  return STAGES.find((s) => s.id === id);
}

export function getStageIndex(id: string): number {
  return STAGES.findIndex((s) => s.id === id);
}

export function getNextStage(id: string): StageMetadata | undefined {
  const idx = getStageIndex(id);
  return idx >= 0 && idx < STAGES.length - 1 ? STAGES[idx + 1] : undefined;
}

export function getPrevStage(id: string): StageMetadata | undefined {
  const idx = getStageIndex(id);
  return idx > 0 ? STAGES[idx - 1] : undefined;
}
