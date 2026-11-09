# Tasks

## 1. Lint tool

- [x] 1.1 Add `LINT_RULES_FILE` and `requireLintRulesPath()` to `src/core/services/kb-utils.ts`, mirroring `requireTemplatePath()` (missing file errors by telling the agent to run the `init` prompt); verify with `bun run lint`.
- [x] 1.2 Create `src/core/services/lint-service.ts` with `DEFAULT_LINT_RULES` (the 24-rule default ruleset, 19 error / 5 warning, stored verbatim as a string constant), `getDefaultRules()`, and `lint()` that reads `.growth-eng/lint-rules.json`, validates it (JSON object; each rule has a non-empty `lint_rule` string and a `severity` of `error` or `warning`; `bad_example`/`good_example` optional strings; errors name the offending rule), and returns the summary line, the rules in a fenced JSON block, and the scoring prompt (formula `Experiment Quality % = (rules followed / total rules) * 100` per experiment, overall average, glob `.growth-eng/**/*.md` excluding `_template_.md`, broken-rule detail, nothing-to-lint case); verify with `bun run build`.
- [x] 1.3 Export the lint service from `src/core/services/index.ts` and register the no-argument `lint_experiments` tool in `src/core/tools.ts` (description states it returns the rules from `.growth-eng/lint-rules.json` plus the scoring prompt, and requires the `init` prompt); verify with `bun run build`.
- [x] 1.4 Update `tests/tools.test.ts`: add `lint_experiments` to the tool-surface assertions, make `bootstrapKnowledgeBase` also write the default rules file, and add a `describe("lint_experiments")` covering rules + prompt returned from an initialized knowledge base, customized rules flowing through when the file is edited, missing knowledge base, missing rules file, malformed JSON, and invalid rule shape; verify with `bun test tests/tools.test.ts`.

## 2. Init prompt

- [x] 2.1 Rework `generateInitInstructions()` in `src/core/services/knowledge-base-service.ts`: the already-initialized check becomes per-file (both `_template_.md` and `lint-rules.json` exist → stop; otherwise create only the missing one, never overwrite either), a new step writes `lint-rules.json` verbatim from `LintService.getDefaultRules()`, and the usage notes mention that the rules are customizable; extend the init prompt contract test in `tests/tools.test.ts` to assert the default rules are embedded verbatim; verify with `bun test tests/tools.test.ts`.
- [x] 2.2 Extend `tests/init-prompt.test.ts`: the e2e test also asserts `.growth-eng/lint-rules.json` is written with the default content, and a new partial-init case runs the prompt against a sandbox holding only `_template_.md` and asserts the agent creates only the rules file; verify with `bun test tests/init-prompt.test.ts` (runs when `OPENROUTER_API_KEY` is set, skips otherwise).

## 3. Agent routing and evals

- [x] 3.1 Update `tests/agent.test.ts`: add `lint_experiments` to `TOOL_NAMES`, write the default rules file in the sandbox, and add a test that a "lint the experiments" request routes to `lint_experiments`; verify with `bun test tests/agent.test.ts`.
- [x] 3.2 Add a `lint-experiments-routing` case to `tests/evals.test.ts` and write the default rules file in its sandbox; verify the suite still clears its 90% aggregate accuracy gate with `bun test tests/evals.test.ts`.

## 4. Documentation

- [x] 4.1 Update `README.md`: add `lint-rules.json` to the `.growth-eng/` tree, add the `lint_experiments` row to the tools table (reframing the "tools cover the writes" sentence since this tool is a read), update the init paragraph to name both files and the never-overwrite rule, and add a "Linting experiments" section documenting what the tool returns, the score formula, the rule format, and how to set up your own rules with a short custom-rule example; verify every documented path and behavior matches the implementation by cross-checking against `src/core/tools.ts` and `src/core/services/lint-service.ts`.

## 5. Integration checks

- [x] 5.1 Run `bun run fmt`, `bun run lint`, `bun test` (LLM suites run when `OPENROUTER_API_KEY` is set and skip otherwise), and `bun run build`; verify all pass.
- [x] 5.2 Run `openspec validate add-lint-experiments`; verify the change validates with no errors.

## Workflow follow-up

- Implement these tasks with `/opsx-apply` (openspec apply), marking each checkbox as it lands.
- Archive the change with `/opsx-archive-change` once implementation is complete and review requirements are satisfied.
