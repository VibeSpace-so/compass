"use client";

import { useState, useEffect } from "react";
import { Project, StageId, DebtLevel, Integration, ProjectMemory } from "@/lib/types";
import { getStage, getNextStage, getStageIndex, STAGES } from "@/lib/stages";
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
  X,
} from "lucide-react";
import StageIcon from "./stage-icon";
import JourneyMap from "./journey-map";
import IntegrationsPanel from "./integrations-panel";
import { ProjectBrief } from "./project-brief";

interface ProjectDetailProps {
  project: Project;
  onUpdate: (updates: Partial<Project>) => void;
  onBack: () => void;
  chatPanel: React.ReactNode;
  integrations: Integration[];
  onToggleIntegration: (id: string) => void;
  memories: ProjectMemory[];
  onRemoveMemory?: (memoryId: string) => void;
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
        "border-[var(--accent-26)] text-[var(--accent-44)] hover:border-[var(--accent-44)]",
    },
    medium: {
      active: "bg-yellow-500 text-black border-yellow-500",
      inactive:
        "border-yellow-600/30 text-yellow-600/50 hover:border-yellow-600/50",
    },
    high: {
      active: "bg-red-500 text-black border-red-500",
      inactive:
        "border-red-500/30 text-red-500/50 hover:border-red-500/50",
    },
  };

  return (
    <div>
      <label className="block text-xs text-[var(--accent-88)] mb-1.5">
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
      <span className="text-[10px] text-[var(--accent-66)] tabular-nums whitespace-nowrap">
        {current}/{total}
      </span>
    </div>
  );
}

type SidebarTab = "context" | "brief" | "settings";

export default function ProjectDetail({
  project,
  onUpdate,
  onBack,
  chatPanel,
  integrations,
  onToggleIntegration,
  memories,
  onRemoveMemory,
}: ProjectDetailProps) {
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("context");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showMap, setShowMap] = useState(false);

  const stage = getStage(project.currentStage);
  const nextStage = getNextStage(project.currentStage);
  const stageIdx = getStageIndex(project.currentStage);

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
            className="p-1.5 rounded border border-[var(--accent-26)] text-[var(--accent-44)] hover:border-[var(--accent-44)] hover:text-[var(--accent)] transition-colors"
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
              <span className="text-[10px] text-[var(--accent-88)]">{stage.label}</span>
            </div>
          )}

          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded border border-[var(--accent-26)] text-[var(--accent-44)] hover:border-[var(--accent-44)] hover:text-[var(--accent)] transition-colors"
            title="Toggle sidebar (Ctrl+B)"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>
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
                className="w-full bg-transparent border border-[var(--accent-26)] rounded px-3 py-2 text-xs text-[var(--accent-cc)] focus:border-[var(--accent)] outline-none resize-none"
              />
            ) : (
              <p
                className="text-xs text-[var(--accent-66)] cursor-pointer hover:text-[var(--accent-88)] transition-colors leading-relaxed truncate"
                onClick={() => setEditingDesc(true)}
                title="Click to edit"
              >
                {project.description || "Click to add a description..."}
              </p>
            )}
          </div>

          {/* Chat fills remaining space */}
          <div className="flex-1 overflow-hidden">
            {chatPanel}
          </div>
        </div>

        {/* Secondary panel — Context sidebar (desktop: side panel, mobile: overlay) */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-30 md:relative md:inset-auto md:z-auto flex flex-col w-full md:w-[340px] border-l border-[var(--accent-26)] overflow-hidden flex-shrink-0 bg-[#0a0a0a] md:bg-transparent">
            {/* Sidebar header with close button on mobile */}
            <div className="flex items-center border-b border-[var(--accent-26)] flex-shrink-0">
              {sidebarTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setSidebarTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-[10px] font-medium transition-colors border-b-2 -mb-px ${
                    sidebarTab === tab.id
                      ? "text-[var(--accent)] border-[var(--accent)]"
                      : "text-[var(--accent-44)] border-transparent hover:text-[var(--accent-88)]"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
              <button
                onClick={() => setSidebarOpen(false)}
                className="px-3 py-2.5 text-[var(--accent-44)] hover:text-[var(--accent)] md:hidden"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sidebar content */}
            <div className="flex-1 overflow-y-auto p-4">
              {sidebarTab === "context" && (
                <div className="space-y-4">
                  {/* Current stage card */}
                  {stage && (
                    <div className="border border-[var(--accent)] rounded p-4 bg-[var(--accent-10)]">
                      <div className="flex items-center gap-2 mb-2">
                        <StageIcon name={stage.lucideIcon} className="w-4 h-4 text-[var(--accent)]" />
                        <span className="text-xs font-medium text-[var(--accent)]">
                          {stage.label}
                        </span>
                        <span className="text-[10px] text-black bg-[var(--accent)] px-1.5 py-0.5 rounded ml-auto">
                          CURRENT
                        </span>
                      </div>
                      <p className="text-xs text-[var(--accent-88)] leading-relaxed mb-3">
                        {stage.description}
                      </p>
                      <div className="bg-black/40 rounded p-2.5">
                        <div className="text-[10px] text-[var(--accent-88)] uppercase tracking-wider mb-0.5">
                          Next move
                        </div>
                        <p className="text-xs text-[var(--accent)] leading-relaxed">
                          {stage.nextAction}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Stage readiness indicator */}
                  {nextStage && (
                    <div className="border border-[var(--accent-26)] rounded p-3">
                      <div className="text-[10px] text-[var(--accent-88)] uppercase tracking-wider mb-2">
                        Ready to advance?
                      </div>
                      <button
                        onClick={() => onUpdate({ currentStage: nextStage.id })}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-xs bg-[var(--accent)] text-black font-medium hover:opacity-80 transition-opacity"
                      >
                        Advance to {nextStage.label}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                      <p className="text-[10px] text-[var(--accent-44)] mt-2 text-center">
                        Or type /advance in chat
                      </p>
                    </div>
                  )}

                  {/* Recommended tools */}
                  {stage && (
                    <div className="border border-[var(--accent-26)] rounded p-3">
                      <div className="text-[10px] text-[var(--accent-88)] uppercase tracking-wider mb-2">
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
                                : "border-[var(--accent-26)] text-[var(--accent-88)] hover:border-[var(--accent-44)]"
                            }`}
                          >
                            {tool}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Resources */}
                  {stage && stage.links.length > 0 && (
                    <div className="border border-[var(--accent-26)] rounded p-3">
                      <div className="text-[10px] text-[var(--accent-88)] uppercase tracking-wider mb-2">
                        Resources
                      </div>
                      <div className="space-y-1.5">
                        {stage.links.map((link) => (
                          <a
                            key={link.url}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-[10px] text-[var(--accent-88)] hover:text-[var(--accent)] transition-colors"
                          >
                            <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            {link.label}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contextual integrations */}
                  <IntegrationsPanel
                    integrations={integrations}
                    onToggle={onToggleIntegration}
                    stageId={project.currentStage}
                    projectId={project.id}
                  />

                  {/* Journey map toggle */}
                  <button
                    onClick={() => setShowMap(!showMap)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-[10px] border border-[var(--accent-26)] text-[var(--accent-88)] hover:border-[var(--accent-44)] hover:text-[var(--accent)] transition-colors"
                  >
                    {showMap ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                    {showMap ? "Hide" : "Show"} full journey map
                  </button>

                  {showMap && (
                    <JourneyMap
                      activeStage={project.currentStage}
                      onStageClick={(id: StageId) =>
                        onUpdate({ currentStage: id })
                      }
                      compact
                    />
                  )}
                </div>
              )}

              {sidebarTab === "brief" && (
                <ProjectBrief memories={memories} onRemoveMemory={onRemoveMemory} />
              )}

              {sidebarTab === "settings" && (
                <div className="space-y-4">
                  {/* Notes */}
                  <div className="border border-[var(--accent-26)] rounded p-3">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] text-[var(--accent-88)] uppercase tracking-wider">
                        Notes
                      </label>
                      <Save className="w-3 h-3 text-[var(--accent-44)]" />
                    </div>
                    <textarea
                      value={project.notes}
                      onChange={(e) => onUpdate({ notes: e.target.value })}
                      placeholder="Jot down thoughts, decisions..."
                      rows={5}
                      className="w-full bg-black border border-[var(--accent-26)] rounded px-3 py-2 text-xs text-[var(--accent-cc)] focus:border-[var(--accent)] outline-none resize-none"
                    />
                  </div>

                  {/* Debt indicators */}
                  <div className="border border-[var(--accent-26)] rounded p-3 space-y-3">
                    <div className="text-[10px] text-[var(--accent-88)] uppercase tracking-wider">
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
                    <p className="text-[10px] text-[var(--accent-44)] leading-relaxed">
                      Technical = code you&apos;ll fix later.
                      Cognitive = complexity you can&apos;t hold in your head.
                    </p>
                  </div>

                  {/* Keyboard shortcuts */}
                  <div className="border border-[var(--accent-26)] rounded p-3">
                    <div className="text-[10px] text-[var(--accent-88)] uppercase tracking-wider mb-2">
                      Keyboard shortcuts
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { key: "Ctrl+B", desc: "Toggle sidebar" },
                        { key: "Ctrl+/", desc: "Focus chat" },
                        { key: "/advance", desc: "Advance stage" },
                      ].map((shortcut) => (
                        <div
                          key={shortcut.key}
                          className="flex items-center justify-between"
                        >
                          <span className="text-[10px] text-[var(--accent-66)]">
                            {shortcut.desc}
                          </span>
                          <kbd className="text-[10px] text-[var(--accent)] bg-[var(--accent-10)] border border-[var(--accent-26)] rounded px-1.5 py-0.5">
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
    </div>
  );
}
