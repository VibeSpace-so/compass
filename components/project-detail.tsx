"use client";

import { useState, useEffect, isValidElement, cloneElement } from "react";
import { BYOKProvider, ChatMessage, Project, ProjectDoc, ProjectDocSectionId, StageId, DebtLevel, Integration, ProjectMemory } from "@/lib/types";
import { getStage, getNextStage, getStageIndex, STAGES } from "@/lib/stages";
import { getStageThreshold } from "@/lib/flow-orchestrator";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Save,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Wrench,
  MapPin,
  Info,
  Lock,
  X,
  Download,
  AlertTriangle,
} from "lucide-react";
import { exportProject } from "@/lib/project-export";
import { generateId } from "@/lib/storage";
import { addMemory } from "@/lib/memories";
import StageIcon from "./stage-icon";
import JourneyMap from "./journey-map";
import IntegrationsPanel from "./integrations-panel";
import { ProjectBrief } from "./project-brief";
import JourneyMapScreen from "./journey-map-screen";

interface ProjectDetailProps {
  project: Project;
  onUpdate: (updates: Partial<Project>) => void;
  onBack: () => void;
  chatPanel: React.ReactNode;
  integrations: Integration[];
  onToggleIntegration: (id: string) => void;
  memories: ProjectMemory[];
  onRemoveMemory?: (memoryId: string) => void;
  onUpdateMemory?: (memoryId: string, content: string) => void;
  doc?: ProjectDoc;
  onUpdateDocSection?: (sectionId: ProjectDocSectionId, content: string) => void;
  onPinMemory?: (memoryId: string, pinned: boolean) => void;
  onUpdateMemoryTags?: (memoryId: string, tags: string[]) => void;
  showEncryptReminder?: boolean;
  onEncryptClick?: () => void;
  onSystemMessage?: (message: ChatMessage) => void;
  /** Successful non-memory tool calls executed in the current stage. */
  stageToolActions?: number;
  providers?: BYOKProvider[];
  onMemoriesChange?: () => void;
}

function DebtSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: DebtLevel;
  onChange: (v: DebtLevel) => void;
}) {
  const levels: DebtLevel[] = ["low", "medium", "high"];
  const colors: Record<DebtLevel, { active: string; inactive: string }> = {
    low: {
      active: "bg-[var(--accent)] text-black border-[var(--accent)]",
      inactive:
        "border-[var(--accent-26)] text-[var(--text-muted)] hover:border-[var(--accent-44)]",
    },
    medium: {
      active: "bg-yellow-500 text-black border-yellow-500",
      inactive:
        "border-yellow-600/30 text-yellow-400/70 hover:border-yellow-600/50",
    },
    high: {
      active: "bg-red-500 text-black border-red-500",
      inactive:
        "border-red-500/30 text-red-300/70 hover:border-red-500/50",
    },
  };

  return (
    <div>
      <label className="block text-xs text-[var(--text-secondary)] mb-1.5">
        {label}
      </label>
      <div className="flex gap-1.5">
        {levels.map((l) => (
          <button
            key={l}
            onClick={() => onChange(l)}
            className={`flex-1 px-2 py-1.5 rounded text-[10px] font-medium border transition-all ${
              value === l ? colors[l].active : colors[l].inactive
            }`}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-[var(--accent-10)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-[var(--text-muted)] tabular-nums whitespace-nowrap">
        {current}/{total}
      </span>
    </div>
  );
}

function Section({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-[var(--accent-26)] rounded-xl">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
          {title}
        </span>
        {open ? (
          <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
        ) : (
          <ChevronRight className="w-3 h-3 text-[var(--text-muted)]" />
        )}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

type SidebarTab = "context" | "brief" | "settings";

const BRIEF_PREVIEW_SECTIONS: { id: ProjectDocSectionId; label: string }[] = [
  { id: "problem", label: "Problem" },
  { id: "targetUser", label: "Target user" },
  { id: "constraints", label: "Constraints" },
];

// Records a stage change in the transcript itself — the greeting card only
// renders for empty transcripts, so history needs a real marker to keep
// "where am I" legible when scrolling back.
function stageMarker(targetId: StageId): ChatMessage {
  const stage = getStage(targetId);
  return {
    id: generateId(),
    role: "assistant",
    content: stage
      ? `**Moved to ${stage.label}** — ${stage.nextAction}`
      : `**Moved to ${targetId}**`,
    timestamp: new Date().toISOString(),
  };
}

function firstDocLine(
  doc: ProjectDoc | undefined,
  id: ProjectDocSectionId
): string | null {
  const section = doc?.sections.find((s) => s.id === id);
  const line = section?.content
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^-\s*/, ""))
    .find(Boolean);
  return line ?? null;
}

export default function ProjectDetail({
  project,
  onUpdate,
  onBack,
  chatPanel,
  integrations,
  onToggleIntegration,
  memories,
  onRemoveMemory,
  onUpdateMemory,
  doc,
  onUpdateDocSection,
  onPinMemory,
  onUpdateMemoryTags,
  showEncryptReminder = false,
  onEncryptClick,
  onSystemMessage,
  stageToolActions = 0,
  providers,
  onMemoriesChange,
}: ProjectDetailProps) {
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("context");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [reminderDismissed, setReminderDismissed] = useState(false);
  const [exportError, setExportError] = useState("");
  const [pendingAdvance, setPendingAdvance] = useState<{
    stageId: StageId;
    reason: string;
  } | null>(null);
  const [showMap, setShowMap] = useState(false);

  const stage = getStage(project.currentStage);
  const nextStage = getNextStage(project.currentStage);
  const stageIdx = getStageIndex(project.currentStage);
  const completedActions = memories.filter(
    (memory) => memory.stage === project.currentStage
  );
  const stageThreshold = getStageThreshold(project.currentStage);
  const buildIndex = getStageIndex("build-prototype");
  const hasValidationEvidence = memories.some((memory) =>
    (["landing-page", "hosting", "domain"] as StageId[]).includes(memory.stage)
  );
  const docFilledCount =
    doc?.sections.filter((section) => section.content.trim()).length ?? 0;
  const docTotalCount = doc?.sections.length ?? BRIEF_PREVIEW_SECTIONS.length;

  // Forward movement is free when it follows the arc; skipping stages or
  // building without demand evidence earns a warning instead of a block.
  // Returns the outcome so the model's advance_stage tool can report it.
  function requestStage(targetId: StageId): "applied" | "pending" | "noop" {
    const targetIdx = getStageIndex(targetId);
    if (targetIdx < 0 || targetIdx === stageIdx) return "noop";

    const reasons: string[] = [];
    if (targetIdx > stageIdx + 1) {
      const skipped = targetIdx - stageIdx - 1;
      reasons.push(`skips ${skipped} stage${skipped === 1 ? "" : "s"}`);
    }
    if (targetIdx > stageIdx && targetIdx >= buildIndex && !hasValidationEvidence) {
      reasons.push("goes straight to building with no demand evidence saved yet");
    }
    if (targetIdx > stageIdx && completedActions.length < stageThreshold) {
      reasons.push(
        `only ${completedActions.length} of ${stageThreshold} suggested stage actions are captured`
      );
    }
    if (reasons.length > 0) {
      setPendingAdvance({
        stageId: targetId,
        reason: `Moving to ${getStage(targetId)?.label ?? targetId} ${reasons.join(
          " and "
        )} — the journey works because each stage feeds the next.`,
      });
      return "pending";
    }
    setPendingAdvance(null);
    onUpdate({ currentStage: targetId });
    onSystemMessage?.(stageMarker(targetId));
    return "applied";
  }

  // Backward moves apply immediately; record the pivot as a decision so the
  // journey keeps an honest trail of why the project walked back.
  function requestStageFromMap(targetId: StageId): "applied" | "pending" | "noop" {
    const fromLabel = stage?.label ?? project.currentStage;
    const outcome = requestStage(targetId);
    if (outcome === "applied" && getStageIndex(targetId) < stageIdx) {
      addMemory(
        project.id,
        "decision",
        `Pivoted back from ${fromLabel} to ${getStage(targetId)?.label ?? targetId} — reworking an earlier stage.`,
        targetId,
        "ai"
      );
      onMemoriesChange?.();
    }
    return outcome;
  }

  function confirmPendingAdvance() {
    if (!pendingAdvance) return;
    const targetId = pendingAdvance.stageId;
    setPendingAdvance(null);
    onUpdate({ currentStage: targetId });
    onSystemMessage?.(stageMarker(targetId));
  }

  function handleExport() {
    try {
      const data = exportProject(project.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${project.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "project"}.compass.json`;
      link.click();
      URL.revokeObjectURL(url);
      setExportError("");
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Unable to export this project."
      );
    }
  }

  // The sidebar is a full-screen overlay below md — keep the chat in front on open.
  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setSidebarOpen(false);
    }
  }, []);

  // Keyboard shortcut for sidebar toggle
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+B toggle sidebar
      if (e.ctrlKey && e.key === "b") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
      // Ctrl+/ focus chat input
      if (e.ctrlKey && e.key === "/") {
        e.preventDefault();
        const chatInput = document.querySelector<HTMLInputElement>(
          'input[placeholder*="Ask anything"]'
        );
        chatInput?.focus();
      }
      // Alt+1/2/3 switch sidebar tabs
      if (e.altKey && ["1", "2", "3"].includes(e.key)) {
        e.preventDefault();
        const tabs: SidebarTab[] = ["context", "brief", "settings"];
        setSidebarOpen(true);
        setSidebarTab(tabs[Number(e.key) - 1]);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const sidebarTabs: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
    { id: "context", label: "Context", icon: <MapPin className="w-3 h-3" /> },
    { id: "brief", label: `Brief${memories.length > 0 ? ` (${memories.length})` : ""}`, icon: <BookOpen className="w-3 h-3" /> },
    { id: "settings", label: "Settings", icon: <Wrench className="w-3 h-3" /> },
  ];

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col">
      {/* Compact header with progress */}
      <div className="border-b border-[var(--accent-26)] px-4 py-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded border border-[var(--accent-26)] text-[var(--text-muted)] hover:border-[var(--accent-44)] hover:text-[var(--accent)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="flex-1 min-w-0">
            {editingName ? (
              <input
                type="text"
                defaultValue={project.name}
                autoFocus
                onBlur={(e) => {
                  if (e.target.value.trim()) {
                    onUpdate({ name: e.target.value.trim() });
                  }
                  setEditingName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="bg-transparent border-b border-[var(--accent-44)] text-sm font-medium text-[var(--accent)] w-full focus:border-[var(--accent)] outline-none py-0.5"
              />
            ) : (
              <h1
                className="text-sm font-medium text-[var(--accent)] cursor-pointer hover:underline decoration-[var(--accent-44)] underline-offset-4 truncate"
                onClick={() => setEditingName(true)}
                title="Click to edit"
              >
                {project.name}
              </h1>
            )}
          </div>

          {/* Stage progress indicator */}
          <div className="hidden md:flex items-center gap-2 min-w-[180px]">
            <ProgressBar current={stageIdx + 1} total={STAGES.length} />
          </div>

          {/* Current stage badge */}
          {stage && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded border border-[var(--accent-44)] bg-[var(--accent-10)]">
              <StageIcon name={stage.lucideIcon} className="w-3 h-3 text-[var(--accent)]" />
              <span className="text-[10px] text-[var(--text-secondary)]">{stage.label}</span>
            </div>
          )}

          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-[var(--accent-26)] text-[10px] text-[var(--text-secondary)] hover:border-[var(--accent-44)] hover:text-[var(--accent)] transition-colors"
            title="Export project data"
          >
            <Download className="w-3 h-3" />
            Export
          </button>

          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="relative p-1.5 rounded border border-[var(--accent-26)] text-[var(--text-muted)] hover:border-[var(--accent-44)] hover:text-[var(--accent)] transition-colors"
            title="Toggle sidebar (Ctrl+B)"
          >
            <Info className="w-4 h-4" />
            {pendingAdvance && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_4px_rgba(234,179,8,0.8)]" />
            )}
          </button>
        </div>
        {exportError && (
          <p className="max-w-7xl mx-auto mt-2 text-[10px] text-red-400">
            {exportError}
          </p>
        )}
      </div>

      {/* Two-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Primary panel — Chat */}
        <div className="flex-1 flex flex-col min-w-0 px-4 py-4 overflow-hidden">
          {/* Description */}
          <div className="mb-3 flex-shrink-0">
            {editingDesc ? (
              <textarea
                defaultValue={project.description}
                autoFocus
                rows={2}
                onBlur={(e) => {
                  onUpdate({ description: e.target.value.trim() });
                  setEditingDesc(false);
                }}
                className="w-full bg-transparent border border-[var(--accent-26)] rounded-xl px-3 py-2 text-xs text-[var(--text-secondary)] focus:border-[var(--accent)] outline-none resize-none"
              />
            ) : (
              <p
                className="text-xs text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-secondary)] transition-colors leading-relaxed truncate"
                onClick={() => setEditingDesc(true)}
                title="Click to edit"
              >
                {project.description || "Click to add a description..."}
              </p>
            )}
          </div>

          {/* Encrypt reminder */}
          {showEncryptReminder && !reminderDismissed && (
            <div className="flex items-center gap-2 mb-3 p-3 rounded border border-yellow-600/40 bg-yellow-500/5 flex-shrink-0">
              <Lock className="w-4 h-4 text-yellow-500 flex-shrink-0" />
              <div className="flex-1 text-[11px] text-yellow-500/90 leading-relaxed">
                You&apos;ve added API keys. Encrypt this project with a password to
                protect them.
              </div>
              <button
                onClick={onEncryptClick}
                className="flex-shrink-0 px-2.5 py-1 rounded text-[10px] font-medium border border-yellow-600/50 text-yellow-500 hover:bg-yellow-500/10 transition-colors"
              >
                Encrypt now
              </button>
              <button
                onClick={() => setReminderDismissed(true)}
                className="flex-shrink-0 p-1 text-yellow-500/60 hover:text-yellow-500 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Chat fills remaining space */}
          <div className="flex-1 overflow-hidden">
            {isValidElement<{ onStageAdvanceGate?: typeof requestStage }>(chatPanel)
              ? cloneElement(chatPanel, { onStageAdvanceGate: requestStage })
              : chatPanel}
          </div>
        </div>

        {/* Secondary panel — Context sidebar (desktop: side panel, mobile: overlay) */}
        {sidebarOpen && (
          <div className="fixed inset-x-0 bottom-0 top-12 z-30 md:relative md:inset-auto md:z-auto md:top-auto flex flex-col w-full md:w-[340px] border-l border-[var(--accent-26)] overflow-hidden flex-shrink-0 bg-[#0a0a0a] md:bg-transparent">
            {/* Sidebar header with close button on mobile */}
            <div className="flex items-center border-b border-[var(--accent-26)] flex-shrink-0">
              {sidebarTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSidebarTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[10px] font-medium transition-colors border-b-2 -mb-px ${
                    sidebarTab === tab.id
                      ? "text-[var(--accent)] border-[var(--accent)]"
                      : "text-[var(--text-muted)] border-transparent hover:text-[var(--text-secondary)]"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
              <button
                onClick={() => setSidebarOpen(false)}
                className="px-3 py-2.5 text-[var(--text-muted)] hover:text-[var(--accent)] md:hidden"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sidebar content */}
            <div className="flex-1 overflow-y-auto p-4">
              {sidebarTab === "context" && (
                <div className="space-y-4">
                  {/* Journey stepper — always-on wayfinding */}
                  <div className="rounded-xl border border-[var(--accent-26)] p-3">
                    <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                      Your journey
                    </div>
                    <div className="relative">
                      <div
                        className="absolute left-[5px] top-2 bottom-2 w-px bg-[var(--accent-15)]"
                        aria-hidden
                      />
                      {STAGES.map((s, i) => {
                        const isPast = i < stageIdx;
                        const isCurrent = i === stageIdx;
                        return (
                          <button
                            key={s.id}
                            onClick={() => requestStage(s.id)}
                            title={s.description}
                            className="relative w-full flex items-center gap-2.5 py-1 text-left group"
                          >
                            <span
                              className={`relative z-10 flex-shrink-0 w-2.5 h-2.5 rounded-full border transition-colors ${
                                isCurrent
                                  ? "bg-[var(--accent)] border-[var(--accent)] shadow-[0_0_6px_var(--accent)]"
                                  : isPast
                                    ? "bg-[var(--accent-44)] border-[var(--accent-44)]"
                                    : "bg-black border-[var(--accent-26)] group-hover:border-[var(--accent-44)]"
                              }`}
                            />
                            <span
                              className={`flex-1 min-w-0 truncate text-[11px] transition-colors ${
                                isCurrent
                                  ? "text-[var(--accent)] font-medium"
                                  : isPast
                                    ? "text-[var(--text-muted)]"
                                    : "text-[var(--text-secondary)] group-hover:text-[var(--accent)]"
                              }`}
                            >
                              {s.label}
                            </span>
                            {isCurrent && (
                              <span className="flex-shrink-0 text-[9px] font-medium uppercase tracking-wider text-[var(--accent)]">
                                Now
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Advancement warning */}
                  {pendingAdvance && (
                    <div className="rounded-xl border border-yellow-600/40 bg-yellow-500/5 p-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-yellow-500/90 leading-relaxed">
                          {pendingAdvance.reason}
                        </p>
                      </div>
                      <div className="flex gap-2 mt-2.5">
                        <button
                          onClick={confirmPendingAdvance}
                          className="flex-1 px-2.5 py-1.5 rounded text-[10px] font-medium border border-yellow-600/50 text-yellow-500 hover:bg-yellow-500/10 transition-colors"
                        >
                          Continue anyway
                        </button>
                        <button
                          onClick={() => setPendingAdvance(null)}
                          className="flex-1 px-2.5 py-1.5 rounded text-[10px] border border-[var(--accent-26)] text-[var(--text-secondary)] hover:border-[var(--accent-44)] hover:text-[var(--accent)] transition-colors"
                        >
                          Stay here
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Current stage card */}
                  {stage && (
                    <div className="rounded-xl border border-[var(--accent-26)] bg-[var(--accent-10)] p-4 shadow-[inset_2px_0_0_var(--accent)]">
                      <div className="flex items-center gap-2 mb-2">
                        <StageIcon name={stage.lucideIcon} className="w-4 h-4 text-[var(--accent)]" />
                        <span className="text-xs font-medium text-[var(--accent)]">
                          {stage.label}
                        </span>
                        <span className="ml-auto flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--accent)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_6px_var(--accent)]" />
                          Current
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">
                        {stage.description}
                      </p>
                      <div className="rounded-lg bg-black/40 border border-[var(--accent-15)] p-2.5">
                        <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-0.5">
                          Next move
                        </div>
                        <p className="text-xs text-[var(--accent)] leading-relaxed">
                          {stage.nextAction}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Stage progress + advance, merged — opens the journey map */}
                  <div className="border border-[var(--accent-26)] rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
                        Stage progress
                      </div>
                      <button
                        onClick={() => setShowMap(true)}
                        className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                        title="Open journey map"
                      >
                        <MapPin className="w-3 h-3" />
                        map
                      </button>
                    </div>
                    <div className="mt-1 text-[10px] text-[var(--text-muted)]">
                      {nextStage
                        ? `${completedActions.length} action${completedActions.length === 1 ? "" : "s"} captured · threshold ${stageThreshold} to advance`
                        : `${completedActions.length} action${completedActions.length === 1 ? "" : "s"} captured · journey complete`}
                    </div>
                    <div className="mt-2 h-1 rounded-full bg-[var(--accent-10)] overflow-hidden">
                      <div
                        className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (completedActions.length / stageThreshold) * 100)}%` }}
                      />
                    </div>
                    {!nextStage && (
                      <p className="text-[10px] text-[var(--text-muted)] mt-2">
                        Validation never stops — keep the loop running.
                      </p>
                    )}
                    <button
                      onClick={() => setShowMap(true)}
                      className="mt-1.5 w-full text-left text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
                    >
                      Click to open the journey map →
                    </button>
                    {nextStage && (
                      <>
                        <button
                          onClick={() => requestStage(nextStage.id)}
                          className={`mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-medium transition-opacity ${
                            completedActions.length >= stageThreshold
                              ? "bg-[var(--accent)] text-black hover:opacity-80"
                              : "border border-[var(--accent-26)] text-[var(--text-secondary)] hover:border-[var(--accent-44)] hover:text-[var(--accent)]"
                          }`}
                        >
                          Advance to {nextStage.label}
                          <ArrowRight className="w-3 h-3" />
                        </button>
                        <p className="text-[10px] text-[var(--text-muted)] mt-2 text-center">
                          Or type /advance in chat
                        </p>
                      </>
                    )}
                  </div>

                  {/* Brief snapshot — context is always visible */}
                  <button
                    onClick={() => setSidebarTab("brief")}
                    className="w-full rounded-xl border border-[var(--accent-26)] p-3 text-left hover:border-[var(--accent-44)] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
                        Your brief
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] tabular-nums">
                        {docFilledCount}/{docTotalCount}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-[var(--accent-10)] overflow-hidden mb-2.5">
                      <div
                        className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, (docFilledCount / Math.max(docTotalCount, 1)) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="space-y-1.5">
                      {BRIEF_PREVIEW_SECTIONS.map(({ id, label }) => {
                        const content = firstDocLine(doc, id);
                        return (
                          <div key={id} className="flex gap-2 text-[11px]">
                            <span className="w-20 flex-shrink-0 text-[var(--text-muted)]">
                              {label}
                            </span>
                            <span
                              className={`flex-1 min-w-0 truncate ${
                                content
                                  ? "text-[var(--text-secondary)]"
                                  : "text-[var(--text-muted)] italic"
                              }`}
                            >
                              {content ?? "not captured yet"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </button>

                  {/* Deeper actions live behind expandable sections */}
                  <Section title="Tools & resources">
                    <div className="space-y-3">
                      {stage && (
                        <div>
                          <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                            Recommended tools
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {stage.tools.map((tool) => (
                              <button
                                key={tool}
                                onClick={() => onUpdate({ selectedTool: tool })}
                                className={`px-2 py-1 rounded text-[10px] border transition-colors ${
                                  project.selectedTool === tool
                                    ? "border-[var(--accent)] bg-[var(--accent)] text-black"
                                    : "border-[var(--accent-26)] text-[var(--text-secondary)] hover:border-[var(--accent-44)]"
                                }`}
                              >
                                {tool}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {stage && stage.links.length > 0 && (
                        <div>
                          <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                            Resources
                          </div>
                          <div className="space-y-1.5">
                            {stage.links.map((link) => (
                              <a
                                key={link.url}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
                              >
                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                {link.label}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Section>

                  <Section title="Integrations">
                    <IntegrationsPanel
                      integrations={integrations}
                      onToggle={onToggleIntegration}
                      stageId={project.currentStage}
                      projectId={project.id}
                    />
                  </Section>

                  <Section title="Journey map">
                    <JourneyMap
                      activeStage={project.currentStage}
                      onStageClick={(id: StageId) => requestStage(id)}
                      compact
                    />
                  </Section>
                </div>
              )}

              {sidebarTab === "brief" && (
                <ProjectBrief
                  memories={memories}
                  onRemoveMemory={onRemoveMemory}
                  onUpdateMemory={onUpdateMemory}
                  projectId={project.id}
                  projectName={project.name}
                  doc={doc}
                  onUpdateDocSection={onUpdateDocSection}
                  onPinMemory={onPinMemory}
                  onUpdateMemoryTags={onUpdateMemoryTags}
                />
              )}

              {sidebarTab === "settings" && (
                <div className="space-y-4">
                  {/* Notes */}
                  <div className="border border-[var(--accent-26)] rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
                        Notes
                      </label>
                      <Save className="w-3 h-3 text-[var(--text-muted)]" />
                    </div>
                    <textarea
                      value={project.notes}
                      onChange={(e) => onUpdate({ notes: e.target.value })}
                      placeholder="Jot down thoughts, decisions..."
                      rows={5}
                      className="w-full bg-black border border-[var(--accent-26)] rounded-md px-3 py-2 text-xs text-[var(--text-secondary)] focus:border-[var(--accent)] outline-none resize-none"
                    />
                  </div>

                  {/* Debt indicators */}
                  <div className="border border-[var(--accent-26)] rounded-xl p-3 space-y-3">
                    <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">
                      Debt indicators
                    </div>
                    <DebtSelector
                      label="Technical debt"
                      value={project.technicalDebt}
                      onChange={(v) => onUpdate({ technicalDebt: v })}
                    />
                    <DebtSelector
                      label="Cognitive debt"
                      value={project.cognitiveDebt}
                      onChange={(v) => onUpdate({ cognitiveDebt: v })}
                    />
                    <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                      Technical = code you&apos;ll fix later.
                      Cognitive = complexity you can&apos;t hold in your head.
                    </p>
                  </div>

                  {/* Backup reminder */}
                  <div className="border border-[var(--accent-26)] rounded-xl p-3">
                    <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                      Backup
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)] leading-relaxed mb-2">
                      Everything lives in this browser — export a JSON backup
                      regularly, especially before clearing site data.
                    </p>
                    <button
                      onClick={handleExport}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] border border-[var(--accent-26)] text-[var(--text-secondary)] hover:border-[var(--accent-44)] hover:text-[var(--accent)] transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Export backup
                    </button>
                  </div>

                  {/* Keyboard shortcuts */}
                  <div className="border border-[var(--accent-26)] rounded-xl p-3">
                    <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                      Keyboard shortcuts
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { key: "Ctrl+B", desc: "Toggle sidebar" },
                        { key: "Ctrl+/", desc: "Focus chat" },
                        { key: "Alt+1/2/3", desc: "Sidebar tabs" },
                        { key: "/advance", desc: "Advance stage" },
                      ].map((shortcut) => (
                        <div
                          key={shortcut.key}
                          className="flex items-center justify-between"
                        >
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {shortcut.desc}
                          </span>
                          <kbd className="text-[10px] text-[var(--accent)] bg-[var(--accent-10)] border border-[var(--accent-26)] rounded-xl px-1.5 py-0.5">
                            {shortcut.key}
                          </kbd>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showMap && (
        <JourneyMapScreen
          project={project}
          memories={memories}
          providers={providers}
          stageToolActions={stageToolActions}
          onStageChange={requestStageFromMap}
          onUpdateMemory={onUpdateMemory}
          onRemoveMemory={onRemoveMemory}
          onPinMemory={onPinMemory}
          onClose={() => setShowMap(false)}
        />
      )}
    </div>
  );
}
