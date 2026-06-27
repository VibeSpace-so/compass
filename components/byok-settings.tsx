"use client";

import { useState } from "react";
import {
  X,
  Shield,
  Eye,
  EyeOff,
  KeyRound,
  AlertTriangle,
  Lock,
  LockOpen,
} from "lucide-react";
import { BYOKProvider } from "@/lib/types";
import { saveBYOKKey, removeBYOKKey, getBYOKKey } from "@/lib/storage";

interface BYOKSettingsProps {
  open: boolean;
  onClose: () => void;
  providers: BYOKProvider[];
  onToggleProvider: (id: string) => void;
  onProvidersChange: () => void;
  projectId: string | null;
  isEncrypted: boolean;
  onEncrypt: (password: string) => Promise<void>;
  onDisableEncryption: () => Promise<void>;
}

function EncryptionSection({
  isEncrypted,
  hasKeys,
  onEncrypt,
  onDisableEncryption,
}: {
  isEncrypted: boolean;
  hasKeys: boolean;
  onEncrypt: (password: string) => Promise<void>;
  onDisableEncryption: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setShowForm(false);
    setPassword("");
    setConfirm("");
    setError("");
  }

  async function handleEnable() {
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await onEncrypt(password);
      reset();
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    try {
      await onDisableEncryption();
    } finally {
      setBusy(false);
    }
  }

  if (isEncrypted) {
    return (
      <div className="flex items-start gap-2 mb-4 p-3 rounded border border-[var(--accent-44)] bg-[var(--accent-10)]">
        <Lock className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-[11px] text-[var(--accent)] font-medium">
            Encryption is on
          </div>
          <div className="text-[10px] text-[var(--accent-88)] leading-relaxed mt-0.5">
            Keys, tokens, chat, and memories are encrypted with your password.
          </div>
          <button
            onClick={handleDisable}
            disabled={busy}
            className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[var(--accent-44)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
          >
            <LockOpen className="w-3 h-3" />
            {busy ? "working…" : "Disable encryption"}
          </button>
        </div>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="mb-4 p-3 rounded border border-[var(--accent-44)] bg-[var(--accent-10)] space-y-2">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="text-[11px] text-[var(--accent)] font-medium">
            Encrypt this project
          </span>
        </div>
        <p className="text-[10px] text-[var(--accent-66)] leading-relaxed">
          Set a password to encrypt your keys, tokens, chat, and memories. You&apos;ll
          need it to unlock the project after a refresh. It never leaves this device.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          placeholder="Create password (min 4 chars)"
          className="w-full bg-black border border-[var(--accent-26)] rounded px-3 py-2 text-xs text-[var(--accent)] placeholder:text-[var(--accent-44)] focus:border-[var(--accent)] outline-none"
          autoFocus
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setError(""); }}
          placeholder="Confirm password"
          className="w-full bg-black border border-[var(--accent-26)] rounded px-3 py-2 text-xs text-[var(--accent)] placeholder:text-[var(--accent-44)] focus:border-[var(--accent)] outline-none"
        />
        {error && <p className="text-[10px] text-red-400">{error}</p>}
        <div className="flex gap-2 pt-0.5">
          <button
            onClick={reset}
            disabled={busy}
            className="flex-1 px-3 py-1.5 rounded text-[10px] border border-[var(--accent-26)] text-[var(--accent-66)] hover:border-[var(--accent-44)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
          >
            cancel
          </button>
          <button
            onClick={handleEnable}
            disabled={busy || !password || !confirm}
            className="flex-1 px-3 py-1.5 rounded text-[10px] bg-[var(--accent)] text-black font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
          >
            {busy ? "encrypting…" : "Enable encryption"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex items-start gap-2 mb-4 p-3 rounded border ${
        hasKeys
          ? "border-yellow-600/40 bg-yellow-500/5"
          : "border-[var(--accent-26)] bg-[var(--accent-10)]"
      }`}
    >
      {hasKeys ? (
        <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
      ) : (
        <LockOpen className="w-4 h-4 text-[var(--accent-66)] flex-shrink-0 mt-0.5" />
      )}
      <div className="flex-1">
        <div
          className={`text-[11px] font-medium ${
            hasKeys ? "text-yellow-500" : "text-[var(--accent-88)]"
          }`}
        >
          {hasKeys ? "Reminder: encrypt your project" : "Encryption is off"}
        </div>
        <div className="text-[10px] text-[var(--accent-88)] leading-relaxed mt-0.5">
          {hasKeys
            ? "You've saved API keys. Encrypt this project with a password to protect them."
            : "This project is unencrypted. Add a password anytime to encrypt your data."}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[var(--accent)] hover:underline"
        >
          <Lock className="w-3 h-3" />
          Encrypt project
        </button>
      </div>
    </div>
  );
}

function ProviderRow({
  provider,
  onToggle,
  onKeysChange,
  projectId,
}: {
  provider: BYOKProvider;
  onToggle: () => void;
  onKeysChange: () => void;
  projectId: string;
}) {
  const [showKey, setShowKey] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [keyValue, setKeyValue] = useState("");

  function handleSaveKey() {
    if (keyValue.trim()) {
      saveBYOKKey(projectId, provider.id, keyValue.trim());
    } else {
      removeBYOKKey(projectId, provider.id);
    }
    setEditingKey(false);
    setKeyValue("");
    onKeysChange();
  }

  function handleRemoveKey() {
    removeBYOKKey(projectId, provider.id);
    setKeyValue("");
    setEditingKey(false);
    onKeysChange();
  }

  const currentKey = getBYOKKey(projectId, provider.id);

  return (
    <div className="border border-[var(--accent-26)] rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <KeyRound className="w-3.5 h-3.5 text-[var(--accent-66)]" />
          <span className="text-xs font-medium text-[var(--accent)]">
            {provider.name}
          </span>
        </div>

        <button
          onClick={onToggle}
          className={`
            relative w-8 h-4 rounded-full transition-colors
            ${provider.enabled ? "bg-[var(--accent)]" : "bg-[var(--accent-26)]"}
          `}
        >
          <div
            className={`
              absolute top-0.5 w-3 h-3 rounded-full transition-all
              ${
                provider.enabled
                  ? "left-[calc(100%-14px)] bg-black"
                  : "left-0.5 bg-[var(--accent-44)]"
              }
            `}
          />
        </button>
      </div>

      {provider.enabled && (
        <div>
          {editingKey ? (
            <div className="space-y-2">
              <div className="relative">
                <input
                  type={showKey ? "text" : "password"}
                  value={keyValue}
                  onChange={(e) => setKeyValue(e.target.value)}
                  placeholder="Paste your API key..."
                  className="w-full bg-black border border-[var(--accent-26)] rounded px-3 py-2 pr-8 text-xs text-[var(--accent)] focus:border-[var(--accent)] outline-none"
                  autoFocus
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--accent-44)] hover:text-[var(--accent)]"
                >
                  {showKey ? (
                    <EyeOff className="w-3 h-3" />
                  ) : (
                    <Eye className="w-3 h-3" />
                  )}
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingKey(false);
                    setKeyValue("");
                  }}
                  className="text-[10px] text-[var(--accent-44)] hover:text-[var(--accent)]"
                >
                  cancel
                </button>
                <button
                  onClick={handleSaveKey}
                  className="text-[10px] text-[var(--accent)] hover:underline"
                >
                  save key
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {currentKey ? (
                <>
                  <span className="text-[10px] text-[var(--accent-88)]">
                    ••••••••{currentKey.slice(-4)}
                  </span>
                  <button
                    onClick={() => {
                      setKeyValue(currentKey);
                      setEditingKey(true);
                    }}
                    className="text-[10px] text-[var(--accent-44)] hover:text-[var(--accent)]"
                  >
                    edit
                  </button>
                  <button
                    onClick={handleRemoveKey}
                    className="text-[10px] text-red-400/60 hover:text-red-400"
                  >
                    remove
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setEditingKey(true)}
                  className="text-[10px] text-[var(--accent-44)] hover:text-[var(--accent)]"
                >
                  + add API key
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function BYOKSettings({
  open,
  onClose,
  providers,
  onToggleProvider,
  onProvidersChange,
  projectId,
  isEncrypted,
  onEncrypt,
  onDisableEncryption,
}: BYOKSettingsProps) {
  if (!open) return null;
  if (!projectId) return null;

  const hasKeys = providers.some((p) => p.keySet);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md mx-4 border border-[var(--accent-44)] rounded bg-[#0a0a0a] p-6 shadow-[0_0_40px_var(--accent-15)]">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-medium text-[var(--accent)]">
            <span className="text-[var(--accent-44)]">$ </span>
            api_keys
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-[var(--accent-44)] hover:text-[var(--accent)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security notice */}
        <div className="flex items-start gap-2 mb-4 p-3 rounded border border-[var(--accent-26)] bg-[var(--accent-10)]">
          <Shield className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-0.5" />
          <div className="text-[10px] text-[var(--accent-88)] leading-relaxed">
            Your API keys are stored in your browser&apos;s localStorage only.
            They never leave this device. Compass does not send keys to any
            server.
          </div>
        </div>

        {/* Encryption status / reminder */}
        <EncryptionSection
          isEncrypted={isEncrypted}
          hasKeys={hasKeys}
          onEncrypt={onEncrypt}
          onDisableEncryption={onDisableEncryption}
        />

        <div className="space-y-2">
          {providers.map((provider) => (
            <ProviderRow
              key={provider.id}
              provider={provider}
              onToggle={() => onToggleProvider(provider.id)}
              onKeysChange={onProvidersChange}
              projectId={projectId}
            />
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-[var(--accent-26)]">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded text-xs bg-[var(--accent)] text-black font-medium hover:opacity-80 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
