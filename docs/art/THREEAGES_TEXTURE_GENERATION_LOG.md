# ThreeAges Texture Generation Log

This log records only reviewed source candidates and accepted production assets.
An entry marked `candidate` is not a runtime asset and must not be referenced by
a material or manifest until the pilot receives explicit visual acceptance.

## wood-dark — candidate review

Date: 2026-08-06  
Status: `accepted` — Variant A approved by the user

Shared prompt:

> Use case: stylized-concept. Asset type: seamless game-material albedo tile for
> ThreeAges RTS low-poly fantasy medieval buildings. One square, genuinely
> seamless, direction-neutral dark aged timber plank surface; broad simple
> hand-painted colour clusters, warm deep brown with subtle charcoal grain,
> sparse knots, low visual noise, readable from a distant top-down RTS camera.
> Orthographic flat texture only; completely even diffuse lighting; no ambient
> occlusion, cast shadows, highlights, bevels, text, watermark, logos, seams or
> isolated repeating landmark. Avoid photorealistic scan, perspective, dramatic
> grain, sunlight and vignette.

| Variant | Project copy | 3×3 preview | Review note |
| --- | --- | --- | --- |
| A | `docs/art/candidates/T_TA_Wood_Dark_Candidate_A.png` | `..._A_3x3.png` | **Accepted.** Finer plank rhythm; better edge continuity, but knots still form a visible repeat grid. |
| B | `docs/art/candidates/T_TA_Wood_Dark_Candidate_B.png` | `..._B_3x3.png` | Larger timber read, but vertical board-end seams repeat too visibly. |

Deterministic pipeline result for A:

- Command: `npm run texture:threeages -- --input docs/art/candidates/T_TA_Wood_Dark_Candidate_A.png --out-dir docs/art/candidates/processed --name T_TA_Wood_Dark_Candidate_A --dry-run`
- Output: `public/assets/ThreeAges/Textures/T_TA_Wood_Dark_BC.png`, `..._N.png`, `..._ORM.png`; preview `docs/art/previews/T_TA_Wood_Dark_3x3.png`.
- Seam metric: vertical `0.00000`, horizontal `0.00150`, maximum `0.00150` (threshold `0.01500`).

The final BC/N/ORM texture records and `threeages-mat-wood-dark` material are
registered in the asset manifest. The material remains unattached to a model or
Landscape layer until the pilot presentation acceptance slice. The Material
Editor browser smoke opened the registered material with status `Ready.` and no
page errors.

## wood-light — candidate review

Date: 2026-08-06  
Status: `candidate` — awaits explicit visual acceptance

| Variant | Project copy | 3×3 preview | Review note |
| --- | --- | --- | --- |
| A | `docs/art/candidates/T_TA_Wood_Light_Candidate_A.png` | `docs/art/candidates/processed/T_TA_Wood_Light_Candidate_A_3x3.png` | Softer all-oak palette and lower contrast; still has repeated knot landmarks. |
| B | `docs/art/candidates/T_TA_Wood_Light_Candidate_B.png` | `docs/art/candidates/processed/T_TA_Wood_Light_Candidate_B_3x3.png` | More weathered gray-board variation, but the repeating board pattern is stronger. |

Both candidates were generated with the built-in image generator and processed
locally as 1024² tile candidates. Seam metrics: A `0.00055`; B `0.00158`
(threshold `0.01500`). Neither candidate is registered in the runtime manifest.
