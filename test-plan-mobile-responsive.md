# Test Plan: Mobile Responsiveness (PR #19)

App: http://localhost:3001 (branch devin/1782019821-mobile-responsive). Viewport: Chrome DevTools device toolbar at 375x812. Record all tests.

## Test 1: It should render the home page at 375px with no horizontal overflow
- Load home page at 375px.
- PASS: `document.documentElement.scrollWidth <= 375` (no horizontal scrollbar); nav shows "compass" but NOT "by vibe space" (hidden below sm:); journey map renders 2 columns (was single stacked/8-col break before fix — evidence: components/journey-map.tsx grid-cols-2 sm:grid-cols-4 md:grid-cols-8); hero text wraps with no clipping.
- FAIL: horizontal scrollbar present, "by vibe space" visible, journey grid 1 or 8 columns.

## Test 2: It should show a usable create-project modal on mobile
- Click "+ New" in projects section.
- PASS: modal fully visible within 375px viewport with padding on both sides; all form fields (name, description, password inputs) full width; cancel/create buttons reachable; backdrop covers whole screen; modal scrolls if content exceeds viewport.
- FAIL: modal clipped horizontally, buttons cut off.

## Test 3: It should show mobile-friendly unlock gate and project detail
- Open project "NoPassProject" → unlock with password.
- PASS: unlock screen title wraps (break-words), input/button full width. After unlock: project detail tabs scrollable horizontally without page overflow (overflow-x-auto), stage nav buttons show short labels "Back"/"Next" (not "Previous stage"/"Advance to ..."), guidance grid stacked in single column (lg:grid-cols-3 only kicks in ≥1024px).
- FAIL: tabs overflow the page, long button labels visible at 375px, side-by-side grid at 375px.

## Test 4: It should have touch-friendly targets and readable inputs
- Inspect a button + input via DevTools computed styles in mobile emulation.
- PASS: inputs have font-size 16px at <768px (iOS zoom prevention, app/globals.css); interactive elements have adequate size.
- FAIL: input font-size <16px on mobile.

## Test 5 (Regression): Desktop layout unchanged
- Disable device toolbar (desktop width ~1024px).
- PASS: journey map 8 columns, "by vibe space" visible in nav, guidance grid 3-column at lg widths.
- FAIL: desktop layout collapsed to mobile styles.
