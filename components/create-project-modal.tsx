"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
}

export default function CreateProjectModal({
  open,
  onClose,
  onCreate,
}: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim(), description.trim());
    setName("");
    setDescription("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 border border-[var(--accent-44)] rounded bg-[#0a0a0a] p-6 shadow-[0_0_40px_var(--accent-15)]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-medium text-[var(--accent)]">
            <span className="text-[var(--accent-44)]">$ </span>
            new_project
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-[var(--accent-44)] hover:text-[var(--accent)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--accent-88)] mb-1.5">
              Project name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My vibe coded app"
              className="w-full bg-black border border-[var(--accent-26)] rounded px-3 py-2.5 text-sm text-[var(--accent)] placeholder:text-[var(--accent-44)] focus:border-[var(--accent)]"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-[var(--accent-88)] mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of what you're building..."
              rows={3}
              className="w-full bg-black border border-[var(--accent-26)] rounded px-3 py-2.5 text-sm text-[var(--accent)] placeholder:text-[var(--accent-44)] focus:border-[var(--accent)] resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded text-sm border border-[var(--accent-26)] text-[var(--accent-66)] hover:border-[var(--accent-44)] hover:text-[var(--accent)] transition-colors"
            >
              cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 px-4 py-2.5 rounded text-sm bg-[var(--accent)] text-black font-medium hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              create project →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
