## TDD Preference Rule

At the start of every new implementation round, batch, feature, bugfix, refactor, or behavior-change task, ask the user whether they want to use strict TDD for that round before applying it. If the user says yes, follow strict RED → GREEN → REFACTOR and show evidence. If the user says no, do not enforce strict TDD for that round, but still add reasonable tests when they are needed to protect behavior. If the user already explicitly requested TDD for the current round or the active task/plan says TDD is mandatory, do not ask again for that same round; follow TDD. Ask again on the next new round.

## Test File Write Approval

Before creating or modifying any test file (`*.test.ts`, `*.test.tsx`, `*.spec.ts`, including under `e2e/`), stop and ask the user for explicit approval first — state which file and why, then wait for a yes before writing. This applies even when the round is proceeding without strict TDD. (Claude Code sessions in this repo enforce this via a `.claude/settings.json` PreToolUse hook; Codex has no equivalent enforcement mechanism, so this rule must be followed manually here.)

## Playwright Execution Approval

Never run any `pnpm test:e2e:*` command or `pnpm exec playwright test ...` unless the user explicitly asks for it in that message. Do not run Playwright as a side effect of "verify", "run tests", or "finish the batch" — those mean the Vitest suite (`pnpm test`) unless the user names Playwright/e2e specifically.

<claude-mem-context>
# Memory Context

# [coach-tenand] recent context, 2026-08-29 8:02pm CST

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (18,828t read) | 711,597t work | 97% savings

### Aug 16, 2026
701 6:38p ⚖️ coach-tenand database engine — PostgreSQL via Prisma custom connection URL
703 " ⚖️ coach-tenand auth — database-backed, users/sessions/invitations in PostgreSQL via Prisma
705 6:39p ⚖️ coach-tenand gallery consent flow — coach drafts, student explicitly approves before publish
708 " ⚖️ coach-tenand client surface — mobile-first responsive Next.js web app, PWA optional later
709 6:41p ⚖️ coach-tenand delivery approach — thin vertical slice, 4-phase roadmap defined
713 6:42p ⚖️ coach-tenand product shape approved — 4-phase roadmap and tenancy model locked
714 " ⚖️ coach-tenand Phase 1 user flows approved — coach review queue + student mobile logger
716 6:43p 🔵 Better Auth + Prisma adapter compatibility confirmed for Next.js + PostgreSQL stack
718 " ⚖️ coach-tenand student onboarding — single-use expiring invite link via WhatsApp, no email dependency
720 " ⚖️ coach-tenand technical architecture — modular monolith, 5 domain modules, full stack finalized
723 6:46p ⚖️ coach-tenand full technical architecture locked — user approved without revisions
725 6:51p ⚖️ coach-tenand full 5-phase evidence-gated roadmap finalized and approved
726 6:52p 🟣 coach-tenand implementation started — scaffold_foundation subagent dispatched
727 6:59p 🟣 coach-tenand Next.js scaffold in progress — feat/core-pilot branch initialized
728 7:37p ⚖️ coach-platform — Multitenant Coaching App Concept Defined
730 8:11p ⚖️ coach-platform — Multitenant Coaching SaaS Initial Requirements
733 8:47p 🔵 coach-tenand observer agent pool slot timeout
735 8:48p 🔵 coach-tenand scaffold_foundation subagent running
736 9:51p ⚖️ coach-platform — Multitenant Coaching SaaS Concept Initiated
737 10:07p ⚖️ coach-platform — Multitenant Coaching SaaS Concept Initiated
### Aug 24, 2026
739 9:54p 🟣 coach-tenand — Visible Logout Design spec created
740 9:55p 🔵 coach-tenand — SignOutAction TDD RED phase confirmed
743 " 🟣 coach-tenand — SignOutAction component shipped (Task 1 complete)
745 9:57p 🔵 coach-tenand visible-logout — Task 1 committed, Task 2 starting
746 9:59p 🟣 WorkspaceNavigation TDD Task 2 — logout integrated and committed
747 10:02p 🟣 Logout integrated into workspace dashboard navigation (Task 3)
748 " 🔵 Dashboard navigation link counts by role: COACH=4, STUDENT=3, SUPER_ADMIN=4
749 10:04p 🔵 coach-tenand visible logout — Task 5 final verification passed
### Aug 29, 2026
849 1:44p 🔵 coach-tenand — cross-workspace isolation not enforced
851 1:45p 🔵 coach-tenand workspace auth model — no per-route membership guard found
855 " 🔵 coach-tenand dev server port/BETTER_AUTH_URL mismatch causes INVALID_ORIGIN
858 3:24p ⚖️ coach-tenand — Coach Landing Page feature SDD initiated
860 3:25p 🔵 coach-tenand — full project structure and testing stack confirmed for SDD init
862 3:27p ✅ coach-tenand — SDD init context persisted to Engram
864 " ⚖️ coach-tenand — New Coach Platform Project Concept Initiated
865 3:28p 🔵 coach-tenand — Full Project State Confirmed: Architecture, Migrations, and Pilot Acceptance Criteria
866 " 🔵 coach-tenand — Prior Architecture Decisions Confirmed from Engram (obs #361, #364)
870 3:29p ⚖️ coach-tenand — Workspace Coach Landing Page Architecture Explored and Recommended Approach Selected
872 3:30p ⚖️ coach-tenand — Coach Landing Page SDD initiated
874 3:32p ⚖️ coach-tenand — Coach Landing Page SDD proposal saved to Engram
876 3:34p ⚖️ New Project — Multi-Tenant Coach Management SaaS Brainstorm Initiated
877 3:38p ⚖️ coach-tenand — Multi-Tenant Coach Platform Concept Expanded
878 " 🔵 coach-tenand — Environment Validation Schema Confirmed
879 " 🔵 coach-tenand — Modular Monolith Structure and Public Landing UI Confirmed
880 " ⚖️ coach-tenand — Full Technical Design Saved for Workspace Coach Landing Page
881 7:54p ⚖️ coach-tenand — Coach Landing Page SDD initiated (per-workspace, theme-based)
884 7:55p 🔵 coach-tenand — All Coach Landing Page SDD artifacts confirmed complete in Engram
885 7:57p 🔵 coach-tenand — Engram mem_save via exec fails when content contains backtick characters
887 " ⚖️ coach-tenand — Coach Landing Page 12-batch task list saved to Engram
889 7:58p ⚖️ coach-tenand — SDD tasks phase complete; session closed with summary

Access 712k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
