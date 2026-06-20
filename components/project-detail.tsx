"use client";

import { useState } from "react";
import { Project, StageId, DebtLevel } from "@/lib/types";
import { getStage, getNextStage, STAGES } from "@/lib/stages";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Save,
  ChevronDown,
} from "lucide-react";
import JourneyMap from "./journey-map";

interface ProjectDetailProps {
  project: Project;
  onUpdate: (updates: Partial<Project>) => void;
  onBack: () => void;
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

export default function ProjectDetail({
  project,
  onUpdate,
  onBack,
}: ProjectDetailProps) {
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [showMap, setShowMap] = useState(false);

  const stage = getStage(project.currentStage);
  const nextStage = getNextStage(project.currentStage);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
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
              className="bg-transparent border-b border-[var(--accent-44)] text-lg font-medium text-[var(--accent)] w-full focus:border-[var(--accent)] outline-none py-0.5"
            />
          ) : (
            <h1
              className="text-lg font-medium text-[var(--accent)] cursor-pointer hover:underline decoration-[var(--accent-44)] underline-offset-4"
              onClick={() => setEditingName(true)}
              title="Click to edit"
            >
              {project.name}
            </h1>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="mb-6">
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
            className="text-xs text-[var(--accent-66)] cursor-pointer hover:text-[var(--accent-cc)] transition-colors"
            onClick={() => setEditingDesc(true)}
            title="Click to edit"
          >
            {project.description || "Click to add a description..."}
          </p>
        )}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Left column — Current stage + guidance */}
        <div className="md:col-span-2 space-y-4">
          {/* Current stage card */}
          {stage && (
            <div className="border border-[var(--accent)] rounded p-5 bg-[var(--accent-10)] relative overflow-hidden">
              <div className="crt-overlay opacity-30" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{stage.icon}</span>
                  <span className="text-[10px] text-black bg-[var(--accent)] px-2 py-0.5 rounded font-medium">
                    CURRENT STAGE
                  </span>
                </div>
                <h3 className="text-base font-medium text-[var(--accent)] mb-2">
                  {stage.label}
                </h3>
                <p className="text-xs text-[var(--accent-cc)] leading-relaxed mb-4">
                  {stage.description}
                </p>

                {/* Next action */}
                <div className="bg-black/40 rounded p-3 mb-3">
                  <div className="text-[10px] text-[var(--accent-88)] uppercase tracking-wider mb-1">
                    → Next move
                  </div>
                  <p className="text-xs text-[var(--accent)] leading-relaxed">
                    {stage.nextAction}
                  </p>
                </div>

                {/* Tools */}
                <div className="mb-3">
                  <div className="text-[10px] text-[var(--accent-88)] uppercase tracking-wider mb-1.5">
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
                            : "border-[var(--accent-26)] text-[var(--accent-66)] hover:border-[var(--accent-44)]"
                        }`}
                      >
                        {tool}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Links */}
                <div>
                  <div className="text-[10px] text-[var(--accent-88)] uppercase tracking-wider mb-1.5">
                    Resources
                  </div>
                  <div className="space-y-1">
                    {stage.links.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[11px] text-[var(--accent-88)] hover:text-[var(--accent)] transition-colors"
                      >
                        <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>

                {/* Debt note */}
                <div className="mt-3 pt-3 border-t border-[var(--accent-26)]">
                  <p className="text-[10px] text-[var(--accent-66)] italic leading-relaxed">
                    {stage.debtNote}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Stage navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                const idx = STAGES.findIndex(
                  (s) => s.id === project.currentStage
                );
                if (idx > 0) {
                  onUpdate({ currentStage: STAGES[idx - 1].id });
                }
              }}
              disabled={project.currentStage === STAGES[0].id}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded text-xs border border-[var(--accent-26)] text-[var(--accent-66)] hover:border-[var(--accent-44)] hover:text-[var(--accent)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ArrowLeft className="w-3 h-3" />
              Previous stage
            </button>
            {nextStage && (
              <button
                onClick={() => onUpdate({ currentStage: nextStage.id })}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded text-xs bg-[var(--accent)] text-black font-medium hover:opacity-80 transition-opacity"
              >
                Advance to {nextStage.label}
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Journey map toggle */}
          <button
            onClick={() => setShowMap(!showMap)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded text-xs border border-[var(--accent-26)] text-[var(--accent-66)] hover:border-[var(--accent-44)] hover:text-[var(--accent)] transition-colors"
          >
            <ChevronDown
              className={`w-3 h-3 transition-transform ${showMap ? "rotate-180" : ""}`}
            />
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

        {/* Right column — Notes + Debt */}
        <div className="space-y-4">
          {/* Notes */}
          <div className="border border-[var(--accent-26)] rounded p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-[var(--accent-88)]">Notes</label>
              <Save className="w-3 h-3 text-[var(--accent-44)]" />
            </div>
            <textarea
              value={project.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder="Jot down thoughts, decisions, reminders..."
              rows={6}
              className="w-full bg-black border border-[var(--accent-26)] rounded px-3 py-2 text-xs text-[var(--accent-cc)] focus:border-[var(--accent)] outline-none resize-none"
            />
          </div>

          {/* Selected tool */}
          <div className="border border-[var(--accent-26)] rounded p-4">
            <label className="block text-xs text-[var(--accent-88)] mb-1.5">
              Selected tool
            </label>
            <div className="text-sm text-[var(--accent)]">
              {project.selectedTool || (
                <span className="text-[var(--accent-44)]">None selected</span>
              )}
            </div>
          </div>

          {/* Debt indicators */}
          <div className="border border-[var(--accent-26)] rounded p-4 space-y-3">
            <div className="text-xs text-[var(--accent-88)] font-medium">
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

            <p className="text-[10px] text-[var(--accent-44)] leading-relaxed pt-1">
              Technical debt = code you'll need to fix later.
              <br />
              Cognitive debt = complexity you can't hold in your head.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
