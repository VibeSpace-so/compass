"use client";

import { useEffect, useState } from "react";
import {
  ExternalLink,
  Plug,
  Check,
  ArrowRight,
  Loader2,
  X,
  KeyRound,
} from "lucide-react";
import { Integration, StageId } from "@/lib/types";
import { getSuggestionsForStage, StageSuggestion } from "@/lib/integrations";
import { useIntegrationService } from "@/lib/hooks/use-integration-service";

interface IntegrationsPanelProps {
  integrations: Integration[];
  onToggle: (id: string) => void;
  stageId: StageId;
  projectId: string;
}

export default function IntegrationsPanel({
  integrations,
  onToggle,
  stageId,
  projectId,
}: IntegrationsPanelProps) {
  const suggestions = getSuggestionsForStage(stageId);

  if (suggestions.length === 0) return null;

  return (
    <div className="border border-[var(--accent-26)] rounded p-4">
      <div className="flex items-center gap-2 mb-3">
        <Plug className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider font-medium">
          Suggested integrations
        </span>
      </div>

      <div className="space-y-2.5">
        {suggestions.map((suggestion) => {
          const integration = integrations.find(
            (i) => i.id === suggestion.integrationId
          );
          if (!integration) return null;

          return (
            <SuggestionCard
              key={suggestion.integrationId}
              integration={integration}
              suggestion={suggestion}
              onToggle={onToggle}
              projectId={projectId}
            />
          );
        })}
      </div>
    </div>
  );
}

function SuggestionCard({
  integration,
  suggestion,
  onToggle,
  projectId,
}: {
  integration: Integration;
  suggestion: StageSuggestion;
  onToggle: (id: string) => void;
  projectId: string;
}) {
  const { saveToken, hasToken, removeToken, registry } =
    useIntegrationService(projectId);

  const [showTokenForm, setShowTokenForm] = useState(false);
  const [tokenValue, setTokenValue] = useState("");
  const [tokenSaved, setTokenSaved] = useState(() =>
    hasToken(integration.id)
  );
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const projectConnected =
    tokenSaved && (testResult === null || testResult.success);

  useEffect(() => {
    setTokenSaved(hasToken(integration.id));
    setTestResult(null);
  }, [hasToken, integration.id, projectId]);

  function handleConnect() {
    if (projectConnected) {
      removeToken(integration.id);
      setTokenSaved(false);
      setShowTokenForm(false);
      setTestResult(null);
      if (integration.connected) onToggle(integration.id);
      return;
    }
    setShowTokenForm(true);
  }

  function handleSaveToken() {
    if (!tokenValue.trim()) return;
    saveToken(integration.id, tokenValue.trim());
    setTokenValue("");
    setTokenSaved(true);
    setTestResult(null);
    if (!integration.connected) onToggle(integration.id);
  }

  function handleCancelToken() {
    setShowTokenForm(false);
    setTokenValue("");
  }

  async function handleTestConnection() {
    const connector = registry.getConnector(integration.id);
    if (!connector) {
      setTestResult({
        success: false,
        message: "No connector registered for this integration.",
      });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await connector.testConnection();
      setTestResult(result);
    } catch {
      setTestResult({ success: false, message: "Connection test failed." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div
      className={`
        rounded p-3 transition-all
        ${
          projectConnected
            ? "bg-[var(--accent-10)] border border-[var(--accent-44)]"
            : testResult && !testResult.success
              ? "bg-red-500/5 border border-red-500/40"
            : "bg-black/30 border border-[var(--accent-26)] hover:border-[var(--accent-44)]"
        }
      `}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-[var(--accent)]">
              {integration.name}
            </span>
            {projectConnected && (
              <Check className="w-3 h-3 text-[var(--accent)]" />
            )}
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-1">
            {suggestion.purpose}
          </p>
          <p className="text-[10px] text-[var(--text-muted)] leading-relaxed flex items-start gap-1">
            <ArrowRight className="w-2.5 h-2.5 mt-0.5 flex-shrink-0" />
            {suggestion.outcome}
          </p>
        </div>

        <div className="flex items-center sm:flex-col sm:items-end gap-2 sm:gap-1.5">
          <button
            onClick={handleConnect}
            className={`
              flex-shrink-0 px-3 py-1.5 sm:px-2.5 sm:py-1 rounded text-[11px] sm:text-[10px] font-medium border transition-colors
              ${
                projectConnected
                  ? "border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black"
                  : "border-[var(--accent-44)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              }
            `}
          >
            {projectConnected
              ? "Connected"
              : testResult && !testResult.success
                ? "Error"
                : "Connect"}
          </button>
          {integration.url && (
            <a
              href={integration.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
            >
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>

      {showTokenForm && !projectConnected && (
        <div className="mt-2.5 pt-2.5 border-t border-[var(--accent-26)]">
          <div className="flex items-center gap-1.5 mb-1.5">
            <KeyRound className="w-3 h-3 text-[var(--text-muted)]" />
            <span className="text-[10px] text-[var(--text-secondary)]">
              API token for {integration.name}
            </span>
          </div>
          <div className="flex gap-1.5">
            <input
              type="password"
              value={tokenValue}
              onChange={(e) => setTokenValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveToken()}
              placeholder="Paste your API token…"
              className="flex-1 bg-black/40 border border-[var(--accent-26)] rounded px-2 py-1 text-[10px] text-[var(--text-secondary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-66)]"
            />
            <button
              onClick={handleSaveToken}
              disabled={!tokenValue.trim()}
              className="px-2 py-1 rounded text-[10px] font-medium border border-[var(--accent-44)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save
            </button>
            <button
              onClick={handleCancelToken}
              className="px-1.5 py-1 rounded text-[10px] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {tokenSaved && (
        <div className="mt-2.5 pt-2.5 border-t border-[var(--accent-26)]">
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border border-[var(--accent-44)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors disabled:opacity-60"
            >
              {testing && <Loader2 className="w-3 h-3 animate-spin" />}
              Test connection
            </button>
            {testResult && (
              <span
                className={`text-[10px] ${
                  testResult.success
                    ? "text-[var(--accent)]"
                    : "text-red-400"
                }`}
              >
                {testResult.message}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
