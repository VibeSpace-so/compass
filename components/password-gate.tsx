"use client";

import { useState } from "react";
import { Lock, ShieldCheck, Trash2 } from "lucide-react";
import {
  isEncryptionSetup,
  verifyPassword,
  setVerificationToken,
  wipeAllData,
} from "@/lib/crypto";

interface PasswordGateProps {
  onUnlock: (password: string) => void;
}

export default function PasswordGate({ onUnlock }: PasswordGateProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isCreating] = useState(() => !isEncryptionSetup());
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await setVerificationToken(password);
      onUnlock(password);
    } catch {
      setError("Failed to set up encryption.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUnlock() {
    if (!password) {
      setError("Enter your password.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const valid = await verifyPassword(password);
      if (valid) {
        onUnlock(password);
      } else {
        setError("Incorrect password.");
      }
    } catch {
      setError("Decryption failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleWipe() {
    wipeAllData();
    window.location.reload();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      if (isCreating) handleCreate();
      else handleUnlock();
    }
  }

  if (showWipeConfirm) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <Trash2 className="w-8 h-8 text-red-400 mx-auto" />
          <h2 className="text-lg font-mono text-red-400">Wipe all data?</h2>
          <p className="text-xs text-[var(--accent-44)] leading-relaxed">
            This will permanently delete all projects, API keys, integration
            tokens, and settings. This cannot be undone.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => setShowWipeConfirm(false)}
              className="px-4 py-2 text-xs font-mono border border-[var(--accent-44)] text-[var(--accent-44)] rounded hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleWipe}
              className="px-4 py-2 text-xs font-mono bg-red-500/20 border border-red-500 text-red-400 rounded hover:bg-red-500/30 transition-colors"
            >
              Wipe everything
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          {isCreating ? (
            <ShieldCheck className="w-8 h-8 text-[var(--accent)] mx-auto" />
          ) : (
            <Lock className="w-8 h-8 text-[var(--accent)] mx-auto" />
          )}
          <h1 className="text-lg font-mono text-[var(--accent)]">
            {isCreating ? "Set up encryption" : "Unlock Compass"}
          </h1>
          <p className="text-xs text-[var(--accent-44)] leading-relaxed">
            {isCreating
              ? "Create a password to encrypt your API keys and tokens. All sensitive data will be encrypted locally."
              : "Enter your password to decrypt your data."}
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="password"
            placeholder={isCreating ? "Create password" : "Password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-full px-3 py-2 bg-black/50 border border-[var(--accent-26)] rounded text-sm text-[var(--accent)] placeholder:text-[var(--accent-26)] focus:outline-none focus:border-[var(--accent-44)] font-mono"
          />

          {isCreating && (
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 bg-black/50 border border-[var(--accent-26)] rounded text-sm text-[var(--accent)] placeholder:text-[var(--accent-26)] focus:outline-none focus:border-[var(--accent-44)] font-mono"
            />
          )}

          {error && (
            <p className="text-xs text-red-400 font-mono">{error}</p>
          )}

          <button
            onClick={isCreating ? handleCreate : handleUnlock}
            disabled={loading}
            className="w-full py-2 text-sm font-mono bg-[var(--accent-10)] border border-[var(--accent)] text-[var(--accent)] rounded hover:bg-[var(--accent-26)] transition-colors disabled:opacity-50"
          >
            {loading
              ? "Processing..."
              : isCreating
              ? "Set up encryption"
              : "Unlock"}
          </button>
        </div>

        {!isCreating && (
          <div className="text-center pt-2">
            <button
              onClick={() => setShowWipeConfirm(true)}
              className="text-[10px] text-[var(--accent-44)] hover:text-red-400 transition-colors font-mono underline"
            >
              Forgot password? Wipe all data and start over
            </button>
          </div>
        )}

        <p className="text-[10px] text-[var(--accent-26)] text-center leading-relaxed">
          Your password never leaves this device. If you forget it, you can
          reset all data and start fresh.
        </p>
      </div>
    </div>
  );
}
