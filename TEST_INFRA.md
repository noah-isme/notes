# E2E Test Infra: SvelteKit 2 + Svelte 5 Notes UX Polish

## Test Philosophy
- Opaque-box, requirement-driven testing validating all UX features from user perspective.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Interaction + Real-World Workloads.
- No direct internal function mocking for E2E flows; test via DOM interactions, keyboard events, and visual states.

## Feature Inventory
| # | Feature | Source | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Workload) |
|---|---------|--------|:----------------:|:-----------------:|:-----------------:|:-----------------:|
| 1 | F1.1 Editor Prose Wrapping | R1 | 5 | 5 | ✓ | ✓ |
| 2 | F1.2 Code Block Horizontal Scrolling | R1 | 5 | 5 | ✓ | ✓ |
| 3 | F1.3 Monospace Typography | R1 | 5 | 5 | ✓ | ✓ |
| 4 | F1.4 Reactive Dirty State Indicator | R1 | 5 | 5 | ✓ | ✓ |
| 5 | F1.5 Unsaved Changes Navigation Guard | R1 | 5 | 5 | ✓ | ✓ |
| 6 | F2.1 Segmented View Mode Controls | R2 | 5 | 5 | ✓ | ✓ |
| 7 | F2.2 Editor Focus / Fullscreen Mode | R2 | 5 | 5 | ✓ | ✓ |
| 8 | F2.3 Soft-Delete with Undo Toast | R2 | 5 | 5 | ✓ | ✓ |
| 9 | F3.1 Note Card Hitboxes & Elevation | R3 | 5 | 5 | ✓ | ✓ |
| 10 | F3.2 Card Actions Overflow Protection | R3 | 5 | 5 | ✓ | ✓ |
| 11 | F3.3 Tag Filters & Input Polish | R3 | 5 | 5 | ✓ | ✓ |
| 12 | F3.4 Illustrated Empty States | R3 | 5 | 5 | ✓ | ✓ |
| 13 | F4.1 Global Keyboard Shortcuts & Tooltips | R4 | 5 | 5 | ✓ | ✓ |
| 14 | F4.2 Subtle Diagram Hover Toolbar | R4 | 5 | 5 | ✓ | ✓ |
| 15 | F4.3 Navigation vs Document State Decoupling | R4 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Test Runner**: Vitest unit/component suite (`pnpm test:unit` or `pnpm test`) + Playwright/Vitest browser integration.
- **Test Directory**: `tests/unit/ux-refinement.test.ts` and `tests/e2e/ux-refinement.e2e.test.ts`.
- **Pass/Fail Criteria**: Zero assertion failures, exit code 0, 100% pass across all test cases.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Long Technical Note with Fenced Code & Diagram Editing | F1.1, F1.2, F1.3, F2.1, F4.2 | High |
| 2 | Rapid Unsaved Drafting & Protected Note Navigation | F1.4, F1.5, F4.1, F4.3 | High |
| 3 | Distraction-Free Focus Writing & Keyboard Navigation | F2.2, F4.1, F2.1 | Medium |
| 4 | Accidental Note Deletion & Instant Restoration via Toast | F2.3, F3.1, F3.4 | Medium |
| 5 | Tag Organizing, Search Filtering & Empty States Discovery | F3.3, F3.4, F4.1, F4.3 | High |

## Coverage Thresholds
- Tier 1 (Feature Coverage): ≥5 tests per feature (≥75 test cases)
- Tier 2 (Boundary & Corner Cases): ≥5 tests per feature (≥75 test cases)
- Tier 3 (Cross-Feature Pairwise): ≥15 interaction test cases
- Tier 4 (Real-World Scenarios): ≥5 complete application workflows
- **Total Suite Target**: ~170+ dedicated UX test assertions
