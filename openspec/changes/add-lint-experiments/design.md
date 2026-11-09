# Design

## Context

See `proposal.md` for motivation. The server already runs the exact pattern this change copies: a canonical content constant lives in a service (`EXPERIMENT_TEMPLATE` in `src/core/services/knowledge-base-service.ts`), a getter exposes it, the init prompt embeds it verbatim in a fenced block, the agent writes it to `.growth-eng/_template_.md`, and nothing overwrites it afterward. Preconditions use the `requireKnowledgeBase()` / `requireTemplatePath()` helpers in `src/core/services/kb-utils.ts`, whose errors tell the agent the next step. Tools are thin registrations in `src/core/tools.ts` over service classes that return plain strings. Four test suites cover the surface: direct tool tests (`tools.test.ts`), the init prompt e2e (`init-prompt.test.ts`), tool-selection tests (`agent.test.ts`), and routing evals (`evals.test.ts`).

## Goals / Non-Goals

**Goals:**

- `lint_experiments` returns the repository's own rules plus one canonical scoring prompt, so any calling LLM scores the same way.
- Customized rules flow through: the tool reads `.growth-eng/lint-rules.json`, not the bundled defaults.
- Repos initialized before this change gain the rules file without any risk to their existing template.

**Non-Goals:**

- Persisting lint results (report files, frontmatter fields) — lint output lives in the conversation.
- Severity-weighted scoring — every rule counts equally, per the agreed formula.
- The tool reading or judging experiment docs itself — the agent reads `.growth-eng/**/*.md` with its own file tools; the tool only supplies rules and prompt.

## Decisions

1. **The tool reads the local rules file.** If `lint_experiments` returned the bundled defaults, the documented customization path (editing the file) would change nothing. Alternatives: always return defaults (rejected — customization would be dead on arrival); fall back to defaults when the file is missing (rejected — hides the file's authority and can silently diverge from what init wrote).
2. **Defaults are stored as a raw string constant.** Init must write the file byte-for-byte, and the attached ruleset includes blank lines between rule groups that `JSON.stringify` would normalize away. A template-literal constant beside the existing template pattern keeps the bytes stable and gives tests a verbatim oracle via `LintService.getDefaultRules()`. Alternative: a typed object serialized deterministically (rejected — rewrites formatting for no behavior gain).
3. **Missing file errors point at init.** A new `requireLintRulesPath()` in `kb-utils.ts` mirrors `requireTemplatePath()`: the error tells the agent to run the `init` prompt. Decision 4 makes that instruction actionable for existing repos. Alternative: silent fallback (rejected under decision 1).
4. **Init's already-initialized check becomes per-file.** Step 1 today stops when `_template_.md` exists alone; with two canonical files, "initialized" means both exist. The init prompt instructs: both exist → stop; one missing → create only the missing one; never overwrite either. Alternative: keep stop-on-template (rejected — every existing repo would need a hand-copied file to lint).
5. **Validation is light and per-rule.** The file is human/agent-edited, so the tool validates: top-level JSON object; each rule an object with a non-empty string `lint_rule` and a `severity` of `error` or `warning`; `bad_example` / `good_example` optional strings. Errors name the offending rule and the problem. Alternative: a zod schema on the tool (rejected — the file is not a tool argument, and actionable per-rule errors matter more than schema completeness).
6. **The tool result is plain text: summary + rules + prompt.** One `lines()` block matching every other service: a summary line (rule counts by severity), the rules JSON in a fenced block, then the scoring prompt. The prompt states the formula verbatim, the glob path, the `_template_.md` exclusion, per-experiment scores plus the overall average, broken-rule detail (id, severity, why), and the nothing-to-lint case. Severity appears in the breakdown but never weights the score.
7. **No parameters.** The tool lints the whole knowledge base; scoping to one feature can be added later without breaking callers.

## Risks / Trade-offs

- LLM judgment varies between runs → every rule ships a `bad_example`/`good_example` pair and the tool ships one canonical prompt, so the methodology stays fixed even when the judge varies.
- A user-edited file can break linting → validation errors name the rule and the fix; init restores the file only when missing, so edits are never clobbered.
- The tool result is large (~9KB for 24 rules) → acceptable: it is a single call and the calling LLM needs the full ruleset to judge; well within MCP result sizes.
- More eval cases lengthen `bun test` → the new routing case is one prompt per iteration; the direct tests carry the behavioral coverage.

## Migration Plan

Purely additive. No existing tool contract changes; the only behavior shift is init's step 1 becoming per-file, which is backward compatible (repos with both files see the same stop message). Existing repos re-run `init` to gain the rules file. Rollback is removing the tool registration and reverting the init text; a `lint-rules.json` left in a repo is inert.

## Open Questions

None — scoring granularity and workflow were settled during exploration.
