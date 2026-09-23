"use client";

import { useState, useRef } from "react";
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
import { verifyProjectPassword } from "@/lib/crypto";
import { saveBYOKKey, removeBYOKKey, getBYOKKey } from "@/lib/storage";

export interface CustomProviderConfig {
  name: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  params?: Record<string, unknown>;
}

interface BYOKSettingsProps {
  open: boolean;
  onClose: () => void;
  providers: BYOKProvider[];
  onToggleProvider: (id: string) => void;
  onProvidersChange: () => void;
  onAddCustomProvider: (config: CustomProviderConfig) => void;
  onRemoveProvider: (id: string) => void;
  projectId: string | null;
  isEncrypted: boolean;
  onEncrypt: (password: string) => Promise<void>;
  onDisableEncryption: () => Promise<void>;
}

function EncryptionSection({
  projectId,
  isEncrypted,
  hasKeys,
  onEncrypt,
  onDisableEncryption,
}: {
  projectId: string;
  isEncrypted: boolean;
  hasKeys: boolean;
  onEncrypt: (password: string) => Promise<void>;
  onDisableEncryption: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [password, setPassword] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function reset() {
    setShowForm(false);
    setPassword("");
    setConfirm("");
    setError("");
  }

  function resetDisableForm() {
    setShowDisableForm(false);
    setDisablePassword("");
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
      const valid = await verifyProjectPassword(projectId, disablePassword);
      if (!valid) {
        setError("Incorrect password.");
        return;
      }
      await onDisableEncryption();
      resetDisableForm();
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
          <div className="text-[10px] text-[var(--text-secondary)] leading-relaxed mt-0.5">
            Keys, tokens, chat, and memories are encrypted with your password.
          </div>
          {showDisableForm ? (
            <div className="mt-2 space-y-2">
              <input
                type="password"
                value={disablePassword}
                onChange={(e) => {
                  setDisablePassword(e.target.value);
                  setError("");
                }}
                placeholder="Enter project password"
                className="w-full bg-black border border-[var(--accent-26)] rounded px-3 py-2 text-xs text-[var(--accent)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] outline-none"
                autoFocus
              />
              {error && <p className="text-[10px] text-red-400">{error}</p>}
              <div className="flex gap-2 pt-0.5">
                <button
                  onClick={resetDisableForm}
                  disabled={busy}
                  className="flex-1 px-3 py-1.5 rounded text-[10px] border border-[var(--accent-26)] text-[var(--text-muted)] hover:border-[var(--accent-44)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
                >
                  cancel
                </button>
                <button
                  onClick={handleDisable}
                  disabled={busy || !disablePassword}
                  className="flex-1 px-3 py-1.5 rounded text-[10px] bg-[var(--accent)] text-black font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
                >
                  {busy ? "disabling…" : "Disable encryption"}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => {
                setShowDisableForm(true);
                setError("");
              }}
              disabled={busy}
              className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
            >
              <LockOpen className="w-3 h-3" />
              Disable encryption
            </button>
          )}
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
        <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
          Set a password to encrypt your keys, tokens, chat, and memories. You&apos;ll
          need it to unlock the project after a refresh. It never leaves this device.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          placeholder="Create password (min 4 chars)"
          className="w-full bg-black border border-[var(--accent-26)] rounded px-3 py-2 text-xs text-[var(--accent)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] outline-none"
          autoFocus
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value); setError(""); }}
          placeholder="Confirm password"
          className="w-full bg-black border border-[var(--accent-26)] rounded px-3 py-2 text-xs text-[var(--accent)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] outline-none"
        />
        {error && <p className="text-[10px] text-red-400">{error}</p>}
        <div className="flex gap-2 pt-0.5">
          <button
            onClick={reset}
            disabled={busy}
            className="flex-1 px-3 py-1.5 rounded text-[10px] border border-[var(--accent-26)] text-[var(--text-muted)] hover:border-[var(--accent-44)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
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
        <LockOpen className="w-4 h-4 text-[var(--text-muted)] flex-shrink-0 mt-0.5" />
      )}
      <div className="flex-1">
        <div
          className={`text-[11px] font-medium ${
            hasKeys ? "text-yellow-500" : "text-[var(--text-secondary)]"
          }`}
        >
          {hasKeys ? "Reminder: encrypt your project" : "Encryption is off"}
        </div>
        <div className="text-[10px] text-[var(--text-secondary)] leading-relaxed mt-0.5">
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
  onRemove,
  projectId,
}: {
  provider: BYOKProvider;
  onToggle: () => void;
  onKeysChange: () => void;
  onRemove?: () => void;
  projectId: string;
}) {
  const [showKey, setShowKey] = useState(false);
  const [editingKey, setEditingKey] = useState(false);
  const [keyValue, setKeyValue] = useState("");
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const removeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleRemoveClick() {
    if (!onRemove) return;
    if (confirmingRemove) {
      if (removeTimeoutRef.current) clearTimeout(removeTimeoutRef.current);
      onRemove();
      return;
    }
    setConfirmingRemove(true);
    removeTimeoutRef.current = setTimeout(
      () => setConfirmingRemove(false),
      2500
    );
  }

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
  const subtitle = provider.custom
    ? `${provider.baseUrl} → ${provider.model}`
    : provider.recommendedModels?.length
      ? `recommended: ${provider.recommendedModels.join(" · ")}`
      : null;

  return (
    <div className="border border-[var(--accent-26)] rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <KeyRound className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-xs font-medium text-[var(--accent)]">
              {provider.name}
            </span>
            {subtitle && (
              <div
                className="text-[9px] text-[var(--text-muted)] truncate max-w-[260px]"
                title={subtitle}
              >
                {subtitle}
              </div>
            )}
          </div>
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--accent)]"
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
                  className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)]"
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
                  <span className="text-[10px] text-[var(--text-secondary)]">
                    ••••••••{currentKey.slice(-4)}
                  </span>
                  <button
                    onClick={() => {
                      setKeyValue(currentKey);
                      setEditingKey(true);
                    }}
                    className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)]"
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
                  className="text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)]"
                >
                  + add API key
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {provider.custom && onRemove && (
        <div className="mt-2 pt-2 border-t border-[var(--accent-26)] flex justify-end">
          <button
            onClick={handleRemoveClick}
            className={`text-[10px] ${
              confirmingRemove
                ? "text-red-400 font-medium"
                : "text-red-400/60 hover:text-red-400"
            }`}
          >
            {confirmingRemove ? "confirm remove provider?" : "remove provider"}
          </button>
        </div>
      )}
    </div>
  );
}

function AddCustomProviderSection({
  onAdd,
}: {
  onAdd: (config: CustomProviderConfig) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [paramsText, setParamsText] = useState("");
  const [error, setError] = useState("");

  function reset() {
    setShowForm(false);
    setName("");
    setBaseUrl("");
    setModel("");
    setApiKey("");
    setParamsText("");
    setError("");
  }

  function handleAdd() {
    if (!name.trim() || !baseUrl.trim() || !model.trim()) {
      setError("Name, base URL and model are required.");
      return;
    }
    let params: Record<string, unknown> | undefined;
    if (paramsText.trim()) {
      try {
        const parsed = JSON.parse(paramsText);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("not an object");
        }
        params = parsed as Record<string, unknown>;
      } catch {
        setError("Parameters must be a valid JSON object.");
        return;
      }
    }
    onAdd({
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      model: model.trim(),
      apiKey: apiKey.trim() || undefined,
      params,
    });
    reset();
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="w-full px-3 py-2.5 rounded border border-dashed border-[var(--accent-26)] text-xs text-[var(--text-muted)] hover:border-[var(--accent-44)] hover:text-[var(--accent)] transition-colors"
      >
        + add custom provider (OpenAI-compatible)
      </button>
    );
  }

  const inputClass =
    "w-full bg-black border border-[var(--accent-26)] rounded px-3 py-2 text-xs text-[var(--accent)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] outline-none";

  return (
    <div className="border border-[var(--accent-26)] rounded p-3 space-y-2">
      <div className="text-[11px] text-[var(--accent)] font-medium">
        Custom provider
      </div>
      <input
        value={name}
        onChange={(e) => { setName(e.target.value); setError(""); }}
        placeholder="Name (e.g. OpenRouter)"
        className={inputClass}
        autoFocus
      />
      <input
        value={baseUrl}
        onChange={(e) => { setBaseUrl(e.target.value); setError(""); }}
        placeholder="Base URL (e.g. https://openrouter.ai/api/v1)"
        className={inputClass}
      />
      <div className="text-[9px] text-[var(--text-muted)] -mt-1">
        /chat/completions is appended if the URL doesn&apos;t end with it
      </div>
      <input
        value={model}
        onChange={(e) => { setModel(e.target.value); setError(""); }}
        placeholder="Model (e.g. anthropic/claude-haiku-4-5)"
        className={inputClass}
      />
      <input
        type="password"
        value={apiKey}
        onChange={(e) => { setApiKey(e.target.value); setError(""); }}
        placeholder="API key (optional — can add later)"
        className={inputClass}
      />
      <input
        value={paramsText}
        onChange={(e) => { setParamsText(e.target.value); setError(""); }}
        placeholder='Extra parameters as JSON (optional, e.g. {"temperature":0.5})'
        className={inputClass}
      />
      {error && <p className="text-[10px] text-red-400">{error}</p>}
      <div className="flex gap-2 pt-0.5">
        <button
          onClick={reset}
          className="flex-1 px-3 py-1.5 rounded text-[10px] border border-[var(--accent-26)] text-[var(--text-muted)] hover:border-[var(--accent-44)] hover:text-[var(--accent)] transition-colors"
        >
          cancel
        </button>
        <button
          onClick={handleAdd}
          disabled={!name.trim() || !baseUrl.trim() || !model.trim()}
          className="flex-1 px-3 py-1.5 rounded text-[10px] bg-[var(--accent)] text-black font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
        >
          Add provider
        </button>
      </div>
    </div>
  );
}

export default function BYOKSettings({
  open,
  onClose,
  providers,
  onToggleProvider,
  onProvidersChange,
  onAddCustomProvider,
  onRemoveProvider,
  projectId,
  isEncrypted,
  onEncrypt,
  onDisableEncryption,
}: BYOKSettingsProps) {
  if (!open) return null;
  if (!projectId) return null;

  const hasKeys = providers.some((p) => p.keySet);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md border border-[var(--accent-44)] rounded bg-[#0a0a0a] p-5 sm:p-6 shadow-[0_0_40px_var(--accent-15)] my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-medium text-[var(--accent)]">
            <span className="text-[var(--text-muted)]">$ </span>
            api_keys
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security notice */}
        <div className="flex items-start gap-2 mb-4 p-3 rounded border border-[var(--accent-26)] bg-[var(--accent-10)]">
          <Shield className="w-4 h-4 text-[var(--accent)] flex-shrink-0 mt-0.5" />
          <div className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
            {isEncrypted
              ? "Your API keys are encrypted in your browser and never leave this device. Compass does not send keys to any server."
              : "Your API keys are stored locally in your browser. They never leave this device. Enable encryption below to protect them with a password."}
          </div>
        </div>

        {/* Encryption status / reminder */}
        <EncryptionSection
          projectId={projectId}
          isEncrypted={isEncrypted}
          hasKeys={hasKeys}
          onEncrypt={onEncrypt}
          onDisableEncryption={onDisableEncryption}
        />

        <div className="flex items-start gap-2 mb-5 p-3 rounded border border-yellow-600/30 bg-yellow-500/5">
          <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="text-[10px] text-yellow-500/80 leading-relaxed">
            Clearing your browser data will delete stored keys. Keep your
            original keys in a secure password manager.
          </div>
        </div>

        <div className="space-y-2">
          {providers.map((provider) => (
            <ProviderRow
              key={provider.id}
              provider={provider}
              onToggle={() => onToggleProvider(provider.id)}
              onKeysChange={onProvidersChange}
              onRemove={
                provider.custom
                  ? () => onRemoveProvider(provider.id)
                  : undefined
              }
              projectId={projectId}
            />
          ))}
          <AddCustomProviderSection onAdd={onAddCustomProvider} />
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
