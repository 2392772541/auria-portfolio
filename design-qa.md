# Homepage capability matrix reference QA

Superseded: the user cancelled this visual replication on 2026-09-09 and requested a calmer lower-section redesign. See docs/LOWER-SECTION-REDESIGN.md for current scope and verification. The blocked findings below are historical, not the acceptance criteria for the new design.

Source: C:/Users/win10/AppData/Local/Temp/codex-clipboard-04c01c93-c3b8-4db8-b315-609b31627907.png (1674 × 943).

Implementation: http://127.0.0.1:3101/?verify=matrix-v2#showcase-capabilities
Browser screenshots inspected inline through CUA at 1674 × 943 and 390 × 844. No saved screenshot path or combined comparison artifact is available; formal comparison remains incomplete. Desktop screenshot includes the persistent site navigation and approximately 90px of preceding content, unlike the source crop.

## Findings

- P1: Background orbital crescent and precise corner highlights are missing. Image generation failed three times: first response decode error, then twice HTTP 503 with no available compatible accounts. Existing website LightAtmosphere is reused temporarily.
- P2: Badge lacks the exact segmented luminous edge of the source.
- P2: Formal same-crop combined screenshot comparison remains outstanding. Do not claim pixel-identical completion.

## Completed adjustments and checks

- Layout: separate four-column/two-row cards, angled baseline and second-row offset; lower two-column highlights. First browser pass found excess vertical spacing and overlong heading rail; revised spacing and rail length in second pass.
- Typography: sans-serif large headings, 21px card labels and 16px supporting text, replacing the prior small grid text. Line wrapping still requires final aligned comparison.
- Colors: dark navy, blue/teal/green card borders and bright green emphasis.
- Assets: reused Lucide icons matching the depicted subjects and original LightAtmosphere. Dedicated background still blocked by generation service.
- Content: all eight capability items and five highlights use existing data; no fabricated metrics. Missing results remain explicitly marked.
- Desktop and 390px mobile: no horizontal document overflow; eight cards and five highlight rows present. Mobile cards stack vertically.
- npm run build passed; key page entry routes and public bootstrap HTTP 200. This HTTP check does not claim every route interaction was tested.

final result: blocked
