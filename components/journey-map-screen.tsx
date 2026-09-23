"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Compass as CompassIcon,
  Diamond,
  MapPin,
  Pencil,
  Pin,
  Trash2,
  X,
} from "lucide-react";
import { BYOKProvider, Project, ProjectMemory, StageId } from "@/lib/types";
import { getStage, getStageIndex } from "@/lib/stages";
import { getMapStage, MAP_STAGES, recommendedStage } from "@/lib/journey-map-data";
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
  tone: "milestone" | "warn" | "danger";
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Risk marker spots: hazards sit on the trail segment leading into the node. */
function riskSpot(stageIdx: number, riskIdx: number) {
  const node = MAP_STAGES[stageIdx];
  if (stageIdx === 0) return { x: node.x + 62 + riskIdx * 34, y: node.y - 46 };
  const prev = MAP_STAGES[stageIdx - 1];
  const t = 0.52 + riskIdx * 0.16;
  return { x: lerp(prev.x, node.x, t), y: lerp(prev.y, node.y, t) };
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
        <text x="32" y="10" textAnchor="middle" fontSize="7" fill="var(--accent)">N</text>
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

  const visitedPath = MAP_STAGES.slice(0, currentIdx + 1).map((s) => `${s.x},${s.y}`).join(" ");
  const futurePath = MAP_STAGES.slice(currentIdx).map((s) => `${s.x},${s.y}`).join(" ");

  const selectedGuidance = guidanceFor(selectedId);

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
    milestone: "border-[var(--accent-44)] text-[var(--text-secondary)]",
    warn: "border-yellow-500/50 text-yellow-200",
    danger: "border-red-500/60 text-red-200",
  };

  return (
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
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--accent-26)] text-xs text-[var(--text-secondary)] hover:border-[var(--accent-44)] hover:text-[var(--accent)] transition-colors flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
          Back to chat
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Map canvas */}
        <div className="flex-1 overflow-auto mobile-scroll relative">
          <div className="relative min-w-[700px] h-full min-h-[520px]">
            {/* Terrain texture */}
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, var(--accent) 0.8px, transparent 0.8px)",
                backgroundSize: "26px 26px",
              }}
            />
            <svg viewBox="0 0 1000 620" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
              {/* Visited trail */}
              <polyline
                points={visitedPath}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.55"
              />
              {/* Unvisited trail */}
              <polyline
                points={futurePath}
                fill="none"
                stroke="var(--accent-44)"
                strokeWidth="3"
                strokeDasharray="2 10"
                strokeLinecap="round"
                opacity="0.5"
              />

              {/* Risk markers on the trail */}
              {MAP_STAGES.map((def, i) =>
                guidanceFor(def.id).risks.map((risk, ri) => {
                  const { x, y } = riskSpot(i, ri);
                  const danger = risk.severity === "danger";
                  return (
                    <g
                      key={`${def.id}-risk-${ri}`}
                      transform={`translate(${x},${y})`}
                      className="cursor-pointer"
                      onMouseEnter={() =>
                        setTooltip({ x, y, title: risk.title, detail: risk.detail, tone: risk.severity })
                      }
                      onMouseLeave={() => setTooltip(null)}
                      onClick={() =>
                        setTooltip({ x, y, title: risk.title, detail: risk.detail, tone: risk.severity })
                      }
                    >
                      <polygon
                        points="0,-13 12,9 -12,9"
                        fill={danger ? "rgba(127,29,29,0.85)" : "rgba(113,63,18,0.85)"}
                        stroke={danger ? "#ef4444" : "#eab308"}
                        strokeWidth="1.5"
                      />
                      <text y="6" textAnchor="middle" fontSize="10" fill={danger ? "#fca5a5" : "#fde047"}>
                        !
                      </text>
                    </g>
                  );
                })
              )}

              {/* Milestone diamonds */}
              {MAP_STAGES.map((def) => {
                const g = guidanceFor(def.id);
                if (g.milestones.length === 0) return null;
                const mx = def.x + 58;
                const my = def.y + 34;
                return (
                  <g
                    key={`${def.id}-ms`}
                    transform={`translate(${mx},${my})`}
                    className="cursor-pointer"
                    onMouseEnter={() =>
                      setTooltip({
                        x: mx,
                        y: my,
                        title: `${getStage(def.id)?.label} milestones`,
                        detail: g.milestones.map((m) => `• ${m}`).join("\n"),
                        tone: "milestone",
                      })
                    }
                    onMouseLeave={() => setTooltip(null)}
                    onClick={() =>
                      setTooltip({
                        x: mx,
                        y: my,
                        title: `${getStage(def.id)?.label} milestones`,
                        detail: g.milestones.map((m) => `• ${m}`).join("\n"),
                        tone: "milestone",
                      })
                    }
                  >
                    <rect x="-6" y="-6" width="12" height="12" transform="rotate(45)" fill="var(--accent-10)" stroke="var(--accent)" strokeWidth="1.4" />
                  </g>
                );
              })}
            </svg>

            {/* Stage nodes (HTML for icon fidelity) */}
            {MAP_STAGES.map((def, i) => {
              const isCurrent = i === currentIdx;
              const isPast = i < currentIdx;
              const isSelected = def.id === selectedId;
              const s = getStage(def.id);
              return (
                <button
                  key={def.id}
                  onClick={() => { setSelectedId(def.id); setActiveTab("overview"); }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-1 group"
                  style={{ left: `${def.x / 10}%`, top: `${def.y / 6.2}%` }}
                >
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all ${
                      isCurrent
                        ? "border-[var(--accent)] bg-[var(--accent)] text-black shadow-[0_0_20px_var(--accent)]"
                        : isPast
                          ? "border-[var(--accent-44)] bg-black/80 text-[var(--accent)]"
                          : "border-[var(--accent-26)] bg-black/80 text-[var(--text-muted)] group-hover:border-[var(--accent-44)]"
                    } ${isSelected && !isCurrent ? "ring-2 ring-[var(--accent-44)] ring-offset-2 ring-offset-black" : ""}`}
                  >
                    {isPast ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <StageIcon name={s?.lucideIcon ?? "compass"} className="w-4 h-4" />
                    )}
                  </div>
                  {isCurrent && (
                    <span className="absolute -top-2 -right-2 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-60" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--accent)]" />
                    </span>
                  )}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded bg-black/70 border ${
                      isCurrent
                        ? "border-[var(--accent)] text-[var(--accent)]"
                        : "border-[var(--accent-26)] text-[var(--text-secondary)]"
                    } whitespace-nowrap`}
                  >
                    {s?.label}
                  </span>
                </button>
              );
            })}

            {/* Tooltip */}
            {tooltip && (
              <div
                className={`absolute z-10 max-w-[240px] px-3 py-2 rounded-lg border bg-black/95 shadow-xl text-left pointer-events-none ${toneStyles[tooltip.tone]}`}
                style={{
                  left: `clamp(8px, ${tooltip.x / 10}%, calc(100% - 250px))`,
                  top: `clamp(8px, ${tooltip.y / 6.2 + 3}%, calc(100% - 110px))`,
                }}
              >
                <div className="text-[11px] font-semibold mb-0.5">{tooltip.title}</div>
                <div className="text-[10px] leading-relaxed whitespace-pre-line opacity-90">
                  {tooltip.detail}
                </div>
              </div>
            )}

            {/* Compass + bearing */}
            <div className="absolute top-3 right-3 flex flex-col items-center gap-1.5">
              <CompassNeedle
                fromX={currentNode.x}
                fromY={currentNode.y}
                toX={targetNode.x}
                toY={targetNode.y}
              />
              <div className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] bg-black/70 px-1.5 py-0.5 rounded border border-[var(--accent-26)] whitespace-nowrap">
                → {targetStage?.label ?? "Stay"}
              </div>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div className="w-full sm:w-[340px] border-t sm:border-t-0 sm:border-l border-[var(--accent-26)] bg-black/60 backdrop-blur-sm flex flex-col min-h-[240px] sm:min-h-0 overflow-y-auto mobile-scroll">
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
    </div>
  );
}
