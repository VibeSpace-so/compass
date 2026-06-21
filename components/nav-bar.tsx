"use client";

import { Compass, KeyRound } from "lucide-react";

interface NavBarProps {
  hasProjects: boolean;
  onSettingsClick: () => void;
  onLogoClick: () => void;
}

export default function NavBar({
  hasProjects,
  onSettingsClick,
  onLogoClick,
}: NavBarProps) {
  return (
    <nav className="sticky top-0 z-40 border-b border-[var(--accent-26)] bg-black/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
        <button
          onClick={onLogoClick}
          className="flex items-center gap-2 text-[var(--accent)] hover:opacity-80 transition-opacity"
        >
          <Compass className="w-4 h-4" />
          <span className="text-sm font-medium">compass</span>
          <span className="hidden sm:inline text-[10px] text-[var(--accent-44)]">
            by vibe space
          </span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onSettingsClick}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] text-[var(--accent-88)] hover:text-[var(--accent)] border border-[var(--accent-26)] hover:border-[var(--accent-44)] transition-all"
          >
            <KeyRound className="w-3 h-3" />
            <span className="hidden sm:inline">API keys</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
