# Three Ages — Localization Maintenance Procedure

This is the operating contract for Localization Plan Faz 9. It applies whenever
a feature creates or changes text a player can read, hear, focus, or receive
through an accessibility surface. The English locale remains the source of
truth; gameplay data and UI code reference keys, never player-facing copies.

## 1. Feature workflow

1. **Inventory the player-facing surface.** Include visible labels, status and
   error messages, tooltips, accessible names, notifications, objectives,
   result screens, and formatted values.
2. **Add stable keys with the feature.** Put English source text and Turkish
   text in the correct locale domain in the same feature change. Do not leave
   a new player-facing key only in code, and do not use a hard-coded fallback
   as a release substitute.
3. **Check terminology before translating.** Reuse an approved term from
   [`LOCALIZATION_GLOSSARY.md`](LOCALIZATION_GLOSSARY.md). If the feature
   introduces a design term, add its English definition and approved Turkish
   term to that glossary in the same change.
4. **Prepare the Tier 1 translation batch.** Update `de`, `fr`, `es-ES`,
   `pt-BR`, `ru`, and `zh-CN` in the same feature change when practical. A
   controlled follow-up batch is allowed only when it is explicitly tracked in
   the changelog and the feature is not represented as fully localized before
   the batch completes.
5. **Run the automated gate.** Before handoff, run:

   ```powershell
   npm.cmd run test:locales
   npx.cmd tsc --noEmit
   npm.cmd run test:engine -- --filter "localization,<feature-area>"
   ```

   The filtered engine result is `PARTIAL`. Use `npm.cmd run build:verify` for
   a release candidate, broad localization change, or CI-equivalent full gate.
6. **Run UI QA at the affected surfaces.** Exercise the affected state in the
   relevant locales. Check font shaping, number/plural output, tooltip and
   aria-label updates after a language switch, clipped text, and horizontal
   overflow. Use the locale risk matrix in the production plan to choose the
   extra locale (for example, German for expansion and `zh-CN` for wrapping).
7. **Record evidence.** Add the change to
   [`LOCALIZATION_CHANGELOG.md`](LOCALIZATION_CHANGELOG.md). Record automated
   checks separately from user visual/full-match acceptance.

## 2. Translation acceptance states

Apply a status only when there is evidence for it. A locale or domain moves
forward, never by inference:

| Status | Required evidence |
| --- | --- |
| `not_started` | No translation work has been recorded. |
| `machine_draft` | A draft exists but has no human terminology review. |
| `reviewed` | A reviewer checked terminology, placeholders, and contextual meaning. |
| `ui_tested` | The affected UI states were exercised in a browser or match. |
| `approved` | `reviewed` and `ui_tested` evidence exists, plus the release owner accepts the locale. |

`machine_draft` is never storefront-ready. Do not label a shipped locale
`approved` merely because key parity or a browser smoke passed.

## 3. Changelog format

One entry per feature release or controlled translation batch:

```text
YYYY-MM-DD — <feature or translation batch>
- Domains/keys: <what changed>
- Terminology: <glossary decision, or "no new terms">
- Tier 1: <same-change update or tracked follow-up>
- Validation: <commands and result>
- UI/full-match evidence: <tested states, or explicitly open>
- Status: <locale/domain status changes, if evidence exists>
```

This log is an evidence ledger, not a translation backlog. Keep unstarted work
in its feature plan or issue instead of silently upgrading a locale status.
