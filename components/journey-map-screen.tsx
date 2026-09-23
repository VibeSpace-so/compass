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
  MAP_POIS,
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

// Ink-on-parchment palette (kept inline — the map borrows none of the app's neon vars).
const INK = "#4a3419";
const OXBLOOD = "#8a3324";
const PAPER = "#f1e2bb";
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

/** Hazards sit OFF the trail, alternating sides — things to steer around. */
function riskSpot(stageIdx: number, riskIdx: number) {
  const node = MAP_STAGES[stageIdx];
  if (stageIdx === 0) return { x: node.x + 56 + riskIdx * 40, y: node.y - 52 };
  const segs = MAP_STAGES.length - 1;
  const t = (stageIdx - 1 + 0.45 + riskIdx * 0.22) / segs;
  const on = curvePoint(MAP_STAGES, t);
  const n = curveNormal(MAP_STAGES, t);
  const side = riskIdx % 2 === 0 ? 1 : -1;
  const off = 44 + riskIdx * 12;
  return { x: on.x + n.x * off * side, y: on.y + n.y * off * side };
}

/** Milestone flags are planted ON the trail just before the stage's node. */
function flagSpot(stageIdx: number) {
  const segs = MAP_STAGES.length - 1;
  const t = stageIdx === 0 ? 0.06 / segs : (stageIdx - 0.13) / segs;
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
    <div className="w-16 h-16 rounded-full border-2 border-[#4a3419] bg-[#efe0b5] flex items-center justify-center shadow-[0_2px_10px_rgba(58,38,12,0.4)]">
      <svg viewBox="0 0 64 64" className="w-12 h-12">
        <circle cx="32" cy="32" r="29" fill="none" stroke="#4a3419" strokeOpacity="0.4" strokeWidth="1" />
        <text x="32" y="10" textAnchor="middle" fontSize="7" fill="#4a3419" fontFamily={MAP_FONT}>N</text>
        <g transform={`rotate(${deg} 32 32)`}>
          <polygon points="32,8 35,32 32,28 29,32" fill="#8a3324" />
          <polygon points="32,56 35,32 32,36 29,32" fill="#4a3419" opacity="0.45" />
        </g>
        <circle cx="32" cy="32" r="2.4" fill="#8a3324" />
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

  // Ctrl/Cmd + wheel zooms (non-passive so preventDefault works).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !mounted) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoom((z) => Math.min(2.5, Math.max(0.6, z * (e.deltaY < 0 ? 1.12 : 0.9))));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
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
    milestone: "border-[#3f6b35] text-[#2e4d28]",
    warn: "border-[#8a6a1f] text-[#6b5114]",
    danger: "border-[#9c2f1e] text-[#7c2416]",
    poi: "border-[#6b5433] text-[#4a3419]",
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
            <p className="text-[10px] text-[var(--text-muted)]">
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

      <div className="flex-1 flex flex-col sm:flex-row min-h-0">
        {/* Map canvas — scroll/pan via overflow, zoom via scaled layer */}
        <div className="flex-1 min-h-[300px] sm:min-h-0 relative">
          <div ref={scrollRef} className="absolute inset-0 overflow-auto mobile-scroll flex">
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
            {/* Aged parchment + edge burn */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/map-parchment.jpg"
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_110px_rgba(58,38,12,0.5)]" />
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

              {/* Named regions — hatched ink zones behind the trail */}
              {MAP_REGIONS.map((r) => (
                <g key={r.label}>
                  <path
                    d={closedBlobPath(r)}
                    fill="#8a6a35"
                    fillOpacity="0.07"
                    stroke={INK}
                    strokeOpacity="0.4"
                    strokeWidth="1"
                    strokeDasharray="3 6"
                    filter="url(#mapInk)"
                  />
                  <text
                    x={r.x}
                    y={r.y + r.ry * 0.52}
                    textAnchor="middle"
                    fontSize="17"
                    fontStyle="italic"
                    letterSpacing="7"
                    fill={INK}
                    fillOpacity="0.34"
                    fontFamily={MAP_FONT}
                  >
                    {r.label}
                  </text>
                </g>
              ))}

              {/* Decorative ink — ridge lines and woods, no interaction */}
              <g
                stroke={INK}
                fill="none"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.5"
                filter="url(#mapInk)"
              >
                <path d="M 742,118 l 14,-22 l 14,22 M 764,121 l 11,-18 l 11,18 M 784,114 l 15,-24 l 15,24" />
                <path d="M 855,108 l 11,-18 l 11,18 M 871,112 l 9,-15 l 9,15" />
                <path d="M 210,548 l 6,-14 l 6,14 z M 216,548 v 6 M 230,556 l 5,-12 l 5,12 z M 235,556 v 6 M 250,544 l 6,-15 l 6,15 z M 256,544 v 7" />
                <path d="M 882,548 q 8,-9 16,0 M 904,555 q 7,-8 14,0" />
              </g>

              {/* Visited trail — oxblood ink */}
              <path
                d={visitedPath}
                fill="none"
                stroke={OXBLOOD}
                strokeWidth="3.2"
                strokeDasharray="12 6"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.85"
                filter="url(#mapInk)"
              />
              {/* Unvisited trail — dotted ink */}
              <path
                d={futurePath}
                fill="none"
                stroke={INK}
                strokeWidth="2.6"
                strokeDasharray="0.5 9"
                strokeLinecap="round"
                opacity="0.55"
                filter="url(#mapInk)"
              />

              {/* Stage territories — country names on the map, no icons */}
              {MAP_STAGES.map((def, i) => {
                const s = getStage(def.id);
                const label = s?.label ?? def.id;
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
                    <path
                      d={closedBlobPath(terr)}
                      fill={PAPER}
                      fillOpacity={isCurrent ? 0.95 : 0.82}
                      stroke={isCurrent ? OXBLOOD : INK}
                      strokeOpacity={isCurrent ? 0.95 : isPast ? 0.7 : 0.45}
                      strokeWidth={isCurrent || isSelected ? 2.4 : 1.4}
                      filter="url(#mapInk)"
                    />
                    {isCurrent && (
                      <path
                        d={closedBlobPath({ ...terr, rx: terr.rx - 6, ry: terr.ry - 5 })}
                        fill="none"
                        stroke={OXBLOOD}
                        strokeOpacity="0.55"
                        strokeWidth="0.8"
                        filter="url(#mapInk)"
                      />
                    )}
                    <text
                      x={def.x}
                      y={def.y + 4}
                      textAnchor="middle"
                      fontSize={isCurrent ? 15 : label.length > 12 ? 11 : 13}
                      letterSpacing="2.5"
                      fill={isCurrent ? OXBLOOD : INK}
                      fillOpacity={isCurrent ? 1 : isPast ? 0.8 : 0.6}
                      fontFamily={MAP_FONT}
                    >
                      {label}
                    </text>
                    {isPast && (
                      <text
                        x={def.x}
                        y={def.y + 17}
                        textAnchor="middle"
                        fontSize="7"
                        fontStyle="italic"
                        letterSpacing="2"
                        fill={INK}
                        fillOpacity="0.55"
                        fontFamily={MAP_FONT}
                      >
                        · passed ·
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Cartographer's rose */}
              <g transform="translate(952,556)" opacity="0.6">
                <circle r="27" fill="none" stroke={INK} strokeWidth="0.9" />
                <circle r="21" fill="none" stroke={INK} strokeWidth="0.4" />
                <path
                  d="M0,-25 L4,-4 L25,0 L4,4 L0,25 L-4,4 L-25,0 L-4,-4 Z"
                  fill="rgba(74,52,25,0.12)"
                  stroke={INK}
                  strokeWidth="0.7"
                />
                <path d="M0,-25 L4,-4 L0,0 L-4,-4 Z" fill={INK} />
                <text y="-32" textAnchor="middle" fontSize="10" fill={INK} fontFamily={MAP_FONT}>
                  N
                </text>
              </g>

              {/* Double-rule map frame + corner ticks */}
              <g fill="none" stroke={INK} pointerEvents="none">
                <rect x="9" y="9" width={BASE_W - 18} height={BASE_H - 18} strokeWidth="1.8" strokeOpacity="0.7" />
                <rect x="16" y="16" width={BASE_W - 32} height={BASE_H - 32} strokeWidth="0.7" strokeOpacity="0.5" />
                <path
                  d="M 9,40 v -31 h 31 M 960,9 h 31 v 31 M 991,580 v 31 h -31 M 40,611 h -31 v -31"
                  strokeWidth="2.6"
                  strokeOpacity="0.75"
                />
              </g>
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
                  <span className="w-5 h-5 rounded-full bg-[#f1e2bb]/90 border border-[#4a3419] flex items-center justify-center group-hover:bg-[#f7ecc9] transition-colors shadow-[0_1px_3px_rgba(58,38,12,0.4)]">
                    <Icon className="w-3 h-3 text-[#4a3419]" />
                  </span>
                  <span
                    className="mt-0.5 text-[8px] uppercase tracking-wider text-[#4a3419] px-1 rounded whitespace-nowrap"
                    style={{ fontFamily: MAP_FONT, textShadow: "0 0 4px #f1e2bb, 0 0 6px #f1e2bb" }}
                  >
                    {poi.label}
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
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#f1e2bb] border-2 border-[#9c2f1e] shadow-[0_1px_4px_rgba(58,38,12,0.4)]">
                        <Skull className="w-3.5 h-3.5 text-[#9c2f1e]" />
                      </span>
                    ) : (
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#f1e2bb] border-[1.5px] border-[#8a6a1f] shadow-[0_1px_3px_rgba(58,38,12,0.35)]">
                        <AlertTriangle className="w-3 h-3 text-[#8a6a1f]" />
                      </span>
                    )}
                    {!readIds.has(tipId) && (
                      <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#9c2f1e] text-[#f1e2bb] text-[8px] font-bold leading-none">
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
                  <Flag className="w-4 h-4 text-[#3f6b35] drop-shadow-[0_1px_2px_rgba(58,38,12,0.4)]" />
                  {!readIds.has(tipId) && (
                    <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#9c2f1e] text-[#f1e2bb] text-[8px] font-bold leading-none">
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
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#8a3324] opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#8a3324]" />
              </span>
              <MapPin className="w-4 h-4 text-[#8a3324] mt-0.5" />
            </div>

              </div>

              {/* Tooltip — outside the scaled layer so it stays readable at any zoom */}
              {tooltip && (
                <div
                  className={`absolute z-10 max-w-[240px] px-3 py-2 rounded-md border-2 bg-[#f1e2bb] shadow-[0_3px_12px_rgba(58,38,12,0.45)] text-left pointer-events-none ${toneStyles[tooltip.tone]}`}
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
              className="text-[9px] uppercase tracking-wider text-[#4a3419] bg-[#efe0b5]/95 px-1.5 py-0.5 rounded border border-[#4a3419] whitespace-nowrap"
              style={{ fontFamily: MAP_FONT }}
            >
              → {targetStage?.label ?? "Stay"}
            </div>
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-3 right-3 flex flex-col items-center gap-0.5 rounded-md border-2 border-[#4a3419] bg-[#efe0b5]/95 p-1 shadow-[0_2px_8px_rgba(58,38,12,0.4)]">
            <button
              onClick={() => setZoom((z) => Math.min(2.5, z * 1.25))}
              className="p-1.5 rounded text-[#4a3419] hover:bg-[#4a3419]/10 transition-colors"
              title="Zoom in"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="px-1 py-0.5 rounded text-[9px] tabular-nums text-[#4a3419] hover:bg-[#4a3419]/10 transition-colors"
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.6, z * 0.8))}
              className="p-1.5 rounded text-[#4a3419] hover:bg-[#4a3419]/10 transition-colors"
              title="Zoom out"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Detail panel */}
        <div className="w-full sm:w-[340px] max-h-[45vh] sm:max-h-none border-t sm:border-t-0 sm:border-l border-[var(--accent-26)] bg-black/60 backdrop-blur-sm flex flex-col min-h-[240px] sm:min-h-0 overflow-y-auto mobile-scroll flex-shrink-0">
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
