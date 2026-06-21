"use client";

import { Compass, ArrowDown } from "lucide-react";

interface HeroProps {
  onStart: () => void;
  hasProjects: boolean;
}

export default function Hero({ onStart, hasProjects }: HeroProps) {
  return (
    <section className="relative pt-12 pb-10 sm:pt-16 sm:pb-12 md:pt-24 md:pb-16 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none select-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 30%, var(--accent-15) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 max-w-2xl mx-auto px-4 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 border border-[var(--accent-26)] rounded-full px-3 py-1 mb-6">
          <Compass className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="text-[10px] text-[var(--accent-88)] uppercase tracking-wider">
            Compass by Vibe Space
          </span>
        </div>

        <h1 className="text-2xl md:text-4xl lg:text-5xl font-light tracking-tight mb-4 leading-[1.15]">
          From idea to launch,{" "}
          <span className="text-[var(--accent)]">one step at a time.</span>
        </h1>

        <p className="text-sm text-[var(--accent-88)] max-w-md leading-relaxed mb-8">
          Compass helps you navigate the vibe coding journey — see where you are,
          what to do next, and what tradeoffs you&apos;re making along the way.
        </p>

        <button
          onClick={onStart}
          className="inline-flex items-center gap-2 px-6 py-3 rounded text-sm bg-[var(--accent)] text-black font-medium hover:opacity-80 transition-opacity cursor-pointer"
        >
          {hasProjects ? "Go to projects" : "Create your first project"}
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
      </div>
    </section>
  );
}
