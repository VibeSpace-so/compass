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
- Tailwind utility classes (e.g. `text-xs`) override plain-element CSS rules; the mobile 16px rule in `app/globals.css` needs `!important` inside a `max-width: 767px` media query. If font-size regresses to 12px, check for this specificity issue.
- `pointer: coarse` touch-target rules and safe-area insets do NOT activate in DevTools emulation — verify those by code inspection or on real hardware.
- Existing test projects in localStorage may be password-locked with unknown passwords. Create a fresh project through the UI instead of guessing.
- When filling the create-project modal via computer-use, click a field, screenshot to confirm focus, then type — batched click+type actions can land text in the wrong field.

## Devin Secrets Needed
- None for layout testing. A Groq/OpenAI key is only needed if also exercising chat.
