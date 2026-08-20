# Three Ages — Localization Changelog

This is the evidence ledger required by the Localization Maintenance Procedure.
Use one entry per player-facing feature release or controlled translation batch.

## 2026-08-20 — Tier 1 release gate and maintenance baseline

- Domains/keys: no new gameplay keys; the existing eight release locales are
  validated as ten domains with 624 keys each.
- Terminology: no new terms.
- Tier 1: `en`, `tr`, `de`, `fr`, `es-ES`, `pt-BR`, `ru`, and `zh-CN` are
  covered by the technical locale validator.
- Validation: `npm.cmd run test:locales` and `npm.cmd run build` passed.
  The validator checks JSON/schema, key parity, ICU placeholder parity, and
  the 669 shipped `zh-CN` Han glyphs in both Noto Sans SC weights.
- UI/full-match evidence: the isolated Chromium locale matrix passed for
  `fr`, `de`, `es-ES`, `pt-BR`, `ru`, and `zh-CN`; `zh-CN` additionally passed
  the 840px mission/build-palette viewport check. Full-match result acceptance
  remains open.
- Status: no locale is newly marked `approved`; automated technical evidence
  is intentionally recorded separately from translation review and release-owner
  acceptance.
