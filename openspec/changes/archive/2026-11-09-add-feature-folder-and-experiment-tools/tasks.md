# Tasks

## 1. Service layer

- [x] 1.1 Create `src/core/services/kb-utils.ts` with shared helpers: `.growth-eng/` resolution with `requireKnowledgeBase()` / `requireTemplatePath()` guards, `slugifyOrThrow()`, and the line-based frontmatter splitter/patcher; verify with `bun run lint`.
- [x] 1.2 Create `src/core/services/feature-folder-service.ts` (`create` with normalization and duplicate refusal) and `src/core/services/experiment-service.ts` (`create` with dated-collision disambiguation, `update` patching frontmatter only); verify with `bun run build`.

## 2. Tool surface

- [x] 2.1 Register `create_feature_folder`, `create_experiment`, and `update_experiment` in `src/core/tools.ts` with precise zod schemas (date regex, status/conclusion enums, custom scalar map, at-least-one-field refine on update); verify `tools/list` shows exactly the three tools.
- [x] 2.2 Remove the demo surface: `hello_world` / `goodbye` tools, the `greeting` prompt, and the example resource with its `resources.ts` wiring; verify `prompts/list` shows only `init` and `resources/list` is empty.
- [x] 2.3 Fix the template's custom fields to a map (`custom: {}`) matching the create default; verify `bun test tests/tools.test.ts` frontmatter assertions pass.

## 3. Tests

- [x] 3.1 Add `startServerIn(cwd)` to `tests/harness.ts` so tool tests run against a temp sandbox; verify a tool call resolves paths inside the sandbox.
- [x] 3.2 Rewrite `tests/tools.test.ts` (no-LLM): tool/prompt/resource surface, folder create + duplicate refusal, create happy path asserting frontmatter values, defaults, preserved comments, and untouched body, every guard error, dated collision, invalid arguments, and the update round-trip; verify with `bun test tests/tools.test.ts`.
- [x] 3.3 Rewrite `tests/agent.test.ts` (LLM) and `tests/evals.test.ts` routing cases for the new tools, keeping the 90% aggregate accuracy gate; verify with `bun test` (LLM suites skip without `OPENROUTER_API_KEY`).

## 4. Documentation

- [x] 4.1 Update `README.md`: drop demo tool mentions, document the three tools, the reads-stay-with-the-agent philosophy, and the guard chain; verify the documented behavior matches `tools.ts` and the services.

## 5. Verification

- [x] 5.1 Run `bun test` (all suites), `bun run lint`, `bun run fmt:check`, and `bun run knip`; verify all pass.

## Workflow follow-up

- Archive this change once its record has been migrated and reviewed.
