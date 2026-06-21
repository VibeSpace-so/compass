"use client";

import { Compass, ArrowRight, Sparkles } from "lucide-react";

interface HeroProps {
  onStart: () => void;
  hasProjects: boolean;
}

export default function Hero({ onStart, hasProjects }: HeroProps) {
  return (
    <section className="relative pt-12 pb-10 md:pt-20 md:pb-14 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none select-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 30%, var(--accent-15) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 max-w-2xl mx-auto px-4 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 border border-[var(--accent-26)] rounded-full px-3 py-1 mb-5">
          <Compass className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="text-[10px] text-[var(--accent-88)] uppercase tracking-wider">
            Compass by Vibe Space
          </span>
        </div>

        <h1 className="text-2xl md:text-4xl font-light tracking-tight mb-3 leading-[1.15]">
          Your AI guide from{" "}
          <span className="text-[var(--accent)]">idea to launch.</span>
        </h1>

        <p className="text-sm text-[var(--accent-88)] max-w-sm leading-relaxed mb-6">
          Tell Compass what you&apos;re building. It&apos;ll guide you through each step
          — research, validate, build, ship — with the right tools at every stage.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={onStart}
            className="inline-flex items-center gap-2 px-6 py-3 rounded text-sm bg-[var(--accent)] text-black font-medium hover:opacity-80 transition-opacity cursor-pointer"
          >
            {hasProjects ? (
              <>
                Go to projects
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Start your first project
              </>
            )}
          </button>

          {!hasProjects && (
            <span className="text-[10px] text-[var(--accent-44)]">
              No sign-up needed. Everything stays in your browser.
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
