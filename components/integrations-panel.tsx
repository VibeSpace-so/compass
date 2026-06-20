"use client";

import { ExternalLink, Plug, Check } from "lucide-react";
import { Integration, IntegrationCategory } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/integrations";

interface IntegrationsPanelProps {
  integrations: Integration[];
  onToggle: (id: string) => void;
}

function CategorySection({
  category,
  integrations,
  onToggle,
}: {
  category: IntegrationCategory;
  integrations: Integration[];
  onToggle: (id: string) => void;
}) {
  const items = integrations.filter((i) => i.category === category);
  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-medium text-[var(--accent-88)] uppercase tracking-wider mb-3">
        {CATEGORY_LABELS[category]}
      </h3>
      <div className="grid sm:grid-cols-2 gap-2">
        {items.map((integration) => (
          <div
            key={integration.id}
            className={`
              border rounded p-3 transition-all
              ${
                integration.connected
                  ? "border-[var(--accent-44)] bg-[var(--accent-10)]"
                  : "border-[var(--accent-26)] hover:border-[var(--accent-44)]"
              }
            `}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-[var(--accent)]">
                    {integration.name}
                  </span>
                  {integration.connected && (
                    <Check className="w-3 h-3 text-[var(--accent)]" />
                  )}
                </div>
                <p className="text-xs text-[var(--accent-88)] leading-relaxed">
                  {integration.description}
                </p>
              </div>

              <button
                onClick={() => onToggle(integration.id)}
                className={`
                  flex-shrink-0 px-2.5 py-1 rounded text-[10px] font-medium border transition-colors
                  ${
                    integration.connected
                      ? "border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black"
                      : "border-[var(--accent-26)] text-[var(--accent-44)] hover:border-[var(--accent-44)] hover:text-[var(--accent)]"
                  }
                `}
              >
                {integration.connected ? "Connected" : "Connect"}
              </button>
            </div>

            {integration.url && (
              <a
                href={integration.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-[var(--accent-44)] hover:text-[var(--accent)] mt-2 transition-colors"
              >
                <ExternalLink className="w-2.5 h-2.5" />
                {integration.url.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function IntegrationsPanel({
  integrations,
  onToggle,
}: IntegrationsPanelProps) {
  const categories: IntegrationCategory[] = [
    "context",
    "communication",
    "design",
    "build",
  ];

  const connectedCount = integrations.filter((i) => i.connected).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Plug className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-sm font-medium text-[var(--accent)]">
            Integrations
          </span>
        </div>
        {connectedCount > 0 && (
          <span className="text-[10px] text-[var(--accent-88)]">
            {connectedCount} connected
          </span>
        )}
      </div>

      <p className="text-xs text-[var(--accent-88)] mb-5 leading-relaxed">
        Connect your tools to give Compass more context about your project.
        Integration slots are ready for when APIs become available.
      </p>

      <div className="space-y-6">
        {categories.map((cat) => (
          <CategorySection
            key={cat}
            category={cat}
            integrations={integrations}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}
