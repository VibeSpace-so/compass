"use client";

import { useState, useEffect } from "react";
import { X, Lock } from "lucide-react";

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string, password: string) => void;
}

export default function CreateProjectModal({
  open,
  onClose,
  onCreate,
}: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setPassword("");
      setConfirmPassword("");
      setError("");
    }
  }, [open]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    onCreate(name.trim(), description.trim(), password);
    setName("");
    setDescription("");
    setPassword("");
    setConfirmPassword("");
    setError("");
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

          <div className="border-t border-[var(--accent-26)] pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Lock className="w-3.5 h-3.5 text-[var(--accent-66)]" />
              <span className="text-xs text-[var(--accent-88)]">
                Encryption password
              </span>
            </div>
            <p className="text-[10px] text-[var(--accent-44)] mb-3 leading-relaxed">
              Your API keys, tokens, and chat history will be encrypted with this
              password. It never leaves your device.
            </p>
            <div className="space-y-2">
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="Create password (min 4 chars)"
                className="w-full bg-black border border-[var(--accent-26)] rounded px-3 py-2.5 text-sm text-[var(--accent)] placeholder:text-[var(--accent-44)] focus:border-[var(--accent)]"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                placeholder="Confirm password"
                className="w-full bg-black border border-[var(--accent-26)] rounded px-3 py-2.5 text-sm text-[var(--accent)] placeholder:text-[var(--accent-44)] focus:border-[var(--accent)]"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

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
              disabled={!name.trim() || !password}
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
