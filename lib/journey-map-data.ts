import { StageId } from "./types";

// Fixed node positions on the 1000x620 map viewBox — a winding path so the
// journey reads like a route, not a list.
export interface MapRisk {
  title: string;
  detail: string;
  severity: "warn" | "danger";
}

export interface MapStageDef {
  id: StageId;
  x: number;
  y: number;
  milestones: string[];
  risks: MapRisk[];
}

export const MAP_STAGES: MapStageDef[] = [
  {
    id: "ideation",
    x: 90,
    y: 470,
    milestones: [
      "Problem sentence written: who hurts, how much, what they do today",
      "3+ conversations with real people who have the problem",
    ],
    risks: [
      {
        title: "Building for no-one",
        detail:
          "Most failed products had great code and zero users. If you can't name the person who hurts, you're building a hobby.",
        severity: "danger",
      },
      {
        title: "Solution looking for a problem",
        detail:
          "Starting from 'I want to build X' inverts the process. Fall in love with the problem, not your first idea for fixing it.",
        severity: "warn",
      },
    ],
  },
  {
    id: "context",
    x: 205,
    y: 315,
    milestones: [
      "Brief filled: problem, target user, constraints, what 'validated' means",
      "Evidence captured as memories, not just chat scrollback",
    ],
    risks: [
      {
        title: "Vibes over facts",
        detail:
          "An AI building on vague context guesses — and guesses compound into rework downstream.",
        severity: "warn",
      },
      {
        title: "Skipping the brief",
        detail:
          "Every empty section becomes an assumption your tools have to invent later. Context now, or confusion at build time.",
        severity: "warn",
      },
    ],
  },
  {
    id: "landing-page",
    x: 340,
    y: 425,
    milestones: [
      "Page live with one clear value proposition",
      "First real signups, replies, or objections collected",
    ],
    risks: [
      {
        title: "Perfection paralysis",
        detail:
          "Weeks spent tweaking copy nobody has seen yet. A rough page with traffic beats a perfect page with none.",
        severity: "warn",
      },
      {
        title: "Measuring likes, not commitment",
        detail:
          "Compliments are free; signups, replies, and pre-orders are evidence. Optimize for the costly signal.",
        severity: "warn",
      },
    ],
  },
  {
    id: "github",
    x: 455,
    y: 235,
    milestones: [
      "Repo pushed with a README that states the problem",
      "Issues or a board tracking what's validated vs assumed",
    ],
    risks: [
      {
        title: "Repo as junk drawer",
        detail:
          "No README, no structure — future you, collaborators, and AI tools all lose the plot of what this project is.",
        severity: "warn",
      },
    ],
  },
  {
    id: "hosting",
    x: 565,
    y: 350,
    milestones: [
      "Public URL anyone can open",
      "Shared where the target users actually are",
    ],
    risks: [
      {
        title: "Hidden deployment",
        detail:
          "Deployed but never shared is still zero demand evidence. The point of hosting is traffic, not uptime.",
        severity: "warn",
      },
    ],
  },
  {
    id: "domain",
    x: 680,
    y: 195,
    milestones: ["Domain registered and pointed at your hosting"],
    risks: [
      {
        title: "Brand obsession",
        detail:
          "Days hunting the perfect name while demand goes unmeasured. A good-enough name this week beats the perfect name next month.",
        severity: "warn",
      },
    ],
  },
  {
    id: "build-prototype",
    x: 790,
    y: 330,
    milestones: [
      "ONE feature shipped — the one validation pointed to",
      "A real user (not you) tried it and reacted",
    ],
    risks: [
      {
        title: "Feature feast",
        detail:
          "Building everything, validated or not, is the classic startup killer. Evidence picks the feature; vibes don't.",
        severity: "danger",
      },
      {
        title: "Premature scaling",
        detail:
          "Infra for millions of users before the first real one. Scale what hurts, not what might.",
        severity: "warn",
      },
    ],
  },
  {
    id: "next-features",
    x: 875,
    y: 165,
    milestones: [
      "Feedback loop live: one intake, one weekly triage, one ship announcement",
      "Ship → announce → measure cycle running weekly",
    ],
    risks: [
      {
        title: "Loudest voice wins",
        detail:
          "One loud user is a data point, not a roadmap. Weight feedback by how many users share the pain.",
        severity: "warn",
      },
      {
        title: "Feedback void",
        detail:
          "Shipping without a loop means flying blind — you learn nothing from each release.",
        severity: "danger",
      },
    ],
  },
  {
    id: "grow-scale",
    x: 915,
    y: 430,
    milestones: [
      "Error monitoring live with real alerts",
      "Backup restored (tested, not just configured)",
      "Incident runbook + status page written",
    ],
    risks: [
      {
        title: "Security debt cliff",
        detail:
          "A leaked key or unrestorable backup ends companies, not roadmaps. Harden before you're a target.",
        severity: "danger",
      },
      {
        title: "Dashboard for show",
        detail:
          "Monitoring nobody reads isn't monitoring. Alerts you ignore are worse than none — they breed complacency.",
        severity: "warn",
      },
    ],
  },
];

export function getMapStage(id: StageId): MapStageDef | undefined {
  return MAP_STAGES.find((s) => s.id === id);
}

/** The stage the compass recommends walking toward next. */
export function recommendedStage(
  currentStage: StageId,
  currentIndex: number,
  actionCount: number,
  stageThreshold: number,
  hasValidationEvidence: boolean
): StageId {
  const buildIndex = MAP_STAGES.findIndex((s) => s.id === "build-prototype");
  const landingIndex = MAP_STAGES.findIndex((s) => s.id === "landing-page");
  // Building without demand evidence → compass points back to validation.
  if (currentIndex >= buildIndex && !hasValidationEvidence) {
    return MAP_STAGES[landingIndex].id;
  }
  // Under-threshold → stay and capture more.
  if (currentIndex < MAP_STAGES.length - 1 && actionCount < stageThreshold) {
    return currentStage;
  }
  return MAP_STAGES[Math.min(currentIndex + 1, MAP_STAGES.length - 1)].id;
}
