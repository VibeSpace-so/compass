"use client";

import { ProjectMemory, MemoryType } from "@/lib/types";
import { Brain, Target, Lock, Lightbulb, BookOpen, FileText, Trash2 } from "lucide-react";

interface ProjectBriefProps {
  memories: ProjectMemory[];
  onRemoveMemory?: (memoryId: string) => void;
}

const TYPE_CONFIG: Record<MemoryType, { label: string; icon: React.ReactNode; color: string }> = {
  preference: { label: "Preferences", icon: <Target className="w-3.5 h-3.5" />, color: "text-blue-400" },
  decision: { label: "Decisions", icon: <Lightbulb className="w-3.5 h-3.5" />, color: "text-yellow-400" },
  constraint: { label: "Constraints", icon: <Lock className="w-3.5 h-3.5" />, color: "text-red-400" },
  context: { label: "Context", icon: <BookOpen className="w-3.5 h-3.5" />, color: "text-green-400" },
  learning: { label: "Learnings", icon: <Brain className="w-3.5 h-3.5" />, color: "text-purple-400" },
  artifact: { label: "Artifacts", icon: <FileText className="w-3.5 h-3.5" />, color: "text-cyan-400" },
};

export function ProjectBrief({ memories, onRemoveMemory }: ProjectBriefProps) {
  if (memories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
        <Brain className="w-12 h-12 text-zinc-600 mb-4" />
        <h3 className="text-zinc-300 font-medium mb-2">No memories yet</h3>
        <p className="text-zinc-500 text-sm max-w-sm">
          As you chat with Compass, it will save important information about your project here —
          decisions, preferences, constraints, and learnings that build over time.
        </p>
      </div>
    );
  }

  const grouped: Record<string, ProjectMemory[]> = {};
  for (const m of memories) {
    if (!grouped[m.type]) grouped[m.type] = [];
    grouped[m.type].push(m);
  }

  // Order: context, decision, preference, constraint, learning, artifact
  const typeOrder: MemoryType[] = ["context", "decision", "preference", "constraint", "learning", "artifact"];

  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="w-4 h-4 text-green-400" />
        <h3 className="text-zinc-200 font-medium text-sm">Core Memories</h3>
        <span className="text-zinc-500 text-xs">({memories.length})</span>
      </div>

      {typeOrder.map((type) => {
        const mems = grouped[type];
        if (!mems || mems.length === 0) return null;
        const config = TYPE_CONFIG[type];

        return (
          <div key={type} className="space-y-1.5">
            <div className={`flex items-center gap-1.5 ${config.color}`}>
              {config.icon}
              <span className="text-xs font-medium uppercase tracking-wide">
                {config.label}
              </span>
            </div>
            {mems.map((m) => (
              <div
                key={m.id}
                className="group flex items-start gap-2 pl-5 py-1"
              >
                <p className="text-zinc-300 text-sm flex-1 leading-relaxed">
                  {m.content}
                </p>
                {onRemoveMemory && (
                  <button
                    onClick={() => onRemoveMemory(m.id)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-opacity"
                    title="Remove memory"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
