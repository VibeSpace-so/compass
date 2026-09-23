import { StageMetadata } from "./types";

export const STAGES: StageMetadata[] = [
  {
    id: "ideation",
    label: "Ideation",
    description: "Validate the problem before anything gets built: who has it, how painful it is, and why it's worth solving.",
    lucideIcon: "Lightbulb",
    risk: "low",
    complexity: "low",
    nextAction: "Write the problem in one sentence: who has it, how painful it is, and what they do about it today.",
    tools: ["Perplexity", "ChatGPT", "Claude", "Notion", "Google Docs"],
    links: [
      { label: "How to validate an idea fast", url: "https://www.ycombinator.com/library/8h-how-to-get-startup-ideas" },
      { label: "How to talk to users", url: "https://www.ycombinator.com/library/6g-how-to-talk-to-users" },
    ],
    debtNote: "Building on an unvalidated problem is the most expensive mistake a vibe coder can make — you pay for features nobody wants.",
  },
  {
    id: "context",
    label: "Context",
    description: "Build and refine the context your AI tools will need — brief, research, constraints. Still no features.",
    lucideIcon: "FileText",
    risk: "low",
    complexity: "medium",
    nextAction: "Fill in the project brief: problem evidence, target user, constraints, and what 'validated' looks like for you.",
    tools: ["Perplexity", "Notion", "Google Docs", "Claude"],
    links: [
      { label: "Writing effective AI prompts", url: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview" },
      { label: "Context-first development", url: "https://cursor.com/blog/context" },
    ],
    debtNote: "Context debt is real: AI tools build what the brief says, not what you meant. Rich context here means the first build lands close.",
  },
  {
    id: "landing-page",
    label: "Landing Page",
    description: "Validate demand for the solution with the cheapest real test: a page, a pitch, and a call to action.",
    lucideIcon: "Layout",
    risk: "low",
    complexity: "medium",
    nextAction: "Ship a one-page pitch and collect signups or replies — that response is your PMF signal, not vibes.",
    tools: ["Lovable", "Bolt", "v0.dev", "Framer"],
    links: [
      { label: "Landing page best practices", url: "https://unbounce.com/landing-page-articles/landing-page-best-practices/" },
      { label: "Lovable quickstart", url: "https://docs.lovable.dev" },
    ],
    debtNote: "A page is cheap; features are not. A landing page tests whether anyone wants the solution before you build it.",
  },
  {
    id: "github",
    label: "GitHub",
    description: "Version-control your validation work — even a one-page site deserves a repo.",
    lucideIcon: "GitBranch",
    risk: "low",
    complexity: "low",
    nextAction: "Create a GitHub repo, push your code, and write a README that states the problem you're validating.",
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
    description: "Get the validation page live where real people can react to it.",
    lucideIcon: "Rocket",
    risk: "medium",
    complexity: "medium",
    nextAction: "Deploy the page and share the link where your target users actually are — measure signups, replies, objections.",
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
    description: "A real URL makes the demand test credible — and keeps collecting signal while you decide whether to build.",
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
    description: "Build the smallest prototype that tests your validated solution — only now, because the demand evidence earned it.",
    lucideIcon: "Hammer",
    risk: "medium",
    complexity: "high",
    nextAction: "Pick the ONE feature your validation evidence points to, and build just that.",
    tools: ["Cursor", "Lovable", "Bolt", "Replit", "Windsurf"],
    links: [
      { label: "Cursor docs", url: "https://docs.cursor.com" },
      { label: "Bolt.new guide", url: "https://docs.bolt.new" },
      { label: "How to build an MVP", url: "https://www.ycombinator.com/library/4Q-a-minimum-viable-product-is-not-a-product-it-s-a-process" },
    ],
    debtNote: "This is where technical debt accumulates fastest. Building before validation is the most expensive shortcut — the demand evidence in your memories should justify every feature.",
  },
  {
    id: "next-features",
    label: "Next Features",
    description: "Grow only what users asked for — validated learning in, code out — while shaping the product's design direction.",
    lucideIcon: "Sparkles",
    risk: "high",
    complexity: "high",
    nextAction: "Set up the feedback loop first: one place users report, one weekly triage, one way you tell them it shipped.",
    tools: ["Linear", "Notion", "GitHub Issues", "Cursor", "PostHog", "Canny", "Figma"],
    links: [
      { label: "Continuous discovery habits", url: "https://www.producttalk.org/" },
      { label: "Prioritization frameworks", url: "https://www.productplan.com/glossary/prioritization-frameworks/" },
      { label: "Ship fast, learn faster", url: "https://www.ycombinator.com/library/4D-yc-s-essential-startup-advice" },
    ],
    debtNote: "This is the highest-debt stage. Every feature you add increases maintenance cost. Be ruthless about scope.",
  },
  {
    id: "grow-scale",
    label: "Grow & Scale",
    description: "The app is live with real users — now harden it: reliability, security, and a scaling plan before growth makes weaknesses expensive.",
    lucideIcon: "TrendingUp",
    risk: "high",
    complexity: "high",
    nextAction: "Run a launch-hardening pass: error monitoring on, security checklist done, a backup restored (not just made), and your single biggest scaling worry written down.",
    tools: ["Sentry", "PostHog", "Vercel", "GitHub Actions", "Upstash", "Clerk", "Linear"],
    links: [
      { label: "OWASP cheat sheets", url: "https://cheatsheetseries.owasp.org/" },
      { label: "Postmortem culture", url: "https://sre.google/sre-book/postmortem-culture/" },
      { label: "Choose boring technology", url: "http://boringtechnology.club/" },
    ],
    debtNote: "Operational debt compounds silently: no monitoring means users find your bugs first, untested backups mean one bad deploy is fatal, and no incident plan makes every outage last 3x longer.",
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
