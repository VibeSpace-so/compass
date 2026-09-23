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
    x: 105,
    y: 300,
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
    x: 225,
    y: 375,
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
    x: 350,
    y: 425,
    milestones: [
      "Page live with one clear value proposition",
      "First real signups, replies, or objections collected",
      "Demand signal logged as memories (numbers, not vibes)",
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
      {
        title: "Fake door, real debt",
        detail:
          "A page that promises something you can't deliver collects signups you have to apologize to. Test demand, don't fake it.",
        severity: "danger",
      },
    ],
  },
  {
    id: "github",
    x: 475,
    y: 330,
    milestones: [
      "Repo pushed with a README that states the problem",
      "Issues or a board tracking what's validated vs assumed",
      "Landing page linked from README/socials — clicks become evidence",
    ],
    risks: [
      {
        title: "Repo as junk drawer",
        detail:
          "No README, no structure — future you, collaborators, and AI tools all lose the plot of what this project is.",
        severity: "warn",
      },
      {
        title: "Building in silence",
        detail:
          "Shipping code while collecting zero signal. The repo exists to serve the evidence loop — not the other way around.",
        severity: "warn",
      },
    ],
  },
  {
    id: "hosting",
    x: 590,
    y: 370,
    milestones: [
      "Public URL anyone can open",
      "Shared where the target users actually are",
      "Signup counter or analytics wired — traffic gets measured",
    ],
    risks: [
      {
        title: "Hidden deployment",
        detail:
          "Deployed but never shared is still zero demand evidence. The point of hosting is traffic, not uptime.",
        severity: "warn",
      },
      {
        title: "Broken first impression",
        detail:
          "Page live but the signup path is broken or untested — first visitors bounce and they don't come back.",
        severity: "warn",
      },
    ],
  },
  {
    id: "domain",
    x: 695,
    y: 270,
    milestones: [
      "Domain registered and pointed at your hosting",
      "One canonical URL shared everywhere users live",
    ],
    risks: [
      {
        title: "Brand obsession",
        detail:
          "Days hunting the perfect name while demand goes unmeasured. A good-enough name this week beats the perfect name next month.",
        severity: "warn",
      },
      {
        title: "Polish on an unvalidated idea",
        detail:
          "A beautiful domain on a page nobody wants just makes the failure prettier. Name it after the signal, not before.",
        severity: "warn",
      },
    ],
  },
  {
    id: "build-prototype",
    x: 780,
    y: 190,
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
    x: 870,
    y: 285,
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
    x: 900,
    y: 440,
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

// Landmark flavor content between the stage nodes — Fallout-map dressing that
// also names the gates the journey is actually about.
export interface MapPoi {
  x: number;
  y: number;
  label: string;
  detail: string;
  icon: "tent" | "bridge" | "wall" | "loop" | "mountain" | "trees";
}

export const MAP_POIS: MapPoi[] = [
  {
    x: 140,
    y: 368,
    label: "Camp Zero",
    detail: "Where every journey starts: a hunch, a blank repo, and someone in pain you haven't met yet.",
    icon: "tent",
  },
  {
    x: 280,
    y: 330,
    label: "Dead Forest",
    detail: "Where projects that skipped validation go to rest. Great code. Zero users. Tread carefully.",
    icon: "trees",
  },
  {
    x: 415,
    y: 385,
    label: "Validation Crossing",
    detail: "The only safe bridge into build territory. Cross with evidence — signups, replies, or objections.",
    icon: "bridge",
  },
  {
    x: 642,
    y: 415,
    label: "Share Hollow",
    detail: "A deployed URL nobody shares gathers no signal. Tell the valley what you built.",
    icon: "mountain",
  },
  {
    x: 700,
    y: 140,
    label: "The Build Wall",
    detail: "Everything west of here was research. Everything east is code. Evidence is your climbing gear.",
    icon: "wall",
  },
  {
    x: 845,
    y: 225,
    label: "Feedback Loop",
    detail: "Ship → announce → listen → repeat. The loop is the engine; a release without it teaches you nothing.",
    icon: "loop",
  },
];

// Broad named regions drawn behind the trail — the map reads like a real map,
// and each region names the gate the journey is actually about.
export interface MapRegion {
  label: string;
  x: number;
  y: number;
  rx: number;
  ry: number;
  rotate: number; // degrees
  seed: number; // deterministic wobble
}

export const MAP_REGIONS: MapRegion[] = [
  { label: "IDEATION FLATS", x: 160, y: 335, rx: 165, ry: 110, rotate: -8, seed: 1 },
  { label: "VALIDATION TERRITORY", x: 520, y: 345, rx: 205, ry: 125, rotate: -4, seed: 7 },
  { label: "BUILD HIGHLANDS", x: 822, y: 238, rx: 118, ry: 108, rotate: 8, seed: 13 },
  { label: "SCALE FRONTIER", x: 895, y: 455, rx: 88, ry: 105, rotate: -6, seed: 21 },
];

/** Per-stage territory: a small blob sized to its name, country-style. */
export function territoryFor(
  label: string,
  x: number,
  y: number,
  seed: number
): MapRegion {
  return {
    label,
    x,
    y,
    rx: 26 + label.length * 4.5,
    ry: 34,
    rotate: (seed % 2 === 0 ? -1 : 1) * (2 + ((seed * 7) % 5)),
    seed: seed * 31 + 3,
  };
}

/** Wobbly closed blob (closed Catmull-Rom through ellipse anchors). */
export function closedBlobPath(r: MapRegion): string {
  const n = 10;
  const rot = (r.rotate * Math.PI) / 180;
  const cosR = Math.cos(rot);
  const sinR = Math.sin(rot);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const wobble = 0.86 + 0.2 * Math.sin(r.seed * 12.9898 + i * 4.17);
    const ex = Math.cos(a) * r.rx * wobble;
    const ey = Math.sin(a) * r.ry * wobble;
    pts.push({ x: r.x + ex * cosR - ey * sinR, y: r.y + ex * sinR + ey * cosR });
  }
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d + " Z";
}

/** Catmull-Rom → cubic Bézier: a smooth winding trail through the nodes. */
export function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length ? `M ${pts[0].x},${pts[0].y}` : "";
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x},${c1y} ${c2x},${c2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/** Unit normal to the trail at parameter t — for placing markers off-path. */
export function curveNormal(
  pts: { x: number; y: number }[],
  t: number
): { x: number; y: number } {
  const a = curvePoint(pts, Math.max(0, t - 0.012));
  const b = curvePoint(pts, Math.min(1, t + 0.012));
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

/** Point at parameter t (0..1) along the smooth trail through `pts`. */
export function curvePoint(
  pts: { x: number; y: number }[],
  t: number
): { x: number; y: number } {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0];
  const segs = pts.length - 1;
  const raw = Math.min(Math.max(t, 0), 1) * segs;
  const i = Math.min(Math.floor(raw), segs - 1);
  const lt = raw - i;
  const p0 = pts[Math.max(0, i - 1)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(pts.length - 1, i + 2)];
  const c1x = p1.x + (p2.x - p0.x) / 6;
  const c1y = p1.y + (p2.y - p0.y) / 6;
  const c2x = p2.x - (p3.x - p1.x) / 6;
  const c2y = p2.y - (p3.y - p1.y) / 6;
  const u = 1 - lt;
  return {
    x: u * u * u * p1.x + 3 * u * u * lt * c1x + 3 * u * lt * lt * c2x + lt * lt * lt * p2.x,
    y: u * u * u * p1.y + 3 * u * u * lt * c1y + 3 * u * lt * lt * c2y + lt * lt * lt * p2.y,
  };
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
