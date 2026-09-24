"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  BrickWall,
  Check,
  ChevronRight,
  Compass as CompassIcon,
  Diamond,
  Flag,
  MapPin,
  Minus,
  Mountain,
  Pencil,
  Pin,
  Plus,
  Repeat,
  Skull,
  Tent,
  Trash2,
  TreePine,
  Waypoints,
  X,
} from "lucide-react";
import { BYOKProvider, Project, ProjectMemory, StageId } from "@/lib/types";
import { getStage, getStageIndex } from "@/lib/stages";
import {
  closedBlobPath,
  curveNormal,
  curvePoint,
  getMapStage,
  MAP_BORDERS,
  MAP_ISLANDS,
  MAP_LAKE,
  MAP_LANDMASS,
  MAP_POIS,
  MAP_SEA_LABELS,
  MAP_STREAMS,
  MAP_REGIONS,
  MAP_STAGES,
  recommendedStage,
  smoothPath,
  territoryFor,
} from "@/lib/journey-map-data";
import {
  enhanceStageGuidance,
  getStageGuidance,
  StageGuidance,
} from "@/lib/map-guidance";
import StageIcon from "./stage-icon";

interface JourneyMapScreenProps {
  project: Project;
  memories: ProjectMemory[];
  providers?: BYOKProvider[];
  stageToolActions: number;
  onStageChange: (targetId: StageId) => "applied" | "pending" | "noop";
  onUpdateMemory?: (memoryId: string, content: string) => void;
  onRemoveMemory?: (memoryId: string) => void;
  onPinMemory?: (memoryId: string, pinned: boolean) => void;
  onClose: () => void;
}

interface TooltipState {
  x: number;
  y: number;
  title: string;
  detail: string;
  tone: "milestone" | "warn" | "danger" | "poi";
}

/** Map is authored on a fixed 1000x620 canvas; zoom scales the layer. */
const BASE_W = 1000;
const BASE_H = 620;

const MAP_FONT = 'var(--font-fell, Georgia, "Times New Roman", serif)';

const POI_ICONS = {
  tent: Tent,
  bridge: Waypoints,
  wall: BrickWall,
  loop: Repeat,
  mountain: Mountain,
  trees: TreePine,
} as const;

/** Content hash so AI-rewritten copy counts as a new (unread) tooltip. */
function hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/** Hazards sit well OFF the trail, alternating sides — things to steer around.
    Placed at 30% / 52% / 74% along the incoming segment so they stay clear of
    the midpoint flag and both endpoint labels, then pushed ~72px off-path. */
function riskSpot(stageIdx: number, riskIdx: number) {
  const node = MAP_STAGES[stageIdx];
  if (stageIdx === 0) return { x: node.x + 62 + riskIdx * 46, y: node.y - 60 };
  const segs = MAP_STAGES.length - 1;
  const t = (stageIdx - 1 + 0.3 + riskIdx * 0.22) / segs;
  const on = curvePoint(MAP_STAGES, t);
  const n = curveNormal(MAP_STAGES, t);
  const side = riskIdx % 2 === 0 ? 1 : -1;
  const off = 68 + riskIdx * 6;
  return { x: on.x + n.x * off * side, y: on.y + n.y * off * side };
}

/** Milestone flags are planted ON the trail at each segment's midpoint —
    halfway between two stage names, so they never touch a label. */
function flagSpot(stageIdx: number) {
  const segs = MAP_STAGES.length - 1;
  const t = stageIdx === 0 ? 0.5 / segs : (stageIdx - 0.5) / segs;
  return curvePoint(MAP_STAGES, t);
}

function CompassNeedle({
  fromX,
  fromY,
  toX,
  toY,
}: {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}) {
  const deg = (Math.atan2(toY - fromY, toX - fromX) * 180) / Math.PI + 90;
  return (
    <div className="w-16 h-16 rounded-full border border-[var(--accent-44)] bg-black/70 flex items-center justify-center shadow-[0_0_18px_-4px_var(--accent)]">
      <svg viewBox="0 0 64 64" className="w-12 h-12">
        <circle cx="32" cy="32" r="29" fill="none" stroke="var(--accent-26)" strokeWidth="1" />
        <text x="32" y="10" textAnchor="middle" fontSize="7" fill="var(--accent)" fontFamily={MAP_FONT}>N</text>
        <g transform={`rotate(${deg} 32 32)`}>
          <polygon points="32,8 35,32 32,28 29,32" fill="var(--accent)" />
          <polygon points="32,56 35,32 32,36 29,32" fill="var(--text-muted)" opacity="0.5" />
        </g>
        <circle cx="32" cy="32" r="2.4" fill="var(--accent)" />
      </svg>
    </div>
  );
}

export default function JourneyMapScreen({
  project,
  memories,
  providers,
  stageToolActions,
  onStageChange,
  onUpdateMemory,
  onRemoveMemory,
  onPinMemory,
  onClose,
}: JourneyMapScreenProps) {
  const currentIdx = getStageIndex(project.currentStage);
  const [selectedId, setSelectedId] = useState<StageId>(project.currentStage);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "captured">("overview");
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [guidance, setGuidance] = useState<Record<string, StageGuidance>>({});
  const enhancingRef = useRef<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  const [zoom, setZoom] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);

  const readKey = `vibe-compass-map-read-${project.id}`;
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const stage = getStage(selectedId);
  const mapDef = getMapStage(selectedId);
  const selectedIdx = getStageIndex(selectedId);
  const stageMemories = useMemo(
    () => memories.filter((m) => m.stage === selectedId),
    [memories, selectedId]
  );

  const guidanceFor = useCallback(
    (id: StageId): StageGuidance => guidance[id] ?? getStageGuidance(project.id, id),
    [guidance, project.id]
  );

  // Contextualize the current stage once, and any stage the user inspects.
  const ensureGuidance = useCallback(
    (id: StageId) => {
      if (guidance[id]?.enhanced || enhancingRef.current.has(id)) return;
      enhancingRef.current.add(id);
      void enhanceStageGuidance(project, providers, id).then((g) => {
        enhancingRef.current.delete(id);
        if (g) setGuidance((prev) => ({ ...prev, [id]: g }));
      });
    },
    [guidance, project, providers]
  );

  useEffect(() => {
    ensureGuidance(project.currentStage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.currentStage]);

  useEffect(() => {
    ensureGuidance(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    setMounted(true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Load persisted read-state; ids include a content hash so an AI rewrite
  // re-flags a marker as unread automatically.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(readKey);
      if (raw) setReadIds(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* corrupted cache → start fresh */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readKey]);

  // The zoom the map should open at: fit the whole continent when there's
  // room, readable-and-centered on the current stage when there isn't.
  const initialZoom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return 1;
    const fit = Math.min(
      (el.clientWidth - 16) / BASE_W,
      (el.clientHeight - 16) / BASE_H
    );
    return fit < 0.55 ? 0.7 : Math.min(1.5, Math.max(0.55, fit));
  }, []);

  // Initial zoom: on desktop/laptop, fit the whole continent in the visible
  // area; on phones, prefer readable text and center on the current stage.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !mounted) return;
    const z = initialZoom();
    setZoom(z);
    // Fit zoom → whole map visible, m-auto centers it; otherwise center on
    // the current stage so the map opens where you are.
    if (z !== 0.7) return;
    const def = MAP_STAGES[currentIdx];
    if (!def) return;
    requestAnimationFrame(() => {
      el.scrollTo({
        left: def.x * z - el.clientWidth / 2,
        top: def.y * z - el.clientHeight / 2,
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // Ctrl/Cmd + wheel zooms (non-passive so preventDefault works).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !mounted) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => Math.min(2.5, Math.max(0.4, z * (e.deltaY < 0 ? 1.12 : 0.9))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [mounted]);

  // Two-finger pinch zoom on touch devices.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !mounted) return;
    const pts = new Map<number, { x: number; y: number }>();
    let lastDist = 0;
    const dist = () => {
      const [a, b] = [...pts.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "touch") pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    const onMove = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        const d = dist();
        if (lastDist > 0) {
          setZoom((z) => Math.min(2.5, Math.max(0.4, z * (d / lastDist))));
        }
        lastDist = d;
      }
    };
    const onUp = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) lastDist = 0;
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [mounted]);

  const hasValidationEvidence = memories.some((m) =>
    (["landing-page", "hosting", "domain"] as StageId[]).includes(m.stage)
  );
  // The needle shows direction, not permission — the gate in the sidebar
  // still decides whether moving is allowed, so pass 0 to always aim forward.
  const targetId = recommendedStage(
    project.currentStage,
    currentIdx,
    stageToolActions + memories.filter((m) => m.stage === project.currentStage).length,
    0,
    hasValidationEvidence
  );
  const currentNode = MAP_STAGES[currentIdx];
  const targetNode = MAP_STAGES[Math.max(0, getStageIndex(targetId))];
  const targetStage = getStage(targetId);

  const visitedPath = smoothPath(MAP_STAGES.slice(0, currentIdx + 1));
  const futurePath = smoothPath(MAP_STAGES.slice(currentIdx));

  const selectedGuidance = guidanceFor(selectedId);

  const markRead = useCallback(
    (id: string) => {
      setReadIds((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        try {
          localStorage.setItem(readKey, JSON.stringify([...next]));
        } catch {
          /* storage full — read state is best-effort */
        }
        return next;
      });
    },
    [readKey]
  );

  const allTipIds = useMemo(() => {
    const ids: string[] = [];
    for (const def of MAP_STAGES) {
      const g = guidanceFor(def.id);
      g.risks.forEach((r, ri) =>
        ids.push(`${def.id}-r${ri}-${hashStr(r.title + r.detail)}`)
      );
      if (g.milestones.length) {
        ids.push(`${def.id}-ms-${hashStr(g.milestones.join("|"))}`);
      }
    }
    return ids;
  }, [guidanceFor]);

  const unreadCount = allTipIds.filter((id) => !readIds.has(id)).length;

  function markAllRead() {
    setReadIds((prev) => {
      const next = new Set([...prev, ...allTipIds]);
      try {
        localStorage.setItem(readKey, JSON.stringify([...next]));
      } catch {
        /* best-effort */
      }
      return next;
    });
  }

  function handleGoToStage(id: StageId) {
    const outcome = onStageChange(id);
    if (outcome === "pending") onClose();
  }

  function saveEdit() {
    if (editingMemoryId && editDraft.trim()) {
      onUpdateMemory?.(editingMemoryId, editDraft.trim());
    }
    setEditingMemoryId(null);
    setEditDraft("");
  }

  const toneStyles: Record<TooltipState["tone"], string> = {
    milestone: "border-emerald-500/50 text-emerald-200",
    warn: "border-yellow-500/50 text-yellow-200",
    danger: "border-red-500/60 text-red-200",
    poi: "border-[var(--accent-26)] text-[var(--text-secondary)]",
  };

  if (!mounted) return null;

  // Portaled to <body>: the overlay must sit above the sticky nav (z-40),
  // which wins any z-index fight inside <main class="relative z-10">.
  return createPortal(
    <div className="fixed inset-0 z-50 bg-[#0a0f0a] text-[var(--text-secondary)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-b border-[var(--accent-26)] bg-black/60 backdrop-blur-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <CompassIcon className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-[var(--accent)] truncate">
              Journey Map — {project.name}
            </h2>
            <p className="text-[10px] text-[var(--text-muted)] hidden sm:block">
              The compass points to your next move. Hover the warning signs — they&apos;re real risks.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[var(--accent-26)] text-[10px] text-[var(--accent)] hover:border-[var(--accent-44)] transition-colors"
              title="Mark every tooltip as read"
            >
              <span className="flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[var(--accent)] text-black text-[8px] font-bold">
                !
              </span>
              {unreadCount} unread — clear
            </button>
          )}
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--accent-26)] text-xs text-[var(--text-secondary)] hover:border-[var(--accent-44)] hover:text-[var(--accent)] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Back to chat
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Map canvas — scroll/pan via overflow, zoom via scaled layer */}
        <div className="flex-1 min-h-[300px] lg:min-h-0 relative">
          <div
            ref={scrollRef}
            className="absolute inset-0 overflow-auto mobile-scroll flex"
            style={{ touchAction: "pan-x pan-y" }}
          >
            {/* m-auto centers when smaller, scrolls when larger */}
            <div
              className="m-auto relative flex-shrink-0"
              style={{ width: BASE_W * zoom, height: BASE_H * zoom }}
            >
              {/* Authored 1000x620 layer, scaled */}
              <div
                className="absolute top-0 left-0"
                style={{
                  width: BASE_W,
                  height: BASE_H,
                  transform: `scale(${zoom})`,
                  transformOrigin: "0 0",
                }}
                onClick={() => setTooltip(null)}
              >
            {/* Terrain texture — clipped to the landmass so the sea stays clean */}
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, var(--accent) 0.8px, transparent 0.8px)",
                backgroundSize: "26px 26px",
                clipPath: `path('${MAP_LANDMASS}')`,
              }}
            />
            <svg
              viewBox={`0 0 ${BASE_W} ${BASE_H}`}
              width={BASE_W}
              height={BASE_H}
              className="absolute inset-0"
            >
              <defs>
                {/* Hand-drawn wobble applied to ink strokes (not to text) */}
                <filter id="mapInk" x="-4%" y="-4%" width="108%" height="108%">
                  <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="11" result="n" />
                  <feDisplacementMap in="SourceGraphic" in2="n" scale="4.5" />
                </filter>
              </defs>

              {/* Depth rings — faded coast echoes out into the sea */}
              <path
                d={MAP_LANDMASS}
                fill="none"
                stroke="var(--accent)"
                strokeOpacity="0.10"
                strokeWidth="1.1"
                transform="translate(500 310) scale(1.05) translate(-500 -310)"
                filter="url(#mapInk)"
              />
              <path
                d={MAP_LANDMASS}
                fill="none"
                stroke="var(--accent)"
                strokeOpacity="0.055"
                strokeWidth="0.9"
                transform="translate(500 310) scale(1.105) translate(-500 -310)"
                filter="url(#mapInk)"
              />

              {/* Beach stipple — a dotted echo just inside the shoreline */}
              <path
                d={MAP_LANDMASS}
                fill="none"
                stroke="var(--accent)"
                strokeOpacity="0.13"
                strokeWidth="1.5"
                strokeDasharray="1 8"
                strokeLinecap="round"
                transform="translate(500 310) scale(0.965) translate(-500 -310)"
                filter="url(#mapInk)"
              />

              {/* Islands offshore */}
              {MAP_ISLANDS.map((isle, i) => (
                <path
                  key={i}
                  d={closedBlobPath(isle)}
                  fill="var(--accent)"
                  fillOpacity="0.05"
                  stroke="var(--accent-44)"
                  strokeOpacity="0.4"
                  strokeWidth="1"
                  filter="url(#mapInk)"
                />
              ))}

              {/* The continent — one landmass every region shares */}
              <path d={MAP_LANDMASS} fill="var(--accent)" fillOpacity="0.045" />
              <path
                d={MAP_LANDMASS}
                fill="none"
                stroke="var(--accent)"
                strokeOpacity="0.09"
                strokeWidth="7"
                strokeLinejoin="round"
              />
              <path
                d={MAP_LANDMASS}
                fill="none"
                stroke="var(--accent-44)"
                strokeOpacity="0.5"
                strokeWidth="1.6"
                strokeLinejoin="round"
                filter="url(#mapInk)"
              />

              <path
                d={closedBlobPath(MAP_LAKE)}
                fill="var(--accent)"
                fillOpacity="0.06"
                stroke="var(--accent-44)"
                strokeOpacity="0.45"
                strokeWidth="1"
                filter="url(#mapInk)"
              />
              <g
                fill="none"
                stroke="var(--accent-44)"
                strokeOpacity="0.35"
                strokeWidth="1"
                strokeLinecap="round"
                filter="url(#mapInk)"
              >
                {MAP_STREAMS.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </g>
              <text
                x={MAP_LAKE.x}
                y={MAP_LAKE.y + 3}
                textAnchor="middle"
                fontSize="8"
                fontStyle="italic"
                letterSpacing="2.5"
                fill="var(--accent)"
                fillOpacity="0.24"
                fontFamily={MAP_FONT}
              >
                MIRROR LAKE
              </text>

              {/* Internal border division lines between the regions */}
              <g
                fill="none"
                stroke="var(--accent-44)"
                strokeOpacity="0.38"
                strokeWidth="1.1"
                strokeDasharray="6 4"
                strokeLinecap="round"
                filter="url(#mapInk)"
              >
                {MAP_BORDERS.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </g>

              {/* Named waters — italic labels in the sea band */}
              {MAP_SEA_LABELS.map((s) => (
                <text
                  key={s.label}
                  x={s.x}
                  y={s.y}
                  textAnchor="middle"
                  fontSize="10.5"
                  fontStyle="italic"
                  letterSpacing="5"
                  fill="var(--accent)"
                  fillOpacity="0.13"
                  fontFamily={MAP_FONT}
                >
                  {s.label}
                </text>
              ))}

              {/* Region labels inside their zone of the shared landmass */}
              {MAP_REGIONS.map((r) => (
                <text
                  key={r.label}
                  x={r.x}
                  y={r.y}
                  textAnchor="middle"
                  fontSize="17"
                  fontStyle="italic"
                  letterSpacing="7"
                  fill="var(--accent)"
                  fillOpacity="0.16"
                  fontFamily={MAP_FONT}
                >
                  {r.label}
                </text>
              ))}

              {/* Decorative strokes — ridge lines and woods, no interaction */}
              <g
                stroke="var(--accent)"
                fill="none"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.28"
                filter="url(#mapInk)"
              >
                {/* Build Highlands mountain range — back ridge + foothills */}
                <path d="M 758,118 l 15,-28 l 15,28 M 782,112 l 17,-31 l 17,31 M 810,116 l 14,-26 l 14,26 M 836,110 l 16,-29 l 16,29 M 864,114 l 15,-27 l 15,27 M 890,118 l 13,-23 l 13,23 M 914,122 l 11,-19 l 11,19" />
                <path d="M 745,140 l 10,-15 l 10,15 M 770,136 l 11,-17 l 11,17 M 800,138 l 10,-15 l 10,15 M 830,135 l 12,-18 l 12,18 M 862,138 l 10,-14 l 10,14 M 888,142 l 9,-13 l 9,13 M 906,144 l 8,-11 l 8,11" opacity="0.7" />
                <path d="M 715,158 q 8,-8 16,0 M 738,164 q 7,-7 14,0 M 695,168 q 6,-6 12,0" opacity="0.6" />
                {/* Rolling hills in upper Validation Territory */}
                <path d="M 360,190 q 14,-13 28,0 M 395,178 q 12,-11 24,0 M 435,186 q 13,-12 26,0 M 478,176 q 12,-10 24,0 M 515,190 q 11,-10 22,0" opacity="0.75" />
                {/* Dead Forest — bare trunks around the POI */}
                <path d="M 252,322 v -13 M 252,315 l -5,-4 M 252,312 l 4,-4 M 268,338 v -12 M 268,331 l -4,-3 M 306,318 v -14 M 306,310 l -5,-4 M 306,313 l 5,-4 M 318,338 v -11 M 318,332 l -4,-3" />
                {/* Pines in the Flats */}
                <path d="M 215,540 l 6,-14 l 6,14 z M 221,540 v 6 M 240,552 l 5,-12 l 5,12 z M 245,552 v 6 M 264,537 l 6,-15 l 6,15 z M 270,537 v 7" />
                {/* Grass tufts + dunes in the Flats and Frontier */}
                <path d="M 95,528 q 2,-5 4,0 M 118,544 q 2,-5 4,0 M 148,538 q 2,-5 4,0 M 172,548 q 2,-5 4,0 M 300,540 q 2,-4 4,0 M 330,534 q 2,-4 4,0" />
                <path d="M 882,540 q 8,-9 16,0 M 904,547 q 7,-8 14,0 M 480,542 q 7,-7 14,0 M 520,538 q 6,-6 12,0" />
                {/* Cliff hatching along the SE + east coast */}
                <path d="M 952,396 l -11,-7 M 944,452 l -11,-5 M 925,500 l -11,-4 M 892,538 l -10,-5 M 856,560 l -9,-5 M 970,282 l -9,-7 M 966,330 l -10,-6" opacity="0.8" />
                {/* marsh reeds where the lake outlet meets the sea */}
                <path d="M 560,535 v -7 M 560,530 l -3,-3 M 560,531 l 3,-3 M 575,548 v -6 M 575,544 l -3,-3 M 522,545 v -6 M 522,541 l 3,-3" />
                {/* a small serpent in the west sea */}
                <path d="M 26,470 q 4,-7 8,0 q 4,7 8,0 M 41,466 c 1,-4 4,-5 6,-3" />
                {/* sea marks outside the coast */}
                <path d="M 30,150 q 6,-5 12,0 q 6,5 12,0 M 46,165 q 6,-5 12,0 q 6,5 12,0" />
                <path d="M 28,205 q 5,-4 10,0 q 5,4 10,0 M 34,425 q 5,-4 10,0 q 5,4 10,0" />
                <path d="M 60,585 q 6,-5 12,0 q 6,5 12,0 M 78,598 q 6,-5 12,0 q 6,5 12,0" />
                <path d="M 350,600 q 6,-5 12,0 q 6,5 12,0 M 560,602 q 6,-5 12,0 q 6,5 12,0" />
                <path d="M 930,50 q 6,-5 12,0 q 6,5 12,0 M 950,62 q 6,-5 12,0 q 6,5 12,0" />
                <path d="M 960,590 q 5,-4 10,0 q 5,4 10,0" />
                <path d="M 120,36 q 6,-5 12,0 q 6,5 12,0 M 330,38 q 6,-5 12,0 q 6,5 12,0 M 640,40 q 6,-5 12,0 q 6,5 12,0" />
              </g>

              {/* Visited trail */}
              <path
                d={visitedPath}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="3"
                strokeDasharray="9 6"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.6"
                filter="url(#mapInk)"
              >
                <animate attributeName="stroke-dashoffset" from="0" to="-15" dur="1.6s" repeatCount="indefinite" />
              </path>
              {/* Unvisited trail */}
              <path
                d={futurePath}
                fill="none"
                stroke="var(--accent-44)"
                strokeWidth="3"
                strokeDasharray="2 10"
                strokeLinecap="round"
                opacity="0.5"
                filter="url(#mapInk)"
              />

              {/* Stage names written directly on the land — country-label style */}
              {MAP_STAGES.map((def, i) => {
                const s = getStage(def.id);
                const label = (s?.label ?? def.id).toUpperCase();
                const terr = territoryFor(label, def.x, def.y, i + 1);
                const isCurrent = i === currentIdx;
                const isPast = i < currentIdx;
                const isSelected = def.id === selectedId;
                return (
                  <g
                    key={def.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedId(def.id);
                      setActiveTab("overview");
                    }}
                  >
                    {/* invisible hit area over the name's footprint */}
                    <path d={closedBlobPath(terr)} fill="transparent" pointerEvents="fill" />
                    <text
                      x={def.x}
                      y={def.y + 4}
                      textAnchor="middle"
                      fontSize={isCurrent ? 16 : label.length > 13 ? 11.5 : 13}
                      letterSpacing="3.5"
                      fill="var(--accent)"
                      fillOpacity={isCurrent ? 1 : isPast ? 0.72 : 0.42}
                      stroke="#050a05"
                      strokeWidth="5"
                      paintOrder="stroke"
                      strokeOpacity="0.85"
                      fontFamily={MAP_FONT}
                    >
                      {label}
                    </text>
                    {(isCurrent || isSelected) && (
                      <path
                        d={`M ${def.x - terr.rx * 0.55},${def.y + 13} q ${terr.rx * 0.55},${isCurrent ? 5 : 4} ${terr.rx * 1.1},0`}
                        fill="none"
                        stroke="var(--accent)"
                        strokeOpacity={isCurrent ? 0.9 : 0.5}
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        filter="url(#mapInk)"
                      />
                    )}
                    {isPast && (
                      <text
                        x={def.x}
                        y={def.y + 16}
                        textAnchor="middle"
                        fontSize="7"
                        fontStyle="italic"
                        letterSpacing="2"
                        fill="var(--accent)"
                        fillOpacity="0.5"
                        fontFamily={MAP_FONT}
                      >
                        · passed ·
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Cartographer's rose */}
              <g transform="translate(952,556)" opacity="0.45">
                <circle r="27" fill="none" stroke="var(--accent)" strokeWidth="0.9" />
                <circle r="21" fill="none" stroke="var(--accent)" strokeWidth="0.4" />
                <path
                  d="M0,-25 L4,-4 L25,0 L4,4 L0,25 L-4,4 L-25,0 L-4,-4 Z"
                  fill="rgba(0,0,0,0)"
                  stroke="var(--accent)"
                  strokeWidth="0.7"
                />
                <path
                  d="M0,-12 L2,-2 L12,0 L2,2 L0,12 L-2,2 L-12,0 L-2,-2 Z"
                  transform="rotate(45) scale(0.6)"
                  fill="rgba(0,0,0,0)"
                  stroke="var(--accent)"
                  strokeWidth="1.2"
                />
                <path d="M0,-25 L4,-4 L0,0 L-4,-4 Z" fill="var(--accent)" />
                <text y="-32" textAnchor="middle" fontSize="10" fill="var(--accent)" fontFamily={MAP_FONT}>
                  N
                </text>
              </g>

              {/* Double-rule map frame + corner ticks */}
              <g fill="none" stroke="var(--accent)" pointerEvents="none">
                <rect x="9" y="9" width={BASE_W - 18} height={BASE_H - 18} strokeWidth="1.4" strokeOpacity="0.4" />
                <rect x="16" y="16" width={BASE_W - 32} height={BASE_H - 32} strokeWidth="0.6" strokeOpacity="0.25" />
                <path
                  d="M 9,40 v -31 h 31 M 960,9 h 31 v 31 M 991,580 v 31 h -31 M 40,611 h -31 v -31"
                  strokeWidth="2.2"
                  strokeOpacity="0.5"
                />
                {/* graticule ticks along the frame edges */}
                {Array.from({ length: 10 }, (_, i) => 100 + i * 90).map((x) => (
                  <path key={`tx${x}`} d={`M ${x},9 v 4 M ${x},611 v -4`} strokeWidth="0.7" strokeOpacity="0.3" />
                ))}
                {Array.from({ length: 6 }, (_, i) => 100 + i * 90).map((y) => (
                  <path key={`ty${y}`} d={`M 9,${y} h 4 M 991,${y} h -4`} strokeWidth="0.7" strokeOpacity="0.3" />
                ))}
              </g>

              {/* Scale bar — map furniture in the south sea */}
              <g
                fill="none"
                stroke="var(--accent)"
                strokeOpacity="0.32"
                strokeWidth="1"
                strokeLinecap="round"
                filter="url(#mapInk)"
              >
                <path d="M 390,598 h 110 M 390,594 v 8 M 445,596 v 6 M 500,594 v 8" />
              </g>
              <text
                x="445"
                y="589"
                textAnchor="middle"
                fontSize="7.5"
                fontStyle="italic"
                letterSpacing="1.5"
                fill="var(--accent)"
                fillOpacity="0.24"
                fontFamily={MAP_FONT}
              >
                ~ 200 leagues
              </text>
            </svg>


            {/* Landmarks — Fallout-map dressing that names the real gates */}
            {MAP_POIS.map((poi) => {
              const Icon = POI_ICONS[poi.icon];
              return (
                <button
                  key={poi.label}
                  className="absolute z-10 flex flex-col items-center group"
                  style={{ left: poi.x, top: poi.y, transform: "translate(-50%,-50%)" }}
                  onMouseEnter={() =>
                    setTooltip({ x: poi.x, y: poi.y, title: poi.label, detail: poi.detail, tone: "poi" })
                  }
                  onMouseLeave={() => setTooltip(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTooltip({ x: poi.x, y: poi.y, title: poi.label, detail: poi.detail, tone: "poi" });
                  }}
                >
                  <span className="w-5 h-5 rounded-md bg-black/70 border border-[var(--accent-26)] flex items-center justify-center group-hover:border-[var(--accent-44)] transition-colors">
                    <Icon className="w-3 h-3 text-[var(--text-muted)]" />
                  </span>
                </button>
              );
            })}

            {/* Risk markers — warn triangles, round skulls for danger */}
            {MAP_STAGES.map((def, i) =>
              guidanceFor(def.id).risks.map((risk, ri) => {
                const { x, y } = riskSpot(i, ri);
                const danger = risk.severity === "danger";
                const tipId = `${def.id}-r${ri}-${hashStr(risk.title + risk.detail)}`;
                const show = () => {
                  setTooltip({ x, y, title: risk.title, detail: risk.detail, tone: risk.severity });
                  markRead(tipId);
                };
                return (
                  <button
                    key={tipId}
                    className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: x, top: y }}
                    onMouseEnter={show}
                    onMouseLeave={() => setTooltip(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      show();
                    }}
                  >
                    {danger ? (
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-950/90 border border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.45)]">
                        <Skull className="w-3.5 h-3.5 text-red-300" />
                      </span>
                    ) : (
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-yellow-950/80 border border-yellow-500/70">
                        <AlertTriangle className="w-3 h-3 text-yellow-400" />
                      </span>
                    )}
                    {!readIds.has(tipId) && (
                      <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[var(--accent)] text-black text-[8px] font-bold leading-none">
                        !
                      </span>
                    )}
                  </button>
                );
              })
            )}

            {/* Milestone flags — planted on the trail before each node */}
            {MAP_STAGES.map((def, i) => {
              const g = guidanceFor(def.id);
              if (g.milestones.length === 0) return null;
              const { x: mx, y: my } = flagSpot(i);
              const tipId = `${def.id}-ms-${hashStr(g.milestones.join("|"))}`;
              const detail = g.milestones.map((m) => `• ${m}`).join("\n");
              const show = () => {
                setTooltip({
                  x: mx,
                  y: my,
                  title: `${getStage(def.id)?.label} milestones`,
                  detail,
                  tone: "milestone",
                });
                markRead(tipId);
              };
              return (
                <button
                  key={tipId}
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
                  style={{ left: mx, top: my }}
                  onMouseEnter={show}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    show();
                  }}
                >
                  <Flag className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                  {!readIds.has(tipId) && (
                    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[var(--accent)] text-black text-[8px] font-bold leading-none">
                      !
                    </span>
                  )}
                </button>
              );
            })}

            {/* You-are-here pin over the current territory */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center"
              style={{ left: currentNode.x, top: currentNode.y - 52 }}
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]" />
              </span>
              <MapPin className="w-4 h-4 text-[var(--accent)] mt-0.5" />
            </div>

              </div>

              {/* Tooltip — outside the scaled layer so it stays readable at any zoom */}
              {tooltip && (
                <div
                  className={`absolute z-10 max-w-[240px] px-3 py-2 rounded-lg border bg-black/95 shadow-xl text-left pointer-events-none ${toneStyles[tooltip.tone]}`}
                  style={{
                    left: Math.min(
                      Math.max(8, tooltip.x * zoom),
                      BASE_W * zoom - 250
                    ),
                    top: Math.min(
                      Math.max(8, tooltip.y * zoom + 24),
                      BASE_H * zoom - 120
                    ),
                  }}
                >
                  <div className="text-[11px] font-semibold mb-0.5" style={{ fontFamily: MAP_FONT }}>
                    {tooltip.title}
                  </div>
                  <div className="text-[10px] leading-relaxed whitespace-pre-line opacity-90">
                    {tooltip.detail}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Compass + bearing — fixed overlay, doesn't pan with the map */}
          <div className="absolute top-3 right-3 flex flex-col items-center gap-1.5 pointer-events-none">
            <CompassNeedle
              fromX={currentNode.x}
              fromY={currentNode.y}
              toX={targetNode.x}
              toY={targetNode.y}
            />
            <div
              className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] bg-black/70 px-1.5 py-0.5 rounded border border-[var(--accent-26)] whitespace-nowrap"
              style={{ fontFamily: MAP_FONT }}
            >
              → {targetStage?.label ?? "Stay"}
            </div>
          </div>

          {/* Map legend */}
          <div
            className="absolute bottom-3 left-3 flex flex-col gap-1 rounded-lg border border-[var(--accent-26)] bg-black/80 px-2.5 py-2 text-[9px] uppercase tracking-wider text-[var(--text-muted)]"
            style={{ fontFamily: MAP_FONT }}
          >
            <span className="flex items-center gap-1.5">
              <Flag className="w-3 h-3 text-emerald-400" /> milestone
            </span>
            <span className="flex items-center gap-1.5">
              <Skull className="w-3 h-3 text-red-300" /> hazard
            </span>
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-yellow-400" /> warning
            </span>
            <span className="flex items-center gap-1.5 border-t border-[var(--accent-26)] pt-1 mt-0.5 text-[var(--text-muted)]/70 normal-case tracking-normal">
              drag to pan · pinch or ctrl+scroll
            </span>
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-3 right-3 flex flex-col items-center gap-1.5 rounded-lg border border-[var(--accent-26)] bg-black/80 p-1.5">
            <button
              onClick={() => setZoom((z) => Math.min(2.5, z * 1.25))}
              className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-10)] transition-colors"
              title="Zoom in"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(initialZoom())}
              className="px-1 py-0.5 rounded text-[9px] tabular-nums text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
              title="Fit map to view"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z * 0.8))}
              className="p-1.5 rounded text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--accent-10)] transition-colors"
              title="Zoom out"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Detail panel */}
        <div className="w-full lg:w-[340px] max-h-[45vh] lg:max-h-none border-t lg:border-t-0 lg:border-l border-[var(--accent-26)] bg-black/60 backdrop-blur-sm flex flex-col min-h-[240px] lg:min-h-0 overflow-y-auto mobile-scroll flex-shrink-0">
          {stage && mapDef ? (
            <>
              <div className="px-4 pt-4 pb-3 border-b border-[var(--accent-26)]">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      selectedIdx === currentIdx
                        ? "bg-[var(--accent)] text-black"
                        : selectedIdx < currentIdx
                          ? "bg-[var(--accent-10)] text-[var(--accent)]"
                          : "bg-[var(--accent-10)] text-[var(--text-muted)]"
                    }`}
                  >
                    <StageIcon name={stage.lucideIcon} className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-[var(--accent)]">{stage.label}</h3>
                      {selectedIdx === currentIdx && (
                        <span className="text-[9px] uppercase tracking-wider text-[var(--accent)]">current</span>
                      )}
                      {selectedIdx < currentIdx && (
                        <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">visited</span>
                      )}
                      {selectedIdx > currentIdx && (
                        <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)]">ahead</span>
                      )}
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{stage.description}</p>
                  </div>
                </div>
                {selectedIdx !== currentIdx && (
                  <button
                    onClick={() => handleGoToStage(selectedId)}
                    className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--accent)] text-black text-xs font-medium hover:opacity-85 transition-opacity"
                  >
                    {selectedIdx < currentIdx ? "Return to this stage" : "Move to this stage"}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div className="flex border-b border-[var(--accent-26)]">
                {(
                  [
                    { id: "overview", label: "Overview" },
                    { id: "captured", label: `Captured (${stageMemories.length})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 px-3 py-2 text-[11px] transition-colors ${
                      activeTab === tab.id
                        ? "text-[var(--accent)] border-b-2 border-[var(--accent)] bg-[var(--accent-10)]/40"
                        : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 p-4 space-y-4">
                {activeTab === "overview" ? (
                  <>
                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                        <CompassIcon className="w-3 h-3 text-[var(--accent)]" />
                        Compass bearing
                        {selectedGuidance.enhanced && (
                          <span className="text-[8px] px-1 py-0.5 rounded bg-[var(--accent-10)] text-[var(--accent)] normal-case">
                            tailored
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                        {selectedGuidance.tip}
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                        <Diamond className="w-3 h-3 text-[var(--accent)]" />
                        Milestones
                      </div>
                      <ul className="space-y-1">
                        {selectedGuidance.milestones.map((m, i) => (
                          <li key={i} className="text-[11px] text-[var(--text-secondary)] leading-relaxed flex gap-1.5">
                            <span className="text-[var(--accent)] flex-shrink-0">◆</span>
                            {m}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-1.5">
                        <AlertTriangle className="w-3 h-3 text-yellow-400" />
                        Risks on this path
                      </div>
                      <ul className="space-y-2">
                        {selectedGuidance.risks.map((r, i) => (
                          <li
                            key={i}
                            className={`text-[11px] leading-relaxed px-2.5 py-2 rounded-md border ${
                              r.severity === "danger"
                                ? "border-red-500/40 bg-red-500/5 text-red-200"
                                : "border-yellow-500/30 bg-yellow-500/5 text-yellow-200"
                            }`}
                          >
                            <div className="font-semibold">{r.title}</div>
                            <div className="opacity-90 mt-0.5">{r.detail}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <>
                    {stageMemories.length === 0 ? (
                      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                        Nothing captured in this stage yet. Chat with the compass —
                        decisions, evidence, and artifacts save here automatically.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {stageMemories.map((m) => (
                          <li
                            key={m.id}
                            className="group px-2.5 py-2 rounded-md border border-[var(--accent-26)] bg-[var(--accent-10)]/30"
                          >
                            {editingMemoryId === m.id ? (
                              <div className="space-y-1.5">
                                <textarea
                                  value={editDraft}
                                  onChange={(e) => setEditDraft(e.target.value)}
                                  rows={3}
                                  className="w-full bg-black/50 border border-[var(--accent-26)] rounded px-2 py-1.5 text-[11px] text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)] resize-none"
                                  autoFocus
                                />
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={saveEdit}
                                    className="px-2 py-1 rounded bg-[var(--accent)] text-black text-[10px] font-medium"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => { setEditingMemoryId(null); setEditDraft(""); }}
                                    className="px-2 py-1 rounded border border-[var(--accent-26)] text-[10px] text-[var(--text-muted)]"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-1.5">
                                <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] mt-0.5 flex-shrink-0 w-14">
                                  {m.type}
                                </span>
                                <p className="flex-1 text-[11px] text-[var(--text-secondary)] leading-relaxed min-w-0">
                                  {m.pinned && <Pin className="w-2.5 h-2.5 inline text-[var(--accent)] mr-1" />}
                                  {m.content}
                                </p>
                                <div className="flex items-center gap-0.5 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                  {onPinMemory && (
                                    <button
                                      onClick={() => onPinMemory(m.id, !m.pinned)}
                                      className="p-1 text-[var(--text-muted)] hover:text-[var(--accent)]"
                                      title={m.pinned ? "Unpin" : "Pin"}
                                    >
                                      <Pin className="w-3 h-3" />
                                    </button>
                                  )}
                                  {onUpdateMemory && (
                                    <button
                                      onClick={() => { setEditingMemoryId(m.id); setEditDraft(m.content); }}
                                      className="p-1 text-[var(--text-muted)] hover:text-[var(--accent)]"
                                      title="Edit"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  )}
                                  {onRemoveMemory && (
                                    <button
                                      onClick={() => onRemoveMemory(m.id)}
                                      className="p-1 text-[var(--text-muted)] hover:text-red-400"
                                      title="Remove"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="p-4 text-[11px] text-[var(--text-muted)]">Select a stage.</div>
          )}
        </div>
      </div>

      {/* Footer hint */}
      <div className="px-4 sm:px-6 py-2 border-t border-[var(--accent-26)] bg-black/60 flex items-center gap-2">
        <MapPin className="w-3 h-3 text-[var(--accent)]" />
        <p className="text-[10px] text-[var(--text-muted)]">
          Pivots are normal — return to any stage, rework it, and the captured work carries forward everywhere.
        </p>
      </div>
    </div>,
    document.body
  );
}
