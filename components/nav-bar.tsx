"use client";

import { Compass, KeyRound, Settings } from "lucide-react";

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
      <div className="max-w-4xl mx-auto px-4 h-12 flex items-center justify-between">
        <button
          onClick={onLogoClick}
          className="flex items-center gap-2 text-[var(--accent)] hover:opacity-80 transition-opacity"
        >
          <Compass className="w-4 h-4" />
          <span className="text-sm font-medium">compass</span>
          <span className="text-[10px] text-[var(--accent-44)]">
            by vibe space
          </span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onSettingsClick}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] text-[var(--accent-66)] hover:text-[var(--accent)] border border-transparent hover:border-[var(--accent-26)] transition-all"
          >
            <KeyRound className="w-3 h-3" />
            API keys
          </button>
        </div>
      </div>
    </nav>
  );
}
