"use client";

import { STAGES } from "@/lib/stages";
import { DebtLevel, StageId } from "@/lib/types";
import StageIcon from "./stage-icon";

interface JourneyMapProps {
  activeStage?: StageId;
  onStageClick?: (id: StageId) => void;
  compact?: boolean;
}

function DebtBadge({ level, label }: { level: DebtLevel; label: string }) {
  const colors: Record<DebtLevel, string> = {
    low: "border-[var(--accent-26)] text-[var(--accent-88)] bg-[var(--accent-10)]",
    medium: "border-yellow-600/40 text-yellow-500 bg-yellow-500/10",
    high: "border-red-500/40 text-red-400 bg-red-500/10",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] border ${colors[level]} ${level === "high" ? "debt-badge-high" : ""}`}
    >
      {label}: {level}
    </span>
  );
}

export default function JourneyMap({
  activeStage,
  onStageClick,
  compact,
}: JourneyMapProps) {
  return (
    <section className={compact ? "py-6" : "py-12 md:py-16"}>
      <div className="max-w-4xl mx-auto px-4">
        {!compact && (
          <div className="text-center mb-10">
            <h2 className="text-lg md:text-xl font-medium text-[var(--accent)] mb-2">
              The Vibe Coding Journey
            </h2>
            <p className="text-xs text-[var(--accent-66)] leading-relaxed">
              Each stage has tradeoffs. Compass helps you see them.
            </p>
          </div>
        )}

        <div className="relative">
          <div className="hidden md:block stage-connector" />

          <div className="space-y-3 md:space-y-4">
            {STAGES.map((stage, idx) => {
              const isActive = activeStage === stage.id;
              const isPast =
                activeStage &&
                STAGES.findIndex((s) => s.id === activeStage) > idx;

              return (
                <button
                  key={stage.id}
                  onClick={() => onStageClick?.(stage.id)}
                  disabled={!onStageClick}
                  className={`
                    w-full text-left relative
                    border rounded p-4 md:p-5
                    transition-all duration-200
                    ${
                      isActive
                        ? "border-[var(--accent)] bg-[var(--accent-10)] shadow-[0_0_20px_var(--accent-26)]"
                        : isPast
                          ? "border-[var(--accent-44)] bg-[var(--accent-10)]"
                          : "border-[var(--accent-26)] hover:border-[var(--accent-44)]"
                    }
                    ${onStageClick ? "cursor-pointer" : "cursor-default"}
                  `}
                >
                  <div className="flex items-start gap-3 md:gap-4">
                    <div
                      className={`
                        flex-shrink-0 w-10 h-10 rounded flex items-center justify-center
                        ${
                          isActive
                            ? "bg-[var(--accent)] text-black"
                            : isPast
                              ? "bg-[var(--accent-26)] text-[var(--accent)]"
                              : "bg-[var(--accent-10)] text-[var(--accent-66)]"
                        }
                      `}
                    >
                      <StageIcon
                        name={stage.lucideIcon}
                        completed={!!isPast}
                        className="w-4 h-4"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-[var(--accent-44)] tabular-nums">
                          {String(idx + 1).padStart(2, "0")}
                        </span>
                        <h3
                          className={`text-sm font-medium ${isActive ? "text-[var(--accent)]" : "text-[var(--accent-cc)]"}`}
                        >
                          {stage.label}
                        </h3>
                        {isActive && (
                          <span className="text-[10px] text-black bg-[var(--accent)] px-2 py-0.5 rounded">
                            YOU ARE HERE
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-[var(--accent-88)] mb-2 leading-relaxed">
                        {stage.description}
                      </p>

                      {!compact && (
                        <div className="flex flex-wrap gap-2">
                          <DebtBadge level={stage.risk} label="risk" />
                          <DebtBadge
                            level={stage.complexity}
                            label="complexity"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
