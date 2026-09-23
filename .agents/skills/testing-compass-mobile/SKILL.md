---
name: testing-compass-mobile
description: Test Compass mobile responsiveness end-to-end at 375px viewport. Use when verifying responsive layout, touch targets, or mobile CSS changes.
---

# Testing Compass Mobile Responsiveness

## Setup
- Run `npx next dev -p 3001` from the repo root. If port is busy: `fuser -k 3001/tcp`.
- If the dev server shows a webpack HMR error ("__webpack_modules__[moduleId] is not a function") after editing globals.css, restart it and clear the cache: `rm -rf .next` then start again.
- Use Chrome DevTools device toolbar (Ctrl+Shift+M) set to Responsive 375x812. Disable it for desktop regression checks.

## Key assertions
- No horizontal overflow: run `document.documentElement.scrollWidth <= window.innerWidth` in the console.
- Journey map: 2 cols at 375px, 8 cols on desktop (`components/journey-map.tsx`).
- Nav subtitle "by vibe space" hidden below `sm:` breakpoint.
- Project detail: tabs scroll inside their row (overflow-x-auto), stage nav shows short "Back"/"Next" labels on mobile, Guidance stacks single-column below `lg`.
- Input font-size must be 16px at <768px (iOS zoom prevention). Check with `getComputedStyle(document.querySelector('input')).fontSize` on a page that actually has an input (home page has none — open the create-project modal first).

## Pitfalls
- Do NOT try to emulate mobile by shrinking the real Chrome window (`wmctrl -r ... -e 0,0,0,407,...`): Chrome enforces a ~500 CSS-px minimum window width, so `innerWidth` bottoms out around 500 and you never reach 375. Use the DevTools device toolbar and **leave DevTools open** — closing it (F12) cancels emulation and resets the viewport.
- After toggling the device toolbar, always confirm emulation actually applied before asserting: `console.log(window.innerWidth)` should print exactly `375`. Typing into the width/height boxes can silently miss if the toolbar lost focus.
- Elements can render in the viewport yet be unreachable behind overlapping chrome — e.g. the mobile sidebar overlay's tab row once sat under the sticky nav (fixed in PR #35). Verify reachability with `document.elementFromPoint(cx, cy)` rather than assuming a rendered button is clickable. Ctrl+B still toggles the sidebar.
- DevTools docked shrinks the page viewport below the md breakpoint — close DevTools (or undock it) before asserting desktop layout, or the sidebar auto-close effect and `hidden md:` elements will make desktop look like mobile.
- Keyboard shortcuts like Ctrl+Shift+M can be swallowed when the DevTools Console input has focus — click the page first or use F12, which still toggles DevTools.
- In device-emulation mode the emulated page keeps scroll position across view changes and the view drifts after clicks; re-locate target buttons from a fresh screenshot before each click instead of reusing stale coordinates.
- When DevTools is docked right, the emulated page viewport shrinks to roughly x<665 — clicks at x>665 hit the DevTools pane, not the app. If a clearly-rendered button "does nothing", check whether the click landed inside DevTools.
- The project header row (back-arrow + title + Export + Info toggle with the pending-advance yellow dot) scrolls UNDER the sticky nav (49px, `position:sticky top:0`) whenever the body scrolls at 375px — it is often invisible during normal use. To verify the dot, use `document.querySelector('.bg-yellow-500')` for DOM presence and `toggle.scrollIntoView()` to pull the header back into view for a screenshot.
- The `(i)`-looking icon at the mobile nav's top-right (~x=427,115 at 375px emulation) opens the API-keys modal, NOT the sidebar — use Ctrl+B for the mobile sidebar overlay.
- Memory-row action buttons (pencil/trash, `opacity-0 group-hover:opacity-100`) are hard to hover at 375px — find their real coordinates via the DOM first (`button[title="Remove memory"].getBoundingClientRect()`, page coords ≈ screen `x≈215+px*0.64, y≈100+py*0.64` for a 375px frame docked right) then click directly.
- The Brief→Memories row fix (`flex-1 min-w-0`) passes at desktop sidebar width but the same row still squeezes to a ~55px one-word-per-line column at 375px — the fixed right cluster (nowrap date + always-laid-out action buttons) starves the text column; verify squeeze fixes at BOTH widths.
- Tailwind utility classes (e.g. `text-xs`) override plain-element CSS rules; the mobile 16px rule in `app/globals.css` needs `!important` inside a `max-width: 767px` media query. If font-size regresses to 12px, check for this specificity issue.
- `pointer: coarse` touch-target rules and safe-area insets do NOT activate in DevTools emulation — verify those by code inspection or on real hardware.
- Existing test projects in localStorage may be password-locked with unknown passwords. Create a fresh project through the UI instead of guessing.
- When filling the create-project modal via computer-use, click a field, screenshot to confirm focus, then type — batched click+type actions can land text in the wrong field.

## Devin Secrets Needed
- None for layout testing. A Groq/OpenAI key is only needed if also exercising chat.
