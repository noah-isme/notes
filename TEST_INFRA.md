# E2E Test Infra: Mermaid.js Interactive Diagram Rendering

## Test Philosophy
- Opaque-box, requirement-driven. Derived from ORIGINAL_REQUEST.md.
- Covers Markdown parsing, Mermaid engine async loading, all diagram types, live preview reactivity, debouncing, error boundaries, action controls, modal accessibility, and SSR compatibility.
- Methodology: Category-Partition + Boundary Value Analysis + Pairwise Combinations + Real-World Workload Testing.

## Feature Inventory & Test Matrix
| # | Feature | Source | Tier 1 (Coverage) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) | Tier 4 (Real-World) |
|---|---------|--------|:-----------------:|:-----------------:|:----------------------:|:-------------------:|
| 1 | Fenced ````mermaid` Parsing | R1 | 5 test cases | 5 test cases | ✓ | ✓ |
| 2 | Client-Side Async Loading (SSR Safe) | R1 | 5 test cases | 5 test cases | ✓ | ✓ |
| 3 | Core Diagram Types (8 types) | R1 | 8 test cases | 8 test cases | ✓ | ✓ |
| 4 | Theme & Styling Integration | R3 | 5 test cases | 5 test cases | ✓ | ✓ |
| 5 | Action Buttons (Copy Source & Copy SVG) | R3 | 5 test cases | 5 test cases | ✓ | ✓ |
| 6 | Fullscreen Zoom & Pan Modal | R3 | 5 test cases | 5 test cases | ✓ | ✓ |
| 7 | Resilient Error Boundary & Fallback | R2 | 5 test cases | 5 test cases | ✓ | ✓ |
| 8 | Live Preview & Debouncing | R2 | 5 test cases | 5 test cases | ✓ | ✓ |

## Test Architecture
- **Location**: `tests/unit/mermaid-e2e.test.ts` and `tests/unit/mermaid-adversarial.test.ts`
- **Runner**: Vitest (`pnpm test` / `pnpm test:unit`)
- **Pass/Fail Semantics**: 100% assertions must pass, exit code 0, no unhandled rejections or syntax errors.

## Coverage Goals
- **Tier 1 (Feature Coverage)**: ≥5 test cases per feature (Total ≥ 40 tests).
- **Tier 2 (Boundary & Corner Cases)**: Empty blocks, whitespace-only, malformed syntax, giant diagrams, unescaped HTML characters, missing closing fences (Total ≥ 40 tests).
- **Tier 3 (Cross-Feature Combinations)**: Multiple diagrams per note, mixed standard markdown code blocks + mermaid blocks, switching edit/preview modes, modal open + copy action (Total ≥ 12 tests).
- **Tier 4 (Real-World Application Scenarios)**: Microservice architecture flowchart, OAuth2 sequence diagram, database ER schema, Kanban Gantt timeline, system state machine, project mindmap (Total ≥ 6 scenarios).
- **Total Minimum Test Count**: ≥ 98 test cases.
