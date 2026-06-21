"use client";

import { Project } from "@/lib/types";
import { getStage, getStageIndex, STAGES } from "@/lib/stages";
import { FolderOpen, Plus, Trash2 } from "lucide-react";
import StageIcon from "./stage-icon";

interface ProjectListProps {
  projects: Project[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}

function MiniProgress({ stageId }: { stageId: string }) {
  const idx = getStageIndex(stageId);
  return (
    <div className="flex gap-0.5 items-center">
      {STAGES.map((_, i) => (
        <div
          key={i}
          className={`h-1 rounded-full transition-all ${
            i <= idx
              ? "w-3 bg-[var(--accent)]"
              : "w-1.5 bg-[var(--accent-26)]"
          }`}
        />
      ))}
    </div>
  );
}

export default function ProjectList({
  projects,
  selectedId,
  onSelect,
  onDelete,
  onCreate,
}: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="border border-dashed border-[var(--accent-26)] rounded p-8 text-center">
          <FolderOpen className="w-8 h-8 text-[var(--accent-44)] mx-auto mb-3" />
          <p className="text-sm text-[var(--accent-66)] mb-4">
            No projects yet. Create one to get started.
          </p>
          <button
            onClick={onCreate}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded text-sm bg-[var(--accent)] text-black font-medium hover:opacity-80 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Create your first project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-[var(--accent)]">
          <span className="text-[var(--accent-44)]">$ </span>
          projects/
        </h2>
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs border border-[var(--accent-26)] text-[var(--accent-88)] hover:border-[var(--accent-44)] hover:text-[var(--accent)] transition-colors"
        >
          <Plus className="w-3 h-3" />
          New
        </button>
      </div>

      <div className="space-y-2">
        {projects.map((project) => {
          const stage = getStage(project.currentStage);
          const isSelected = project.id === selectedId;

          return (
            <div
              key={project.id}
              className={`
                flex items-center gap-3 p-3 rounded border cursor-pointer transition-all
                ${
                  isSelected
                    ? "border-[var(--accent)] bg-[var(--accent-10)]"
                    : "border-[var(--accent-26)] hover:border-[var(--accent-44)]"
                }
              `}
              onClick={() => onSelect(project.id)}
            >
              <div className="flex-shrink-0 w-8 h-8 rounded bg-[var(--accent-10)] flex items-center justify-center">
                {stage ? (
                  <StageIcon name={stage.lucideIcon} className="w-3.5 h-3.5 text-[var(--accent-66)]" />
                ) : (
                  <FolderOpen className="w-3.5 h-3.5 text-[var(--accent-44)]" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--accent)] font-medium truncate">
                  {project.name}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-[var(--accent-66)]">
                    {stage?.label || project.currentStage}
                  </span>
                  <MiniProgress stageId={project.currentStage} />
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(project.id);
                }}
                className="flex-shrink-0 p-1.5 rounded text-[var(--accent-44)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                title="Delete project"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
