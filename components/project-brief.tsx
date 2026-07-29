"use client";

import * as React from "react";
import { ProjectDoc, ProjectDocSectionId, ProjectMemory, MemoryType } from "@/lib/types";
import { docToMarkdown } from "@/lib/project-doc";
import {
  Brain,
  Target,
  Lock,
  Lightbulb,
  BookOpen,
  FileText,
  Trash2,
  Pencil,
  Download,
  Copy,
  Check,
  Pin,
} from "lucide-react";

interface ProjectBriefProps {
  memories: ProjectMemory[];
  onRemoveMemory?: (memoryId: string) => void;
  onUpdateMemory?: (memoryId: string, content: string) => void;
  projectName?: string;
  doc?: ProjectDoc;
  onUpdateDocSection?: (sectionId: ProjectDocSectionId, content: string) => void;
  onPinMemory?: (memoryId: string, pinned: boolean) => void;
  onUpdateMemoryTags?: (memoryId: string, tags: string[]) => void;
}

const TYPE_CONFIG: Record<MemoryType, { label: string; icon: React.ReactNode; color: string }> = {
  preference: { label: "Preferences", icon: <Target className="w-3.5 h-3.5" />, color: "text-blue-400" },
  decision: { label: "Decisions", icon: <Lightbulb className="w-3.5 h-3.5" />, color: "text-yellow-400" },
  constraint: { label: "Constraints", icon: <Lock className="w-3.5 h-3.5" />, color: "text-red-400" },
  context: { label: "Context", icon: <BookOpen className="w-3.5 h-3.5" />, color: "text-green-400" },
  learning: { label: "Learnings", icon: <Brain className="w-3.5 h-3.5" />, color: "text-purple-400" },
  artifact: { label: "Artifacts", icon: <FileText className="w-3.5 h-3.5" />, color: "text-cyan-400" },
};

const TYPE_ORDER: MemoryType[] = ["context", "decision", "preference", "constraint", "learning", "artifact"];

function memoryMarkdown(memories: ProjectMemory[]): string {
  return memories.length
    ? `\n\n## Appendix — Memory Log\n\n${memories.map((memory) => `- [${TYPE_CONFIG[memory.type].label}] ${memory.content}`).join("\n")}\n`
    : "";
}

export function ProjectBrief({
  memories,
  onRemoveMemory,
  onUpdateMemory,
  projectName = "Project",
  doc,
  onUpdateDocSection,
  onPinMemory,
  onUpdateMemoryTags,
}: ProjectBriefProps) {
  const [view, setView] = React.useState<"document" | "memories">("document");
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<MemoryType | "all">("all");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editingContent, setEditingContent] = React.useState("");
  const [editingSection, setEditingSection] = React.useState<ProjectDocSectionId | null>(null);
  const [sectionContent, setSectionContent] = React.useState("");
  const [editingTags, setEditingTags] = React.useState<string | null>(null);
  const [tagValue, setTagValue] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  const exportContent = `${doc ? docToMarkdown(doc, projectName) : `# ${projectName} — Project Brief\n\nGenerated ${new Date().toLocaleDateString()}\n`}${memoryMarkdown(memories)}`;
  const exportMarkdown = () => {
    if (typeof window === "undefined") return;
    const blob = new Blob([exportContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${projectName.replace(/\s+/g, "-").toLowerCase()}-brief.md`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const copyMarkdown = async () => {
    if (typeof window === "undefined" || !navigator.clipboard) return;
    await navigator.clipboard.writeText(exportContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (memories.length === 0 && !doc) {
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

  const filteredMemories = memories
    .filter((memory) => typeFilter === "all" || memory.type === typeFilter)
    .filter((memory) => {
      const query = search.toLowerCase();
      return !query || memory.content.toLowerCase().includes(query) ||
        (memory.tags ?? []).some((tag) => tag.toLowerCase().includes(query));
    })
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
      (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt));

  return (
    <div className="flex flex-col gap-4 p-3 sm:p-4 overflow-y-auto h-full mobile-scroll">
      <div className="flex items-center gap-2 mb-1">
        <Brain className="w-4 h-4 text-green-400" />
        <h3 className="text-zinc-200 font-medium text-sm">Project Brief</h3>
        <div className="ml-auto flex gap-2">
          <button onClick={copyMarkdown} className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-green-400" title="Copy">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} Copy
          </button>
          <button onClick={exportMarkdown} className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-green-400" title="Export">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </div>

      <div className="flex rounded border border-[var(--accent-26)] p-0.5">
        <button onClick={() => setView("document")} className={`flex-1 rounded px-2 py-1.5 text-xs ${view === "document" ? "bg-[var(--accent-10)] text-[var(--accent)]" : "text-zinc-500"}`}>Document</button>
        <button onClick={() => setView("memories")} className={`flex-1 rounded px-2 py-1.5 text-xs ${view === "memories" ? "bg-[var(--accent-10)] text-[var(--accent)]" : "text-zinc-500"}`}>Memories ({memories.length})</button>
      </div>

      {view === "document" ? (
        <div className="space-y-3">
          {(doc?.sections ?? []).map((section) => (
            <div key={section.id} className="rounded border border-[var(--accent-26)] p-3">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-xs font-medium text-[var(--accent-cc)]">{section.title}</h4>
                <span className="ml-auto text-[10px] text-zinc-600">{new Date(section.updatedAt).toLocaleDateString()}</span>
                {onUpdateDocSection && editingSection !== section.id && (
                  <button onClick={() => { setEditingSection(section.id); setSectionContent(section.content); }} className="text-zinc-600 hover:text-green-400" title="Edit section"><Pencil className="w-3 h-3" /></button>
                )}
              </div>
              {editingSection === section.id ? (
                <div className="space-y-2">
                  <textarea value={sectionContent} onChange={(event) => setSectionContent(event.target.value)} rows={4} className="w-full rounded border border-[var(--accent-26)] bg-black px-2 py-1.5 text-sm text-zinc-300 outline-none" />
                  <div className="flex gap-2 text-[10px]">
                    <button onClick={() => { onUpdateDocSection?.(section.id, sectionContent); setEditingSection(null); }} className="text-green-400">Save</button>
                    <button onClick={() => setEditingSection(null)} className="text-zinc-500">Cancel</button>
                  </div>
                </div>
              ) : (
                <p className={`text-sm whitespace-pre-wrap ${section.content ? "text-zinc-300" : "text-zinc-600 italic"}`}>
                  {section.content || "Not filled yet"}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search memories..." className="w-full rounded border border-[var(--accent-26)] bg-black px-2.5 py-2 text-xs text-[var(--accent-cc)] outline-none focus:border-[var(--accent)]" />
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setTypeFilter("all")} className={`rounded border px-2 py-1 text-[10px] ${typeFilter === "all" ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--accent-26)] text-zinc-500"}`}>All</button>
            {TYPE_ORDER.map((type) => (
              <button key={type} onClick={() => setTypeFilter(type)} className={`rounded border px-2 py-1 text-[10px] ${typeFilter === type ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--accent-26)] text-zinc-500"}`}>{TYPE_CONFIG[type].label}</button>
            ))}
          </div>
          {TYPE_ORDER.map((type) => {
            const typeMemories = filteredMemories.filter((memory) => memory.type === type);
            if (typeMemories.length === 0) return null;
            const config = TYPE_CONFIG[type];
            return (
              <div key={type} className="space-y-1.5">
                <div className={`flex items-center gap-1.5 ${config.color}`}>{config.icon}<span className="text-xs font-medium uppercase tracking-wide">{config.label}</span></div>
                {typeMemories.map((memory) => (
                  <div key={memory.id} className="group flex items-start gap-2 pl-5 py-1">
                    {onPinMemory && <button onClick={() => onPinMemory(memory.id, !memory.pinned)} className={`${memory.pinned ? "text-yellow-400" : "text-zinc-700"} hover:text-yellow-400`} title={memory.pinned ? "Unpin memory" : "Pin memory"}><Pin className="w-3 h-3" /></button>}
                    {editingId === memory.id ? (
                      <div className="flex-1 space-y-1">
                        <textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} rows={3} className="w-full rounded border border-[var(--accent-26)] bg-black px-2 py-1 text-sm text-zinc-300 outline-none" />
                        <div className="flex gap-2 text-[10px]"><button onClick={() => { onUpdateMemory?.(memory.id, editingContent); setEditingId(null); }} className="text-green-400">Save</button><button onClick={() => setEditingId(null)} className="text-zinc-500">Cancel</button></div>
                      </div>
                    ) : <p className="text-zinc-300 text-sm flex-1 leading-relaxed">{memory.content}</p>}
                    <span className="text-[10px] text-zinc-600 whitespace-nowrap">{new Date(memory.updatedAt ?? memory.createdAt).toLocaleDateString()}</span>
                    {onUpdateMemory && editingId !== memory.id && <button onClick={() => { setEditingId(memory.id); setEditingContent(memory.content); }} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-green-400" title="Edit memory"><Pencil className="w-3 h-3" /></button>}
                    {onRemoveMemory && <button onClick={() => onRemoveMemory(memory.id)} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400" title="Remove memory"><Trash2 className="w-3 h-3" /></button>}
                    {onUpdateMemoryTags && editingTags === memory.id ? (
                      <input autoFocus value={tagValue} onChange={(event) => setTagValue(event.target.value)} onBlur={() => { onUpdateMemoryTags(memory.id, tagValue.split(",").map((tag) => tag.trim()).filter(Boolean)); setEditingTags(null); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="w-24 rounded border border-[var(--accent-26)] bg-black px-1 py-0.5 text-[10px] text-zinc-300" />
                    ) : (
                      <button onClick={() => { setEditingTags(memory.id); setTagValue((memory.tags ?? []).join(", ")); }} className="flex flex-wrap gap-1 text-left" title="Edit tags">
                        {(memory.tags ?? []).length > 0
                          ? (memory.tags ?? []).map((tag) => <span key={tag} className="rounded bg-[var(--accent-10)] px-1 text-[9px] text-[var(--accent-66)]">{tag}</span>)
                          : <span className="text-[9px] text-zinc-600">Add tags</span>}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
          {search && filteredMemories.length === 0 && <p className="text-center text-xs text-zinc-500 py-4">No memories match your search.</p>}
        </>
      )}
    </div>
  );
}
