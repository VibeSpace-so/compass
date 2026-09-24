import { BYOKProvider, Project, StageId } from "./types";
import { getStage } from "./stages";
import { getMapStage, MapRisk } from "./journey-map-data";
import { getActiveProvider, callSimpleCompletion } from "./chat-service";
import { projectBriefBlock } from "./tool-context";

/**
 * Per-stage map guidance: generic pre-structured notes by default, upgraded
 * to project-contextualized text by a small provider call and cached per
 * project in localStorage. Falls back silently to generic on any failure.
 */
export interface StageGuidance {
  enhanced: boolean;
  tip: string;
  milestones: string[];
  risks: MapRisk[];
}

const cacheKey = (projectId: string) => `vibe-compass-map-guidance-${projectId}`;

function readCache(projectId: string): Record<string, StageGuidance> {
  try {
    const raw = localStorage.getItem(cacheKey(projectId));
    return raw ? (JSON.parse(raw) as Record<string, StageGuidance>) : {};
  } catch {
    return {};
  }
}

function writeCache(projectId: string, cache: Record<string, StageGuidance>) {
  try {
    localStorage.setItem(cacheKey(projectId), JSON.stringify(cache));
  } catch {
    // Quota/serialization failures — guidance is a cache, safe to lose.
  }
}

export function genericGuidance(stageId: StageId): StageGuidance {
  const def = getMapStage(stageId);
  const stage = getStage(stageId);
  return {
    enhanced: false,
    tip: stage?.nextAction ?? "",
    milestones: def?.milestones ?? [],
    risks: def?.risks ?? [],
  };
}

export function getStageGuidance(
  projectId: string,
  stageId: StageId
): StageGuidance {
  const cached = readCache(projectId)[stageId];
  return cached ?? genericGuidance(stageId);
}

export async function enhanceStageGuidance(
  project: Project,
  providers: BYOKProvider[] | undefined,
  stageId: StageId
): Promise<StageGuidance | null> {
  // Cache-first: a stage already tailored stays tailored — re-enhancing on
  // every map view would burn a call and churn the unread badges' hashes.
  const cached = readCache(project.id)[stageId];
  if (cached?.enhanced) return cached;

  const active = getActiveProvider(project.id, providers);
  if (!active) return null;

  const stage = getStage(stageId);
  const generic = genericGuidance(stageId);
  if (!stage) return generic;

  const prompt = [
    "You are Compass, a product mentor. Rewrite these generic journey notes for",
    "this specific project. Keep the same honesty and structure — make each item",
    "concrete to THIS project (name its domain and users, not 'the product').",
    "",
    `PROJECT: ${project.name} — ${project.description}${projectBriefBlock(project.id)}`,
    "",
    `STAGE: ${stage.label} — ${stage.description}`,
    "",
    "GENERIC NOTES (JSON):",
    JSON.stringify({ tip: generic.tip, milestones: generic.milestones, risks: generic.risks }),
    "",
    'Return ONLY JSON with the same shape: {"tip":"one-sentence compass bearing","milestones":["…"],"risks":[{"title":"…","detail":"…","severity":"warn|danger"}]}',
    "Keep 2–4 milestones, preserve each risk's severity, keep details under 200 chars.",
  ].join("\n");

  try {
    const raw = await callSimpleCompletion(active.provider, active.apiKey, prompt, 600);
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as {
      tip?: unknown;
      milestones?: unknown;
      risks?: unknown;
    };
    const milestones = Array.isArray(parsed.milestones)
      ? parsed.milestones.filter((m): m is string => typeof m === "string" && !!m.trim()).slice(0, 4)
      : generic.milestones;
    const risks = Array.isArray(parsed.risks)
      ? parsed.risks
          .filter(
            (r): r is MapRisk =>
              typeof r === "object" &&
              r !== null &&
              typeof (r as MapRisk).title === "string" &&
              typeof (r as MapRisk).detail === "string" &&
              ((r as MapRisk).severity === "warn" || (r as MapRisk).severity === "danger")
          )
          .slice(0, 3)
      : generic.risks;
    const guidance: StageGuidance = {
      enhanced: true,
      tip: typeof parsed.tip === "string" && parsed.tip.trim() ? parsed.tip.trim() : generic.tip,
      milestones: milestones.length > 0 ? milestones : generic.milestones,
      risks: risks.length > 0 ? risks : generic.risks,
    };
    const cache = readCache(project.id);
    cache[stageId] = guidance;
    writeCache(project.id, cache);
    return guidance;
  } catch {
    return null;
  }
}
