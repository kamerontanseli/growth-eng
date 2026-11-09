# Proposal

## Why

Experiment docs in `.growth-eng/` are filled out free-form by whatever agent or human writes them, so quality drifts: hypotheses with no falsifiable prediction, guardrails with no thresholds, sample sizes picked by feel. Nothing in the loop tells the team an experiment doc is missing the parts that make its result trustworthy. A canonical, customizable ruleset plus a standard score makes experiment quality measurable and improvable the same way the template makes experiment structure consistent.

## What Changes

- New `lint_experiments` tool: returns the lint rules from `.growth-eng/lint-rules.json` together with a scoring prompt telling the calling LLM to read every experiment at `.growth-eng/**/*.md` (excluding `_template_.md`) and score each one as `Experiment Quality % = (rules followed / total rules) * 100`, plus an overall average across experiments.
- New default ruleset: the 24 rules (19 error, 5 warning) shipped in the server as the source of truth, stored next to the existing template constant pattern.
- `init` prompt updated to also create `.growth-eng/lint-rules.json` verbatim from the defaults. Its already-initialized check becomes per-file, so repos initialized before this change get the rules file without overwriting their existing `_template_.md`.
- Precondition errors follow the existing pattern: missing knowledge base or missing rules file tells the agent to run the `init` prompt; malformed JSON or an invalid rule shape tells the agent to fix the file.
- README documentation: the file in the `.growth-eng/` tree, a `lint_experiments` row in the tools table, and a new section on setting up your own linting rules.

## Capabilities

### New Capabilities

- `experiment-linting`: linting experiment docs against a customizable ruleset, covering the default rules the server ships, the `lint-rules.json` file the knowledge base holds, the `lint_experiments` tool that returns the rules with the scoring prompt, and the score the calling LLM produces.

### Modified Capabilities

<!-- None: the project has no existing specs, so there is nothing to modify. -->

## Impact

- `src/core/services/lint-service.ts` (new): default ruleset constant, validation, and the lint tool result.
- `src/core/services/kb-utils.ts`: `LINT_RULES_FILE` constant and `requireLintRulesPath()` precondition helper.
- `src/core/services/knowledge-base-service.ts`: init instructions gain the rules file and the per-file already-initialized check.
- `src/core/tools.ts` and `src/core/services/index.ts`: register and export the new tool.
- `README.md`: tree, tools table, and a new "Linting experiments" section.
- Tests: `tools.test.ts`, `init-prompt.test.ts`, `agent.test.ts`, `evals.test.ts` (tool surface, prompt contract, preconditions, e2e init, routing, evals).
- No dependency or breaking API changes; existing tools and prompts keep their behavior.
