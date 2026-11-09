# Tasks

## 1. Knowledge base service

- [x] 1.1 Create `src/core/services/knowledge-base-service.ts` with the canonical `EXPERIMENT_TEMPLATE` constant, `getExperimentTemplate()`, and `generateInitInstructions()` (idempotent steps, `.gitkeep` for `_images/`, template embedded verbatim); verify with `bun run lint`.
- [x] 1.2 Export the service from `src/core/services/index.ts` and register the no-argument `init` prompt in `src/core/prompts.ts`; verify a stdio smoke test shows `init` in `prompts/list` and `prompts/get` returns the instructions with the template intact.

## 2. Documentation

- [x] 2.1 Add the knowledge-base section to `README.md` (layout, init prompt, canonical template); verify the documented template matches the server's constant.

## 3. Verification

- [x] 3.1 Run `bun run lint` and `bun run fmt:check`; verify both pass.
- [x] 3.2 Add the init prompt e2e test (`tests/init-prompt.test.ts`) driving an LLM agent in a sandbox to create `.growth-eng/` and write `_template_.md` verbatim, plus the no-LLM prompt contract tests; verify `bun test` passes (LLM suite skips without `OPENROUTER_API_KEY`).

## Workflow follow-up

- Archive this change once its record has been migrated and reviewed.
