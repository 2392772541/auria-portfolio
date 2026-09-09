# Card lighting — 2026-09-08

Applied to the existing Demo panel, capability matrix, highlight label and personal-extension cards. The existing project selector, content slots, routes and administration remain the source of content.

## Reference evidence

- Task: 研究黄佳沐网站实现 (`01a06a4a-b577-7043-bde3-493bbfa56ca2`). The original research messages and archived source outputs were read during this change.
- Public source: https://github.com/HHHJM845/HJM-Personal-website/tree/eda9d4faaf1a0b801d99079816e40b75207888fd
- The recorded source used translucent gradients, 18px backdrop blur, an inset highlight, a top highlight line, a 600px pointer-following radial light and small mouse-dependent rotations. Relevant files: `src/app/globals.css` and `src/components/RevealEffects.tsx`.
- The reference's ambient motion came from a blurred looping video. This adaptation uses three slowly moving CSS light fields in the local lime/mint palette. It reuses the observed light behavior without importing the reference's media, branding, sections or animation dependencies.
- The temporary reference clone no longer exists. Source details above were checked against the original archived tool outputs, not asserted as the current upstream implementation.

## Local implementation

- `src/components/SurfaceLight.tsx`: decorative layers, delegated pointer tracking and atmosphere visibility control.
- `src/surface-light.css`: translucent surface, edge mask, pointer glow, one-pass sheen, selected-item glint and slow atmosphere.
- `src/pages/PortfolioPages.tsx`: shared Demo/capability/highlight surfaces; all project data and placeholders are retained.
- `src/App.tsx`: the existing personal-extension links receive a decorative layer.
- `src/main.tsx`: install the pointer listener on public routes with hot-reload cleanup.
- Rollback source copies: `backups/light-effects-20260908-0920/`.

The pointer handler writes CSS variables once per requested animation frame, without React state updates. It tracks the current card only, supports a freshly selected project automatically and resets on scroll, drag, cancellation, blur and visibility changes. The independent CSS rotation avoids overwriting existing entrance/carousel transforms. Over buttons, links and video controls, tilt is zero. Every light layer has `pointer-events: none` and is hidden from assistive technology.

Touch devices keep a static edge treatment, disable spotlight/tilt and remove card backdrop blur. Reduced-motion changes disable the moving layers immediately, including when changed while hovering. Ambient animation pauses offscreen and when the page is hidden.

## Verification

Real Codex in-app browser checks at 1440 × 1000 and 390 × 844; desktop Demo, capability and mobile screenshots were visually inspected in the task.

| Check | Result |
| --- | --- |
| Pointer positions | Glow moved from 12.28%,23.97% to 30.06%,72.00% inside the same project card |
| Rotation | Small independent rotation observed; zero over the video |
| Edge mask | Computed `exclude, exclude`; light confined to the edge, content readable |
| Project switching | Selected project changed to agent-evaluation-lab; exactly one card, one selected item and one decoration layer |
| Newly selected card | Pointer effect activated immediately |
| Video chapter | 00:25 chapter played at 25.266 seconds, readyState 4; player paused after the check |
| Keyboard | Enter selected workflow-orchestrator; selected state remained correct |
| Reduced motion | 0 active pointer glows, rotate none, spotlight display none, atmosphere animations none |
| Ambient motion | Transform changed while visible; all three fields paused offscreen |
| Capability hover | Edge glow and icon drop shadow appeared; text remained readable |
| Mobile | 390px page width, no horizontal overflow, horizontal selector, no pointer glow, backdrop filter none |
| Mobile selection | meeting-to-action selected, exactly one project panel |
| Extension drag | Logical item 1 → 2, loop index 7 → 8; no unwanted navigation |
| Route rendering | Home, work, project detail, open source, writing, article, about, contact, 404 and admin entry rendered |
| Browser errors during interaction checks | None |
| Production/read-only audit | 28/28 passed, SQLite integrity ok, 8 upload files present |
| Existing showcase integration test | Passed, including isolated upload/save/delete-reference protection |
| Production build | Passed; existing large-chunk warning remains |

Resolved during visual verification: prefixed mask shorthand reset the mask composite in the built CSS, spreading the edge light across the video. Reordered declarations so the composite is assigned after both mask shorthands, then rebuilt and verified the computed mask and actual screenshot.

No source media, database, secrets or production deployment was modified by this visual change.

final result: passed
