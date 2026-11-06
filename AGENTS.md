# TPGlobo — maintenance instructions

## Authorized scope

Maintain the Angular frontend of TP Inteligente, using the approved dark Figma Make design. Angular 21.2.25; CLI/build 21.2.29; TypeScript 5.9.3; standalone components, external HTML/CSS. Preserve exact dependency versions and the lockfile unless a concrete change requires otherwise.

The MVP has one user profile: admin. The backend is maintained separately by the team. Do not generate another backend, add user administration, integrate iNews, invent API routes, or emulate successful server writes. The recorded API documents login, current-user lookup, script list, lookup, creation, PATCH update and DELETE archive. The user confirmed real PATCH editing and DELETE archiving against the Render API on 05/11/2026; never emulate server writes.

UI and user documentation use Brazilian Portuguese. Identifiers and source comments use English. Prefer small components/services, ordinary CSS and the existing SVG/system-font language. No remote fonts or additional UI framework are needed.

## Commands

- Node: `^22.12.0 || ^24.0.0`; pnpm 10.34.3.
- Install: `pnpm install --frozen-lockfile`.
- Develop: `pnpm run dev` (localhost:4200).
- Check application/types/templates: `pnpm run build`.
- Logic/service tests: `pnpm test`.
- `pnpm run format -- <paths>` uses the retained oxfmt 0.2.0. Avoid inline multi-property type literals and nested readonly shorthand: this old formatter can corrupt those constructs. Always inspect its changes and build afterward.

`proxy.conf.json` sends `/api/**` to the Render backend during development. Production hosting separately needs an API proxy and Angular route fallback. Never store JWT signing secrets, database credentials or real passwords in this project.

## Boundaries

- `core/api-client.service.ts`: HTTP errors, login, memory-only token, expiry and rejection of stale session responses. Guards do not replace backend authorization.
- `core/scripts.service.ts`: API operations only, with read-after-write verification for PATCH/DELETE. No localStorage persistence or demo fallbacks.
- `models/script.model.ts`: adapter for `titulo`, `categoria`, `blocos`, `_id` and timestamps. Preserve all block types; only `fala` enters the spoken reader.
- `models/formatted-text.ts`: small marker convention stored inside the existing `texto` string. Keep text escaped; never render arbitrary HTML. Coordinate future format changes with backend consumers.
- `pages/scripts/`: isolated create/edit drafts, category/block validation, add/remove/reorder draft blocks, archive confirmation, confirmation before discard and logout. Network errors preserve the draft; do not automatically repeat POST.
- `presentation/presentation.service.ts`: one logical word index and reading state. Manual navigation pauses listening. Restart preserves visual settings; leaving ends the presentation.
- `presentation/speech.service.ts`: browser recognition, pt-BR, explicit user initiation, permission/error handling, bounded restart, stop/abort cleanup. No fake confidence, latency, connection or microphone indicators. No stored transcript/audio.
- `presentation/speech-alignment.ts`: conservative forward matching, unambiguous final phrases for distant jumps. Do not claim semantic topic understanding.
- `script-reader/`: formatting, partial-word style segments, paragraph structure and logical index alignment at roughly 35% of the viewport.
- `presentation/presenter-window.service.ts` and `projection-receiver.service.ts`: same-origin messages, exact source/origin, session/receiver IDs, sequence and lease. Never use wildcard target origins or send login tokens to the presenter.

The projection route cannot fetch a saved script by itself. It renders only after binding with its opening operator. Reloading/closing/leaving the owner must remove the projected content. The receiver never runs a reading clock or microphone.

## Visual and interaction constraints

`public/favicon.svg` matches the monitor/reading-lines motif of the existing header mark; `index.html` points to it. Preserve this first-party favicon unless a new logo is approved. The visual mark is not a claim of affiliation with a broadcaster.

Preserve the dark palette, desktop operator/presenter composition and usable layouts at 390px, 768px and desktop. Reading controls stay near the text; secondary settings may scroll. Mirror only presenter text. Font, spacing, contrast, view changes and fullscreen preserve the logical position. No automatic microphone access on entry.

Shortcuts: Space, Left/Right, Home. Ignore editable fields, controls, composition, modifiers and repeated keys. Fullscreen refusal must leave reading usable.

## Verification and delivery

Run tests and a production build after functional changes. Use isolated fixtures for UI tests and report their limits. Do not present mocks, synthetic recognizer callbacks or an HTTP fixture as real backend/microphone validation. `tests/fixture-browser.js` is test-only and must never be included in Angular production assets or index.html.

Keep README and tests/README aligned with actual behavior. User-confirmed 05/11 tests total 39/39 executed passing plus one untested second-monitor check; do not count these as automated tests. Legacy script text showing `�` requires API-response investigation, not silent character replacements. Remove obsolete Make-only files and unused code, preserving the original input archive. Do not package dependencies, build output, caches, credentials or Git metadata in the source ZIP.

The professor permits AI assistance but forbids adding AI as a GitHub collaborator. Do not create AI coauthor trailers, authors, collaborators or bot identities. Do not commit, push, merge or deploy without user authorization. This instruction file does not grant those actions.
