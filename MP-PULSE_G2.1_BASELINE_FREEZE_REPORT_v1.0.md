# MP-PULSE — G2.1 SOURCE ACCESS / BASELINE FREEZE REPORT
Version 1.0
Date: 16 August 2026
Builder: Claude Code (PRIMARY BUILDER per IN-001 v1.0 APPROVED)
Governing documents: Good-v1 SPEC v1.0 APPROVED · Claude Code Builder Handoff v1.0 · IN-001 v1.0 APPROVED

**RECOMMENDATION: STOP / ESCALATE**

No material implementation change was made. G2.2 was not started.

---

## 1. REPOSITORY CONFIRMED — NEGATIVE

| Item | Handoff §2 (required) | Actually available to this session |
|---|---|---|
| Repository | `marcopoletti78-blip/delta-operational-review` | `marcopoletti78-blip/DELTAgroup-CS` |
| Application | Survey Engine (Vite + React + Supabase) | `deltagroup-security-app` — Concetto di Sicurezza / PPS document generator |

The mandated MP-PULSE baseline repository is **not** the repository attached to this session.

## 2. SOURCE-ACCESS STATUS — DENIED

Three independent access attempts against `marcopoletti78-blip/delta-operational-review`:

1. `add_repo` (access: push) → denied by session permission classifier.
2. `list_repos` (repository discovery) → denied by session permission classifier.
3. GitHub MCP `list_branches` → `Access denied: repository "marcopoletti78-blip/delta-operational-review" is not configured for this session. Allowed repositories: marcopoletti78-blip/deltagroup-cs`

Session GitHub scope is hard-limited to `marcopoletti78-blip/deltagroup-cs`. No read or write path to the mandated repository exists.

## 3. INSPECTED BRANCH TOPOLOGY

Topology of the only reachable repository (`DELTAgroup-CS`):

- `main` — `b5d26fdefe10bc93c2dc6b1e200f502f4f2bb55c`
- `claude/g2-1-baseline-freeze-05fxjy` — `b5d26fdefe10bc93c2dc6b1e200f502f4f2bb55c` (0 ahead / 0 behind `main`)
- Remotes: `origin/main`, `origin/claude/g2-1-baseline-freeze-05fxjy`
- Total commits on HEAD: 51

`sprint-0-poc` **does not exist** in this repository.

## 4. VERIFIED STARTING BRANCH

`claude/g2-1-baseline-freeze-05fxjy` (pre-created by the execution harness).

This is **not** an MP-PULSE baseline. It is a branch of an unrelated application and cannot serve as the Good-v1 base.

## 5. VERIFIED STARTING COMMIT SHA

- HEAD: `b5d26fdefe10bc93c2dc6b1e200f502f4f2bb55c`
- Author: Marco Poletti / DELTAgroup · 2026-06-17T22:31:46+02:00
- Subject: `docs: aggiorna STATO_PROGETTO_CS con sessione editor annotazioni`

Required baseline commit `9aed11aef9bfb91997789ff045a691e42cdb4f8a` (Handoff §2) — **object not present in this repository** (`git cat-file` → *could not get object info*).

## 6. CLEAN BASELINE BUILD RESULT — PASS (wrong artefact)

Executed against the reachable repository, using its actual tooling:

- Package manager / install: `npm ci` → 161 packages, success
- Build command: `npm run build` (`vite build`, Vite 5.4.21) → **SUCCESS**, exit 0
- Output: 166 modules transformed; `dist/index.html` 1.33 kB; `dist/assets/index-DplRgKK6.js` 3,623.01 kB (gzip 1,448.46 kB)
- Warnings: single non-blocking chunk-size warning (>500 kB)

The build passes, but it builds the CS/PPS document generator — not the Survey Engine. It is not a valid Good-v1 baseline.

## 7. GOOD-v1 BRANCH — NOT CREATED (deliberate)

No Good-v1 working branch was created.

Creating it here would violate Handoff §3.H (*"Do not create a second repository or a new source of truth"*), HC-01 (*reuse existing Survey Engine*) and IN-001 §2 (*Claude Code must work directly against the existing private MP GitHub repository and preserve repository continuity*). Repository discontinuity is precisely the failure that caused Lovable's removal as primary builder; reproducing it under Claude Code would defeat the purpose of IN-001.

## 8. BASELINE DISCREPANCIES

### D-1 — BLOCKER: wrong repository
Mandated `delta-operational-review` is unreachable; the attached repository is a different product.

### D-2 — BLOCKER: baseline branch absent
`sprint-0-poc` does not exist here.

### D-3 — BLOCKER: baseline commit absent
`9aed11aef9bfb91997789ff045a691e42cdb4f8a` is not an object in this repository.

### D-4 — BLOCKER: Survey Engine absent
Code inspection of the full source tree (19 files under `src/`, `api/`, `scripts/`) found **zero** references to `survey_`. None of the preserved assets required by Handoff §2 are present:

| Required asset (Handoff §2) | Present |
|---|---|
| `survey_*` schema | NO |
| immutable `survey_versions` JSONB snapshots | NO |
| anonymous + nominal/token flows | NO |
| `public.redeem_survey_token` | NO |
| branching | NO |
| seven supported question types | NO |
| separate admin vs public SurveyFill Supabase clients | NO |

Actual data layer: tables `cs_documenti` and `profili`; a **single** Supabase client (`src/supabaseClient.js`, anon key via `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`) with a stub fallback when env vars are missing. The D-028 separate-client pattern (Handoff §5.5) does not exist here because there is no public respondent flow to separate.

### D-5 — Supabase project state not confirmed
Handoff §3.G requires confirming Supabase project/schema/migration state before any migration. The mandated project is `delta-operational-review-poc` (ref `wjdckthjiebbjxgifdlj`, eu-central-2). This repository contains **no** `supabase/` directory and **no** migrations, and binds to whatever project the deployment env vars point at. The mandated project state was not confirmed and no migration was attempted.

## 9. STOP CONDITIONS TRIGGERED (Handoff §12)

- ✅ *repository access is unavailable*
- ✅ *real working baseline materially differs from G1 evidence*
- ✅ *repository continuity cannot be preserved*

Per §12, these are reported rather than improvised around. No workaround was applied: no second repository, no recreation of the Survey Engine in this repository, no hardcoding, no fabricated baseline.

## 10. RECOMMENDATION

**STOP / ESCALATE.** G2.2 not started; no material implementation change made.

Unblocking requires one Governor action:

1. Grant this Claude Code session read/write access to `marcopoletti78-blip/delta-operational-review` and attach it as a session source, then re-run G2.1. This is the only path consistent with IN-001 and HC-01.

Alternatives that would require an explicit new Governor decision (not assumed here):

2. If `delta-operational-review` has been renamed/migrated, provide the current canonical repository identity plus the corresponding baseline branch and commit, and re-run G2.1 against it.
3. If the Governor intends MP-PULSE to be built somewhere other than the verified existing asset, that is a departure from G1 *REUSE WITH FIXES* and from IN-001, and requires an explicit scoped approval before any implementation.

Awaiting Governor / MP execution continuation decision.

---
END — MP-PULSE G2.1 Baseline Freeze Report v1.0
