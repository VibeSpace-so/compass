"use client";

import * as React from "react";
import { ProjectMemory, MemoryType } from "@/lib/types";
import { Brain, Target, Lock, Lightbulb, BookOpen, FileText, Trash2, Pencil, Download, Copy, Check } from "lucide-react";

interface ProjectBriefProps {
  memories: ProjectMemory[];
  onRemoveMemory?: (memoryId: string) => void;
  onUpdateMemory?: (memoryId: string, content: string) => void;
  projectName?: string;
}

const TYPE_CONFIG: Record<MemoryType, { label: string; icon: React.ReactNode; color: string }> = {
  preference: { label: "Preferences", icon: <Target className="w-3.5 h-3.5" />, color: "text-blue-400" },
  decision: { label: "Decisions", icon: <Lightbulb className="w-3.5 h-3.5" />, color: "text-yellow-400" },
  constraint: { label: "Constraints", icon: <Lock className="w-3.5 h-3.5" />, color: "text-red-400" },
  context: { label: "Context", icon: <BookOpen className="w-3.5 h-3.5" />, color: "text-green-400" },
  learning: { label: "Learnings", icon: <Brain className="w-3.5 h-3.5" />, color: "text-purple-400" },
  artifact: { label: "Artifacts", icon: <FileText className="w-3.5 h-3.5" />, color: "text-cyan-400" },
};

export function ProjectBrief({ memories, onRemoveMemory, onUpdateMemory, projectName = "Project" }: ProjectBriefProps) {
  const [search, setSearch] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingContent, setEditingContent] = React.useState("");
  const [copied, setCopied] = React.useState(false);
  const filteredMemories = memories.filter((m) => m.content.toLowerCase().includes(search.toLowerCase()));
  const markdown = `# ${projectName} — Project Brief\n\nGenerated ${new Date().toLocaleDateString()}\n\n${(["context", "decision", "preference", "constraint", "learning", "artifact"] as MemoryType[]).map((type) => {
    const items = memories.filter((m) => m.type === type);
    return items.length ? `## ${TYPE_CONFIG[type].label}\n\n${items.map((m) => `- ${m.content}`).join("\n")}` : "";
  }).filter(Boolean).join("\n\n")}\n`;
  const exportMarkdown = () => {
    if (typeof window === "undefined") return;
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${projectName.replace(/\s+/g, "-").toLowerCase()}-brief.md`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const copyMarkdown = async () => {
    if (typeof window === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
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
    <div className="flex flex-col gap-4 p-3 sm:p-4 overflow-y-auto h-full mobile-scroll">
      <div className="flex items-center gap-2 mb-2">
        <Brain className="w-4 h-4 text-green-400" />
        <h3 className="text-zinc-200 font-medium text-sm">Core Memories</h3>
        <span className="text-zinc-500 text-xs">({memories.length})</span>
        <div className="ml-auto flex gap-1">
          <button onClick={copyMarkdown} className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-green-400" title="Copy">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>Copy</span>
          </button>
          <button onClick={exportMarkdown} className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-green-400" title="Export">
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search memories..." className="w-full rounded border border-[var(--accent-26)] bg-black px-2.5 py-2 text-xs text-[var(--accent-cc)] outline-none focus:border-[var(--accent)]" />

      {typeOrder.map((type) => {
        const mems = filteredMemories.filter((m) => m.type === type);
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
                {editingId === m.id ? (
                  <div className="flex-1 space-y-1">
                    <textarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} rows={3} className="w-full rounded border border-[var(--accent-26)] bg-black px-2 py-1 text-sm text-zinc-300 outline-none" />
                    <div className="flex gap-2 text-[10px]">
                      <button onClick={() => { onUpdateMemory?.(m.id, editingContent); setEditingId(null); }} className="text-green-400">Save</button>
                      <button onClick={() => setEditingId(null)} className="text-zinc-500">Cancel</button>
                    </div>
                  </div>
                ) : <p className="text-zinc-300 text-sm flex-1 leading-relaxed">{m.content}</p>}
                {onUpdateMemory && editingId !== m.id && (
                  <button onClick={() => { setEditingId(m.id); setEditingContent(m.content); }} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-green-400 transition-opacity" title="Edit memory"><Pencil className="w-3 h-3" /></button>
                )}
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
      {search && filteredMemories.length === 0 && <p className="text-center text-xs text-zinc-500 py-4">No memories match your search.</p>}
    </div>
  );
}
