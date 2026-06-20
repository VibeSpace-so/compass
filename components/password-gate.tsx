"use client";

import { useState } from "react";
import { Lock, Trash2 } from "lucide-react";
import { verifyProjectPassword, wipeProjectData } from "@/lib/crypto";

interface ProjectUnlockProps {
  projectId: string;
  projectName: string;
  onUnlock: (password: string) => void;
  onBack: () => void;
  onWipe: () => void;
}

export default function ProjectUnlock({
  projectId,
  projectName,
  onUnlock,
  onBack,
  onWipe,
}: ProjectUnlockProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setLoading(true);
    setError("");

    const valid = await verifyProjectPassword(projectId, password);
    if (valid) {
      onUnlock(password);
    } else {
      setError("Incorrect password.");
    }
    setLoading(false);
  }

  function handleWipe() {
    wipeProjectData(projectId);
    onWipe();
  }

  if (showWipeConfirm) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center space-y-6">
          <Trash2 className="w-10 h-10 mx-auto text-red-400" />
          <h2 className="text-base font-medium text-red-400">
            Wipe project data?
          </h2>
          <p className="text-xs text-[var(--accent-88)] leading-relaxed">
            This will permanently delete all API keys, integration tokens, and
            chat history for &ldquo;{projectName}&rdquo;. The project itself will remain
            but without encrypted data. This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowWipeConfirm(false)}
              className="flex-1 px-4 py-2.5 rounded text-sm border border-[var(--accent-26)] text-[var(--accent-66)] hover:border-[var(--accent-44)] hover:text-[var(--accent)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleWipe}
              className="flex-1 px-4 py-2.5 rounded text-sm bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 transition-colors"
            >
              Wipe project data
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <Lock className="w-8 h-8 mx-auto text-[var(--accent)]" />
          <h1 className="text-lg font-medium text-[var(--accent)]">
            Unlock &ldquo;{projectName}&rdquo;
          </h1>
          <p className="text-xs text-[var(--accent-88)]">
            Enter your project password to decrypt your data.
          </p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-black border border-[var(--accent-26)] rounded px-3 py-2.5 text-sm text-[var(--accent)] placeholder:text-[var(--accent-44)] focus:border-[var(--accent)]"
            autoFocus
          />

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full px-4 py-2.5 rounded text-sm bg-[var(--accent)] text-black font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {loading ? "Verifying..." : "Unlock"}
          </button>
        </form>

        <div className="flex flex-col items-center gap-2 pt-2">
          <button
            onClick={onBack}
            className="text-xs text-[var(--accent-66)] hover:text-[var(--accent)] transition-colors"
          >
            ← Back to projects
          </button>
          <button
            onClick={() => setShowWipeConfirm(true)}
            className="text-xs text-red-400/60 hover:text-red-400 transition-colors underline"
          >
            Forgot password? Wipe project data
          </button>
        </div>

        <p className="text-center text-[10px] text-[var(--accent-44)] px-4 leading-relaxed">
          Your password never leaves this device.
        </p>
      </div>
    </div>
  );
}
