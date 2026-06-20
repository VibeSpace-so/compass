"use client";

import { Compass } from "lucide-react";

interface HeroProps {
  onStart: () => void;
}

export default function Hero({ onStart }: HeroProps) {
  return (
    <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none select-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 30%, var(--accent-15) 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-4 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 border border-[var(--accent-44)] rounded-full px-3 py-1 mb-8">
          <Compass className="w-4 h-4 text-[var(--accent)]" />
          <span className="text-xs text-[var(--accent-88)] uppercase tracking-wider">
            by Vibe Space
          </span>
        </div>

        <h1 className="text-3xl md:text-5xl lg:text-6xl font-light tracking-tight mb-6 leading-[1.1]">
          Navigate your{" "}
          <span className="text-[var(--accent)]">vibe coding</span>
          <br />
          journey with clarity.
        </h1>

        <p className="text-sm md:text-base text-[var(--accent-cc)] max-w-lg leading-relaxed mb-10">
          Compass guides you from idea to launch with opinionated paths,
          curated tools, and debt visibility — so you always know where you
          are and what to do next.
        </p>

        <button
          onClick={onStart}
          className="inline-block px-8 py-4 rounded text-sm md:text-base bg-[var(--accent)] text-black font-medium hover:opacity-80 transition-opacity cursor-pointer"
        >
          Start your path
        </button>

        <p className="text-xs text-[var(--accent-66)] mt-4">
          No account needed. Everything stays in your browser.
        </p>
      </div>
    </section>
  );
}
