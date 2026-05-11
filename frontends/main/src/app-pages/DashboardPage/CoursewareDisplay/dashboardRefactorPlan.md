# Dashboard Cleanup Implementation Plan

> **For agentic workers:** This plan is **human-in-the-loop**. Do not autonomously execute multiple phases. Each phase ends at a review checkpoint with the human reviewer (see [Working agreement](#working-agreement)). The checkbox lists in each phase are **starting hypotheses**, not exhaustive specs — verify by reading current code before mechanically moving things, and surface anything you find that the plan didn't anticipate.

**Goal:** Make the dashboard easier to reason about by separating data orchestration from rendering. Program and contract dashboards become slot-driven with `enrollments[]` as the source of truth, removing today's premature N→1 collapse. Visible behavior is preserved until multi-run UX is decided.

**Architecture:** Use dashboard-specific data composers to move query orchestration, requirement-tree shaping, enrollment grouping, and language/run resolution out of render-heavy components. Keep `My Learning` enrollment-driven, make program/contract dashboards slot-driven, and adapt the new view model back into the existing cards before attempting card replacement.

**Tech Stack:** Next.js App Router, React, TypeScript, React Query, generated MITxOnline API hooks, Jest + React Testing Library, `ol-components`, `@mitodl/smoot-design`.

---

## Working agreement

This plan is not a script. Every phase is a judgment opportunity, not a checklist to be auto-executed.

**Cadence.** One phase at a time, with an explicit review checkpoint at each phase boundary. Agents should not advance to the next phase without human acknowledgement that the previous phase achieved its purpose.

**Success criterion: complexity is reduced, not relocated.** The user-visible improvement of this refactor is "the dashboard is easier to reason about." That improvement is _not_ delivered by adding new directories or by colocating queries into hooks. It is delivered by **each artifact having a single, name-able responsibility that fits in your head**. A hook that composes 6 named helpers fits in your head; a hook that inlines 6 transforms does not. Moving a 700-line orchestration into a 700-line hook is a failure of this phase, even if every checkbox is ticked. Every extracted unit must be smaller, more focused, and more testable than what it replaced — or the extraction has not delivered cleanup.

**Phase-boundary review questions.** At the end of every phase, the agent and reviewer answer together:

1. **Did this phase make the dashboard easier to reason about?** Concretely — what is now smaller, more isolated, or better tested? If the answer is "not really," investigate why before continuing.
2. **What did we discover that the plan didn't anticipate?** Adjacent dead code, duplicated logic, missing tests, surprising couplings, naming inconsistencies. Decide per-finding: fold into the current phase, schedule for a later phase, file as a follow-up note, or explicitly drop.
3. **Is the next phase still scoped correctly?** Reality may differ from the plan's assumptions. Re-scope before proceeding rather than forcing the original list.
4. **Is anything in this phase actually a behavior change in disguise?** If yes, stop and split it into its own PR with product acknowledgement (per the goal: visible behavior is preserved unless explicitly called out).

**How to read the phase task lists.**

- Each checkbox is a **hypothesis** ("we believe this helper belongs in `dashboardLanguagePolicy.ts`"). Verify by reading callsites and tests before moving code.
- Lists are **starting points**, not exhaustive. If the phase needs less, do less. If it needs more, surface it at the checkpoint instead of silently expanding scope.
- Do not treat completion of every checkbox as "phase done." Phase done = the review questions above are answered well.

**When to stop the phase.**

- An assumption in the plan turns out to be wrong (e.g., a function is used somewhere not anticipated).
- A behavior change appears unavoidable.
- Test coverage in the area being touched is thinner than expected.
- The current phase is clearly delivering less cleanup value than expected.

In all cases: stop, write up what you found, and pair with the human reviewer before continuing.

---

## High-level summary

This work is worthwhile now because the current dashboard implementation has structural risk independent of final product decisions about multi-run users. `EnrollmentDisplay.tsx` and `ContractContent.tsx` both mix data fetching, API shape translation, language selection, enrollment selection, requirement-tree shaping, and rendering. `DashboardCard.tsx` and `ModuleCard.tsx` overlap heavily, but deleting or unifying them first would preserve the wrong data contract. The code also repeatedly collapses multiple enrollments into one selected enrollment, which hides information that any future multi-run UI will need.

Before introducing more new UX to the Dashboard, this plan makes the internal dashboard model honest: program and contract course slots should carry all matching enrollments, plus a clearly named temporary display choice. Current behavior should remain mostly stable while product decides whether alternate runs are shown via dropdown, dialog, inline list, expanded mode, or some other affordance.

## Codebase review assessment

Based on the current code, the plan is technically correct with the constraints below.

### Confirmed by code

- `frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/EnrollmentDisplay.tsx` is overloaded:
  - imports React Query hooks directly,
  - builds home enrollment sections,
  - builds program requirement sections,
  - owns dashboard-wide program language state,
  - calls `getSelectedLanguageOption`, `getCourseRunForSelectedLanguage`, `getEnrollmentForSelectedLanguage`, `getResolvedRunForSelectedLanguage`,
  - calls `selectBestEnrollment` when no language-specific enrollment is selected,
  - renders `DashboardCard` and `ProgramAsCourseCard`.
- `frontends/main/src/app-pages/DashboardPage/ContractContent.tsx` repeats much of that orchestration with contract-specific behavior:
  - loads enrollments, programs, program collections, and courses,
  - computes language options from contract courses,
  - filters programs by contract membership and contract-scoped course runs,
  - renders `OrgProgramDisplay` and `OrgProgramCollectionDisplay`,
  - calls `selectBestContractEnrollmentForLanguage`, `getCourseRunForSelectedLanguage`, and `getResolvedRunForSelectedLanguage` at multiple card callsites.
- `frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/helpers.ts` has `selectBestEnrollment(course, enrollments)`, which reduces all matching enrollments for a course to one enrollment using certificate, grade, then first-match priority.
- `frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/languageOptions.ts` has several single-enrollment/run resolution helpers:
  - `getEnrollmentForSelectedLanguage`,
  - `selectBestContractEnrollmentForLanguage`,
  - `getResolvedRunForSelectedLanguage`.
- `getResolvedRunForSelectedLanguage` currently adapts a V3 enrollment run into a V2 `CourseRunV2`-shaped object for downstream card consumers. That is a compatibility layer, not a desirable long-term enrolled-card model.
- `ProgramAsCourseCard.tsx` repeatedly calls `selectBestEnrollment` for module progress and module card rendering, then renders `ModuleCard`.
- `DashboardCard.tsx` still owns substantial business behavior:
  - course/program/course-run resource branching,
  - enrollment click behavior,
  - B2B contract inference,
  - title, certificate, upgrade banner, CTA, status indicator, start-date countdown, and context menu assembly.
- `ModuleCard.tsx` is a near-parallel card implementation with differences in button labels, certificate text, layout, and enrollment handler props.
- `OrganizationCards.tsx` imports only `DashboardCardRoot` from `DashboardCard.tsx`, so card deletion would need to decouple this styled dependency.

### Corrections to earlier plans

- Do not make `[0]` of a sorted enrollment list the durable card contract. It is acceptable as a temporary adapter detail, but the canonical slot model must name the derived display value explicitly.
- Do not change default-run selection policy to `status bucket > start_date` until product accepts the behavior. The current `selectBestEnrollment` policy may be imperfect, but replacing it is a product-visible change for multi-run users.
- Do not ship button-label convergence, CTA run annotations, course-level certificate aggregation changes, or "Completed badge + Continue CTA" behavior as part of this structural cleanup.
- Do not commit to deleting `DashboardCard.tsx` and `ModuleCard.tsx` on a fixed schedule. Delete them only after the new data model is in place, behavior parity is verified, and B2B/program-collection rendering has migrated safely.
- Do not force `My Learning` into the slot model. Home currently renders one card per enrollment, which already exposes multiple enrollments. Program and contract dashboards are the places that need slot + enrollments modeling.

## Goals

- Reduce dashboard complexity without waiting for final multi-run UX.
- Move data fetching, joining, grouping, and language/run resolution out of render-heavy components.
- Preserve visible behavior exactly during the first phases, except for explicitly called-out bug fixes or explicitly product-approved changes.
- Make program and contract dashboard course slots carry all relevant enrollments.
- Make the selected/displayed enrollment a derived presentation choice, not the canonical data shape.
- Keep current dashboard distinctions:
  - home is enrollment-driven,
  - program dashboard is requirement-slot-driven,
  - contract dashboard is contract/program/collection-slot-driven.
- Centralize language/run policy so future multi-run UI is additive rather than another rewrite.

## Non-goals

- Choosing the final multi-run UX.
- Adding a multi-run dropdown, dialog, inline list, or expanded-run UI.
- Changing dashboard visuals or button copy.
- Changing default-run behavior unless required for a bug fix and explicitly called out.
- Backend API changes.
- Removing all V2/V3 compatibility immediately.
- Full B2C/B2B card convergence in the first implementation phase.
- Do not force full structural B2C/B2B card unification in the first implementation phase before the new data model is stable. Visual and copy convergence are in scope where they are already approved or clearly corrective.

## Target model

### Home dashboard model

`My Learning` should remain enrollment-flat.

```ts
type HomeDashboardData = {
  isLoading: boolean
  upgradeError: string | null
  enrollments: {
    started: CourseRunEnrollmentV3[]
    notStarted: CourseRunEnrollmentV3[]
    completed: CourseRunEnrollmentV3[]
    expired: CourseRunEnrollmentV3[]
  }
  programEnrollments: V3UserProgramEnrollment[]
  programAsCourseData: ProgramAsCourseViewModel[]
}
```

:<!-- Github supports: NOTE, TIP, IMPORTANT, WARNING, CAUTION -->

> [!NOTE]
> The exact shape can change during implementation, but home should not collapse multiple enrollments into one course slot.

### Program and contract course slot model

Program and contract dashboards should use a slot model.

```ts
type DashboardCourseSlot = {
  course: CourseWithCourseRunsSerializerV2
  enrollments: CourseRunEnrollmentV3[]
  selectedLanguageKey: string
  availableLanguages: SimpleSelectOption[]
  displayedEnrollment: CourseRunEnrollmentV3 | null
  displayedRun: CourseRunV2 | null
  contractId?: number
  isContractPageResource?: boolean
  ancestorContext?: {
    programEnrollment?: V3UserProgramEnrollment
    parentProgramReadableIds?: string[]
    useVerifiedEnrollment?: boolean
  }
}
```

Rules:

- `enrollments` is the source of truth.
- `displayedEnrollment` and `displayedRun` are derived compatibility/display values.
- The initial derivation should preserve existing behavior. If this seems impossible or unreasonable/undesirable, raise attention.
- `displayedRun` is V2-shaped only because legacy `DashboardCard` requires `selectedCourseRun`. It is produced by the existing V3→V2 synthesis (Case 1 of `getResolvedRunForSelectedLanguage`).
- When legacy cards are replaced (Phase 8), enrolled cards consume V3 enrollment data from `enrollments[]` directly and Case 1 of the synthesis can be deleted.
- Cases 2 and 3 of `getResolvedRunForSelectedLanguage` remain. Case 2 is a trivial passthrough (the selected language has a real `CourseRunV2` in `course.courseruns`). Case 3 (pre-enrollment, no real `CourseRunV2` for the selected language) is a load-bearing workaround for an API gap: mitxonline does not surface per-language run metadata pre-enrollment. Case 3 is removable only if/when that API gap closes.

### Open question: are display fields permanent on the slot?

`displayedEnrollment` and `displayedRun` are not strictly necessary on the slot — the legacy adapter could compute them inline from `enrollments` + `selectedLanguageKey`. They are on the slot for convenience: the hook is computing them anyway (Phase 2's composite resolver), caching the result keeps the adapter as pure shape-conversion, and slot construction becomes unit-testable in isolation ("given course X, enrollments [A, B], lang Y → slot.displayedEnrollment = A").
Whether these fields survive past Phase 7 hinges on multi-run UX direction:

- **Parent-owned selection** (parent picks which enrollment to display, card receives `displayedEnrollment` as a controlled prop) → fields stay on the slot, expressing the parent's chosen display.
- **Card-owned selection** (card has internal state for enrollment selection) → fields are deleted with the legacy adapter; slot becomes purer (`course`, `enrollments`, `selectedLanguageKey`, `availableLanguages`, contract/ancestor).
  Recommendation: parent-owned (consistency with `selectedLanguageKey`, no prop-to-state sync, URL-deep-linkable). But this is not blocking Phases 1–6; decide when multi-run UX lands.

## Proposed file structure

Add focused files under the existing dashboard area. The end state consolidates pure-model code into a single file (`model/dashboardViewModel.ts`); the existing `helpers.ts` and `languageOptions.ts` are progressively absorbed and deleted by Phase 7.

```text
frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/
  hooks/
    useHomeDashboardData.ts
    useProgramDashboardData.ts
    useContractDashboardData.ts
  model/
    dashboardViewModel.ts
    dashboardAdapters.ts
```

Responsibilities:

- `hooks/useHomeDashboardData.ts`: owns home queries, home enrollment sorting, home program-as-course data assembly, and loading aggregation.
- `hooks/useProgramDashboardData.ts`: owns program detail query, course/enrollment/program enrollment joins, requirement-section construction, language options, slot assembly, and program-as-course slot context.
- `hooks/useContractDashboardData.ts`: owns contract-scoped courses/programs/collections, contract enrollment filtering, program filtering, collection shaping, language options, slot assembly, and loading aggregation.
- `model/dashboardViewModel.ts`: the **single pure-model home**. Owns the canonical types (`DashboardCourseSlot`, section shapes, home buckets), grouping helpers, slot constructors, requirement-section builders, language-option computation, the composite slot/language resolver introduced in Phase 2, the renamed display-policy helper, and Cases 2 + 3 of `getResolvedRunForSelectedLanguage`. By Phase 7's end, every pure helper that survives the cleanup lives here.
- `model/dashboardAdapters.ts`: temporary adapters from the new view model to current `DashboardCard` / `ProgramAsCourseCard` props. Deletion candidate at Phase 7 — its lifespan ends when `CoursewareCard` consumes the slot directly.

**Layer roles (illustrative, not prescriptive — boundaries may shift at phase exits):**

| File                            | Layer                      | Knows React? | Knows queries? | Long-term?                              |
| ------------------------------- | -------------------------- | ------------ | -------------- | --------------------------------------- |
| `hooks/useXxxDashboardData.ts`  | Composer (data + actions)  | Yes          | Yes            | Yes                                     |
| `model/dashboardViewModel.ts`   | Pure model — single home   | No           | No             | Yes — load-bearing                      |
| `model/dashboardAdapters.ts`    | Pure model (legacy bridge) | No           | No             | No — deleted in Phase 7                 |
| `helpers.ts` (existing)         | Pure model                 | No           | No             | No — absorbed into viewModel by Phase 7 |
| `languageOptions.ts` (existing) | Pure model                 | No           | No             | No — absorbed into viewModel by Phase 7 |

The `EnrollmentStatus` enum currently in `helpers.ts` is consumed by `EnrollmentStatusIndicator.tsx` and `ProgressBadge.tsx`. After consolidation it is exported from `dashboardViewModel.ts`; no separate "shared types" file is needed.

Do not move card rendering into these files. Hooks and model helpers should return render-ready data, but cards remain responsible for presentation.

## Phase 1: Extract pure model and adapter helpers (complete)

**Purpose:** Introduce the slot vocabulary and behavior-preserving adapters without changing rendered output.

**Files:**

- Create: `frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/model/dashboardViewModel.ts`
- Create: `frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/model/dashboardAdapters.ts`
- Modify: `frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/helpers.ts`
- Test: `frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/helpers.test.tsx`
- Test: new tests for `dashboardViewModel.ts` and `dashboardAdapters.ts`

- [ ] Add a `DashboardCourseSlot` type carrying `course`, `enrollments`, `selectedLanguageKey`, `displayedEnrollment`, `displayedRun`, and optional contract/ancestor context.
- [ ] Add grouping helpers for course-run enrollments by course id and program enrollments by program id.
- [ ] Add a clearly named display-policy helper, such as `pickDisplayedEnrollmentForLegacyDashboard`, that initially preserves the existing `selectBestEnrollment` behavior.
- [ ] Add adapter helpers that convert a `DashboardCourseSlot` into the existing legacy props:
  - `resource`,
  - `selectedCourseRun`,
  - `buttonHref`,
  - `contractId`,
  - `programEnrollment`.
- [ ] Add tests proving that the adapter produces the same resource choice for:
  - no enrollment,
  - one enrollment,
  - multiple enrollments where one has a certificate,
  - multiple enrollments where one has the highest grade,
  - selected-language enrollment,
  - contract-scoped selected-language enrollment.
- [ ] Do not delete `selectBestEnrollment` in this phase.
- [ ] Do not change card labels, CTA behavior, certificate link behavior, or default displayed enrollment policy.
- [ ] Run:

```bash
yarn test frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/helpers.test.tsx
```

Expected: all tests pass.

## Phase 2: Collapse language/run resolution to a single composite call

**Purpose:** Replace the 4-call orchestration that every callsite repeats with a single composite slot-resolution function. The win is measured at callsites, not in file structure: today both `EnrollmentDisplay.tsx` and `ContractContent.tsx` call `getEnrollmentForSelectedLanguage`, `getSelectedLanguageOption`, `getCourseRunForSelectedLanguage`, and `getResolvedRunForSelectedLanguage` together every time they render a card. After Phase 2, callsites make one call and receive `{ displayedEnrollment, displayedRun, selectedLanguageOption }`.

This phase also folds in a small, isolated bug fix: enrolled-but-not-enrollable languages currently disappear from the language picker (see [Language-union bug fix](#language-union-bug-fix) below).

**Hypothesised approach** (verify before executing):

- [ ] Add a composite function — working name `resolveSlotForLanguage(course, enrollments, selectedLanguageKey, { contractId })` — that returns `{ displayedEnrollment, displayedRun, selectedLanguageOption }`. Internally it calls today's primitives in the same order they are called at every callsite, so behavior is preserved by construction. **Place it in `model/dashboardViewModel.ts`** (Phase 1's pure-model home), not in `languageOptions.ts`.
- [ ] Add a composite function for the language picker — working name `getDashboardLanguageOptions(course, enrollments)` — that returns the union of enrollable V2 `course.language_options` and languages from the user's V3 `enrollment.run.language`. Also placed in `dashboardViewModel.ts`.
- [ ] Update callsites in `EnrollmentDisplay.tsx` and `ContractContent.tsx` to use the composites. The 4-call dance disappears at the callsite; render code stops knowing the orchestration exists.
- [ ] Begin migrating helpers from `languageOptions.ts` into `dashboardViewModel.ts` opportunistically (anything the composites depend on internally can move). Full deletion of `languageOptions.ts` is committed to Phase 7; this phase need only consolidate what it touches.
- [ ] Do not introduce a multi-run selector.
- [ ] Do not change the displayed-enrollment / displayed-run policy except where the language-union fix requires it.

**Tests to add:**

- enrolled language no longer enrollable still appears in the picker (the bug fix above);
- selected-language enrollment is preferred over next/best run;
- different-language enrollment is not displayed when a language with no matching enrollment is selected;
- contract scoping does not select an enrollment from another contract;
- fallback run synthesis still works for unenrolled selected-language cases (Case 3 of `getResolvedRunForSelectedLanguage`).

**Run:**

```bash
yarn test frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/languageOptions.test.ts
yarn test frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/EnrollmentDisplay.test.tsx
yarn test frontends/main/src/app-pages/DashboardPage/ContractContent.test.tsx
```

Expected: all tests pass; callsite line-counts in the two render components measurably drop.

### Language-union bug fix

**Symptom:** When a user is enrolled in a course in language X and the course's V2 `language_options` later stops listing X as enrollable, the dashboard language picker drops X — so the user cannot select their own enrolled language and cannot see their enrollment.

**Cause:** Today the picker is computed from `course.language_options` only. That field reflects what's currently enrollable, not what the user is already in.

**Fix:** Compute picker options as the union of:

- enrollable V2 `course.language_options`, and
- the language of every existing V3 enrollment for that course slot (`enrollment.run.language`).

**Why this is in scope despite "preserve visible behavior exactly":** the existing behavior is a defect — the user loses access to their own enrollment. The fix is small, isolated, has a dedicated test, and is the only intentional behavior change in the structural cleanup phases.

## Phase 3: Extract `useHomeDashboardData`

**Purpose:** Make the home dashboard easier to reason about without changing its enrollment-flat behavior.

**Files:**

- Create: `frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/hooks/useHomeDashboardData.ts`
- Modify: `frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/EnrollmentDisplay.tsx`
- Test: `frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/EnrollmentDisplay.test.tsx`

- [ ] Move home-only queries out of `AllEnrollmentsDisplay`:
  - course-run enrollments,
  - program enrollments,
  - program details needed for deduping,
  - contracts needed for non-contract program filtering,
  - program-as-course module data if currently assembled inline.
- [ ] Move `sortEnrollments` and `dedupeEnrollments` behind the hook or pure model helpers.
- [ ] Return home data in the existing buckets:
  - `started`,
  - `notStarted`,
  - `completed`,
  - `expired`.
- [ ] Keep one card per enrollment on home.
- [ ] Keep existing show/hide/expand behavior.
- [ ] Keep existing `onUpgradeError` behavior.
- [ ] Update `AllEnrollmentsDisplay` to consume the hook and render as before.
- [ ] Add or update tests proving:
  - multiple enrollments for the same course still render as multiple home cards,
  - B2B contract enrollments are excluded from home buckets as before,
  - program-course enrollments are deduped as before,
  - empty sections remain hidden as before.
- [ ] Run:

```bash
yarn test frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/EnrollmentDisplay.test.tsx
```

Expected: all tests pass.

**Phase exit check: thin composer.** Per the Working agreement's success criterion, this phase delivers cleanup only if `useHomeDashboardData.ts` is a _composer_, not a re-home of inline orchestration. Concrete checks at exit:

- Hook body line count: target ~80 lines or less, mostly fetch + compose + return. If significantly larger, the hook is implementing logic that belongs in `model/dashboardViewModel.ts`.
- Inline transforms in the hook body: target zero. Anything that loops, filters, sorts, joins, groups, or branches on data shape is a named helper imported from the model layer with its own unit test.
- Helper test coverage: every transform helper has an isolated unit test, separate from the hook's integration test.
- Consuming callsite shrinkage: `EnrollmentDisplay.tsx`'s home path measurably drops in size because the orchestration moved.

If any of these fails, the phase has relocated complexity rather than reduced it. Stop and split before declaring done.

## Phase 4: Extract `useProgramDashboardData`

**Purpose:** Move program-dashboard query orchestration, requirement-tree shaping, language policy, and slot construction out of `ProgramEnrollmentDisplay`.

**Files:**

- Create: `frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/hooks/useProgramDashboardData.ts`
- Modify: `frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/EnrollmentDisplay.tsx`
- Modify: `frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/ProgramAsCourseCard.tsx` only if needed for adapter boundaries
- Test: `frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/EnrollmentDisplay.test.tsx`
- Test: `frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/ProgramAsCourseCard.test.tsx`

- [ ] Move program detail query and course queries into the hook.
- [ ] Move `requirementSections` construction into the hook.
- [ ] Move enrollment grouping into the hook.
- [ ] Move program enrollment lookup into the hook.
- [ ] Move available-language computation into the hook via `dashboardLanguagePolicy.ts`.
- [ ] Build course requirement items as `DashboardCourseSlot` objects.
- [ ] Preserve current selected-language state ownership in the component unless the hook needs it as an input.
- [ ] Return render-ready sections containing:
  - section title,
  - section node,
  - section completion counts,
  - items for course slots,
  - items for program-as-course slots,
  - items for nested program enrollments.
- [ ] Use `dashboardAdapters.ts` to keep rendering through `DashboardCard` in this phase.
- [ ] Keep `ProgramAsCourseCard` rendering through `ModuleCard` in this phase unless a minimal adapter is required.
- [ ] Add or update tests proving:
  - requirement sections preserve ordering from `req_tree`,
  - section completion counts remain correct,
  - selected language changes displayed run/enrollment exactly as before,
  - no matching selected-language enrollment renders the course/unenrolled state rather than a wrong-language enrollment,
  - program-as-course sections still render module rows.
- [ ] Run:

```bash
yarn test frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/EnrollmentDisplay.test.tsx
yarn test frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/ProgramAsCourseCard.test.tsx
```

Expected: all tests pass.

**Phase exit check: thin composer.** Per the Working agreement's success criterion, this phase delivers cleanup only if `useProgramDashboardData.ts` is a _composer_, not a re-home of inline orchestration. Concrete checks at exit:

- Hook body line count: target ~80 lines or less, mostly fetch + compose + return. Requirement-section construction, enrollment grouping, language-option computation, and slot construction are named helpers in `model/dashboardViewModel.ts` (or `dashboardLanguagePolicy.ts`), not inline code.
- Inline transforms in the hook body: target zero. Anything that loops, filters, sorts, joins, groups, or branches on data shape is a named helper.
- Helper test coverage: `buildRequirementSections`, slot constructors, and grouping helpers each have isolated unit tests.
- Consuming callsite shrinkage: `EnrollmentDisplay.tsx`'s program path measurably drops in size.

If any of these fails, the phase has relocated complexity rather than reduced it. Stop and split before declaring done.

## Phase 5: Extract `useContractDashboardData`

**Purpose:** Move contract-scoped orchestration out of `ContractContent.tsx` while preserving B2B behavior.

**Files:**

- Create: `frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/hooks/useContractDashboardData.ts`
- Modify: `frontends/main/src/app-pages/DashboardPage/ContractContent.tsx`
- Test: `frontends/main/src/app-pages/DashboardPage/ContractContent.test.tsx`

- [ ] Move these queries into the hook:
  - course-run enrollments,
  - program enrollments,
  - programs list scoped by `org_id` and `contract_id`,
  - program collections,
  - contract courses list.
- [ ] Move `programHasContractRuns` into the hook.
- [ ] Move `programsInCollections` and `sortedPrograms` computation into the hook.
- [ ] Move program collection filtering into the hook.
- [ ] Move `OrgProgramDisplay` course-slot data shaping into the hook or a pure helper consumed by the hook.
- [ ] Move `OrgProgramCollectionDisplay` first-course-per-program data shaping into the hook or a dedicated helper.
- [ ] Preserve contract-scoped enrollment filtering using `b2b_contract_id`.
- [ ] Preserve contract-scoped run filtering using `contract_id` query params and `contractId` run resolution.
- [ ] Preserve current language picker behavior and selected-language state.
- [ ] Use `dashboardAdapters.ts` to keep rendering through `DashboardCard` in this phase.
- [ ] Add or update tests proving:
  - only contract programs are rendered,
  - programs inside collections are not duplicated as standalone programs,
  - collections render only when at least one program has valid contract runs,
  - selected-language enrollment is preferred over contract next/best run,
  - contract A does not display contract B enrollment,
  - welcome/header/skeleton behavior is unchanged.
- [ ] Run:

```bash
yarn test frontends/main/src/app-pages/DashboardPage/ContractContent.test.tsx
```

Expected: all tests pass.

**Phase exit check: thin composer.** Per the Working agreement's success criterion, this phase delivers cleanup only if `useContractDashboardData.ts` is a _composer_, not a re-home of inline orchestration. Concrete checks at exit:

- Hook body line count: target ~80 lines or less, mostly fetch + compose + return. Contract-scoped filtering (`programHasContractRuns`, `programsInCollections`, `sortedPrograms`), collection shaping, and slot construction are named helpers in `model/dashboardViewModel.ts`, not inline code.
- Inline transforms in the hook body: target zero. Anything that loops, filters, sorts, joins, groups, or branches on data shape is a named helper.
- Helper test coverage: each contract-scoping helper has an isolated unit test that does not require mounting the full dashboard.
- Consuming callsite shrinkage: `ContractContent.tsx` measurably drops in size — this is the most-watched signal because contract orchestration is currently the largest single tangle.
- B2B-specific concern: shared helpers between `useProgramDashboardData` and `useContractDashboardData` are explicitly identified. If the same logic is being inlined twice instead of factored once, fix it before declaring done.

If any of these fails, the phase has relocated complexity rather than reduced it. Stop and split before declaring done.

## Phase 6: Shrink render components

**Purpose:** Make `EnrollmentDisplay.tsx` and `ContractContent.tsx` mostly presentational after their data composers exist.

**Files:**

- Modify: `frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/EnrollmentDisplay.tsx`
- Modify: `frontends/main/src/app-pages/DashboardPage/ContractContent.tsx`
- Modify: `frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/ProgramAsCourseCard.tsx` if module-slot inputs are now available
- Test: existing dashboard tests touched above

- [ ] Remove now-duplicated inline query and grouping code from `EnrollmentDisplay.tsx`.
- [ ] Remove now-duplicated inline query and grouping code from `ContractContent.tsx`.
- [ ] Keep UI state that is truly UI-only in components:
  - selected language key,
  - expand/collapse state,
  - local upgrade error state,
  - welcome message expansion state.
- [ ] Keep rendering through existing cards.
- [ ] Verify imports no longer include language-resolution helpers directly in render components unless temporarily necessary.
- [ ] Verify render components do not call `selectBestEnrollment` or `selectBestContractEnrollmentForLanguage` directly.
- [ ] Run:

```bash
yarn test frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/EnrollmentDisplay.test.tsx
yarn test frontends/main/src/app-pages/DashboardPage/ContractContent.test.tsx
yarn test frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/ProgramAsCourseCard.test.tsx
```

Expected: all tests pass.

## Phase 7: Unify cards via `CoursewareCard` and delete the legacy cards

**Purpose:** Replace `DashboardCard.tsx` and `ModuleCard.tsx` — two parallel implementations that have drifted — with a single `CoursewareCard` component that dispatches to explicit variant cases. The deliverable includes deletion of the legacy files; this phase is **not** complete until the duplication is gone.

This is a structural unification, not a redesign. Each variant must reproduce today's rendering exactly. Visible copy, button width, certificate link text, CTA target selection, upgrade banner behavior, context menu items — all preserved. Behavior changes (multi-run UI, button-label convergence, course-level certificate aggregation, "Completed badge + Continue" CTA) remain out of scope and would be follow-up PRs against `CoursewareCard` after this phase ships.

**Why now and not earlier:** Phases 1–6 give every callsite a stable slot-shaped input. Without that, a unified card would have had to absorb the V2/V3 reconciliation that the slot model now owns. With it, `CoursewareCard`'s job shrinks to "render this slot in this variant."

**Hypothesised approach** (verify before executing):

- [ ] Create `frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/CoursewareCard.tsx`. Props use a discriminated union over a `variant` field. Suggested variants — confirm by walking the existing render sites:
  - `courseEnrollment` — user is enrolled (today: `DashboardCard` with a `CourseRunEnrollmentV3`-derived run).
  - `unenrolledCourse` — user not yet enrolled (today: `DashboardCard` with a V2 course run / product).
  - `program` — program enrollment row (today: `DashboardCard` with `program` resource type).
  - `moduleRow` — compact program-as-course row (today: `ModuleCard`).
  - `contractCourse` — only if contract-specific behavior cannot be expressed via existing variant inputs (`contractId`, `useVerifiedEnrollment`); prefer to fold this into `courseEnrollment` / `unenrolledCourse` rather than add a variant.
- [ ] For each variant, write a test that asserts byte-for-byte rendering parity with the corresponding case in today's `DashboardCard.test.tsx` / `ModuleCard.test.tsx`. Port — don't rewrite — these tests against `CoursewareCard`.
- [ ] Migrate callsites in this order, with the prior step verified before moving on:
  1. Home dashboard (`AllEnrollmentsDisplay`) — lowest risk; one card per enrollment, V3 data.
  2. Program-as-course rows (`ProgramAsCourseCard`) — replaces `ModuleCard` usage; localized to one component.
  3. Program dashboard (`ProgramEnrollmentDisplay`) — slot-driven by Phase 4's hook.
  4. Contract dashboard (`ContractContent.tsx`) — highest risk; B2B paths.
- [ ] Once every callsite uses `CoursewareCard`, delete:
  - `DashboardCard.tsx`
  - `DashboardCard.test.tsx`
  - `ModuleCard.tsx`
  - `ModuleCard.test.tsx`
- [ ] Resolve `DashboardCardRoot` import in `OrganizationCards.tsx` — either inline a styled div, re-export the styled root from `CoursewareCard`, or move the styled root into a small shared file. The choice depends on whether `OrganizationCards` still belongs in this restructuring.
- [ ] Port `DashboardDialogs.test.tsx` if it still references the legacy cards; keep the test if it covers behavior that survives, delete it if it covers only the old wrapper.
- [ ] Migrate any remaining helpers from `helpers.ts` and `languageOptions.ts` into `model/dashboardViewModel.ts`. The `EnrollmentStatus` enum (consumed by `EnrollmentStatusIndicator.tsx` and `ProgressBadge.tsx`) is re-exported from viewModel; presentational consumers update their imports.
- [ ] Delete now-orphaned files and helpers:
  - `helpers.ts` and its test file — fully absorbed into viewModel by this point.
  - `languageOptions.ts` and its test file — fully absorbed into viewModel by this point.
  - `selectBestEnrollment` (replaced by Phase 1's display-policy helper, now in viewModel).
  - `selectBestContractEnrollmentForLanguage` (replaced by Phase 2's composite resolver).
  - Case 1 of `getResolvedRunForSelectedLanguage` (V3-to-V2 enrolled-run synthesis). Cases 2 and 3 remain in viewModel — Case 3 is a permanent workaround for missing per-language unenrolled run metadata in the V2 API.
  - The `dashboardAdapters.ts` adapter introduced in Phase 1, if `CoursewareCard` consumes the slot directly. If the adapter is still load-bearing for any variant, narrow it rather than deleting it.
- [ ] Check the LoC delta. Expected order of magnitude: net negative on the order of ~1500–2000 lines once both legacy cards and their tests are deleted. If the delta is much smaller, investigate before declaring the phase done — the duplication may not have actually been removed.

**Migration safety:**

- This phase can be split across multiple PRs along the callsite-migration boundary. PR 7a builds `CoursewareCard` and migrates home + program-as-course. PR 7b migrates program dashboard. PR 7c migrates contract dashboard. PR 7d does the deletion. Each is independently revertible.
- If a variant turns out to need behavior that's genuinely different from "render today's card with the slot's data" — escalate to product before encoding it. That's the signal that an apparent unification is actually a redesign.

**Run:**

```bash
yarn test frontends/main/src/app-pages/DashboardPage/
yarn workspace frontends run typecheck
```

Expected: all tests pass; type checking clean; `DashboardCard.tsx` and `ModuleCard.tsx` no longer exist; line count meaningfully drops.

## Explicitly deferred product decisions

Do not answer these in this refactor:

- how users discover alternate enrolled runs,
- whether alternate runs appear inline, in a dropdown, in a dialog, or in expanded mode,
- how to label alternate runs,
- whether language selection and run selection are one control or two controls,
- whether status/certificate display is course-level or displayed-run-level,
- whether CTA should be annotated with a run reference,
- whether the default visible run should prefer active work, certificate completion, newest run, or some other policy,
- whether program and contract dashboards should expose identical multi-run affordances.

## Validation plan

Run targeted tests after each phase. Before merging the final phase in a PR series, run:

```bash
yarn test frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/EnrollmentDisplay.test.tsx
yarn test frontends/main/src/app-pages/DashboardPage/ContractContent.test.tsx
yarn test frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/ProgramAsCourseCard.test.tsx
yarn test frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/languageOptions.test.ts
yarn test frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/helpers.test.tsx
```

For Phase 7 (and any earlier phase that touches the legacy cards), also run:

```bash
yarn test frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/DashboardCard.test.tsx   # until deleted in Phase 7
yarn test frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/ModuleCard.test.tsx      # until deleted in Phase 7
yarn test frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/CoursewareCard.test.tsx  # added in Phase 7
yarn test frontends/main/src/app-pages/DashboardPage/CoursewareDisplay/DashboardDialogs.test.tsx
```

Run type checking before final review:

```bash
yarn workspace frontends run typecheck
```

## Implementation notes

- Keep all changes in frontend files; OpenAPI regeneration is not expected.
- Use `setMockResponse` and factories from `api/test-utils` / `api/mitxonline-test-utils` in tests.
- Prefer role/text queries through `renderWithProviders`.
- Keep `import React from "react"` in frontend tests where existing tests use it.
- Use root-relative `@/` imports within `frontends/main`.
- Avoid broad behavior changes in the same PR as structural extraction.
- If a phase requires an intentional user-visible change, split that into its own PR with tests and product acknowledgement.

## Recommended PR sequence

1. Pure model and adapter helpers.
2. Composite slot/language resolver + language-union bug fix.
3. Home data hook extraction.
4. Program dashboard data hook extraction.
5. Contract dashboard data hook extraction.
6. Render component simplification.
7. `CoursewareCard` unification + legacy card deletion (may split into 7a–7d along callsite-migration boundaries).

After Phase 6 the data architecture is sound; after Phase 7 the duplication is gone. Phase 7 is committed scope, not optional. Behavior changes that depend on multi-run UX direction (button-label convergence, multi-run affordances, course-level certificate aggregation) remain explicitly deferred to follow-up PRs against `CoursewareCard`.

## File structure: before vs. after

Diff-style listing of the dashboard-area files this plan touches. Page-level files outside scope (`DashboardLayout.tsx`, `HomeContent.tsx`, `ProgramContent.tsx`, `SettingsContent.tsx`, `ProfileContent.tsx`, `UserListDetailsContent.tsx`, `OrganizationRedirect.tsx`, `EnrollmentRedirectAlert.tsx`) are unchanged and omitted.

Markers: `+` new, `-` deleted, `~` modified, blank = unchanged.

Test files (`*.test.tsx`, `*.test.ts`) are omitted for brevity. Each non-test source file has a corresponding test that is added/modified/deleted alongside it.

```text
  frontends/main/src/app-pages/DashboardPage/
~   ContractContent.tsx                                shrinks (Phase 5–6)

    CoursewareDisplay/
-     DashboardCard.tsx                                deleted (Phase 7)
-     ModuleCard.tsx                                   deleted (Phase 7)
+     CoursewareCard.tsx                               new (Phase 7) — unified router
~     EnrollmentDisplay.tsx                            shrinks substantially (Phase 3, 4, 6)
~     ProgramAsCourseCard.tsx                          uses CoursewareCard moduleRow (Phase 7)
~     OrganizationCards.tsx                            decouples DashboardCardRoot (Phase 7)
~     DashboardDialogs.tsx                             may shift if dialog wiring moves (Phase 7)
      EnrollmentStatusIndicator.tsx                    unchanged (consumed by CoursewareCard)
      ProgressBadge.tsx                                unchanged
      receiptMenuItem.ts                               unchanged
~     test-utils.ts                                    likely gains slot/variant helpers
-     helpers.ts                                       deleted (Phase 7) — absorbed into viewModel
-     languageOptions.ts                               deleted (Phase 7) — absorbed into viewModel
                                                         — Cases 2, 3 of getResolvedRunForSelectedLanguage migrate
                                                         — Case 1 (V3→V2 synthesis) deleted
                                                         — selectBestContractEnrollmentForLanguage deleted

+     model/                                           new directory (Phase 1, grows through Phase 7)
+       dashboardViewModel.ts                          single pure-model home: types, grouping helpers,
                                                         slot constructors, requirement-section builders,
                                                         composite resolver (Phase 2), display policy,
                                                         absorbed contents of helpers.ts + languageOptions.ts (Phase 7)
+       dashboardAdapters.ts                           temp adapter — may be deleted in Phase 7

+     hooks/                                           new directory (Phase 3–5)
+       useHomeDashboardData.ts                        Phase 3
+       useProgramDashboardData.ts                     Phase 4
+       useContractDashboardData.ts                    Phase 5
```

**Reading notes:**

- The `language/` directory is bracketed by Phase 2's exit decision — it's only created if the existing primitives become internal. Otherwise the composite is added to `languageOptions.ts` and no new file appears.
- `model/dashboardAdapters.ts` shows up as new in Phase 1 but is a deletion candidate in Phase 7 — its lifespan depends on whether `CoursewareCard` consumes the slot directly without translation.
- Net file-count effect: roughly +6 to +9 added, –4 deleted; the surviving render-heavy components (`EnrollmentDisplay.tsx`, `ContractContent.tsx`) shrink substantially.
- The biggest LoC win is the deletion of `DashboardCard.tsx` (~1099 lines) and `ModuleCard.tsx` (~933 lines). New files are smaller and single-purpose.
