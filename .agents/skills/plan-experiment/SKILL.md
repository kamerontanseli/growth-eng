---
name: plan-experiment
description: Plan a new experiment by asking the user for missing details using the harness's ask_question tool, calling create_experiment to create the spec under .growth-eng/specs/<feature>/<experiment>.md from _template_.md, and filling out the complete experiment document. Reuses .growth-eng/ideas/<experiment-slug>.md when called after /generate-experiment-idea.
---

# Plan Experiment

Usage: `/plan-experiment`

Plan and write a complete, lint-compliant experiment specification in `.growth-eng/specs/<feature>/<experiment>.md`.

## Workflow

1. **Check for a staged idea in `.growth-eng/ideas/`**:
   - Check whether `/plan-experiment` was called after `/generate-experiment-idea` or if a draft idea exists in `.growth-eng/ideas/<experiment-slug>.md` (excluding `.growth-eng/ideas/rejected/`).
   - Read `.growth-eng/_template_.md` and `.growth-eng/lint-rules.json` so you know every frontmatter field, markdown section, and quality rule required for a complete spec.

2. **Ask the user for missing details using the harness's `ask_question` tool**:
   - **If starting from `.growth-eng/ideas/<experiment-slug>.md`**:
     - Read `.growth-eng/ideas/<experiment-slug>.md` and extract all fields and sections already drafted (title, feature flag key, hypothesis, research, control, variants, sample size/MDE plan, metrics, guardrails).
     - Identify only the details that are still missing or incomplete (such as target `feature` folder, `start_date`, `end_date`, baseline conversion rate, daily eligible traffic, or specific numeric guardrail thresholds) and ask the user **only** for those missing details using your harness's question tool (`ask_question` / `AskUserQuestion` / `ask_user`).
   - **If planning a new experiment from scratch**:
     - Use your harness's question tool (`ask_question` / `AskUserQuestion` / `ask_user`) to gather the details needed to fill out `_template_.md` and satisfy `lint-rules.json`:
       - Target `feature` folder, `title`, `feature_flag_key`, `start_date`, and `end_date`
       - Falsifiable hypothesis (`We believe <change> will <effect on metric + direction> because <causal mechanism>`) and supporting evidence/research
       - Detailed descriptions of the Control experience and each Variant's exact changes
       - Single primary behavioral metric, guardrail metrics with numeric launch-blocking thresholds, audience exclusions, randomization unit and traffic split, sample size & MDE calculation (baseline rate, MDE, power, significance level, daily traffic feasibility over full weekly cycles), statistical test, pre-launch win/loss/inconclusive decision criteria, and rollback plan with owner.

3. **Create the feature folder (if needed) and call `create_experiment`**:
   - Ensure the target feature folder `.growth-eng/specs/<feature>/` exists; if it does not exist yet, call `create_feature_folder` with `{ "name": "<feature>" }`.
   - Call the `create_experiment` MCP tool with the frontmatter arguments (`feature`, `title`, `feature_flag_key`, `start_date`, `end_date`, `status`, `custom`, etc.) to create `.growth-eng/specs/<feature>/<experiment>.md` from `.growth-eng/_template_.md`.

4. **Fill out the experiment specification content**:
   - Write the full markdown body of `.growth-eng/specs/<feature>/<experiment>.md` with the final details covering:
     - `## Hypothesis`
     - `## Research`
     - `## Control`
     - `## Variants`
     - `## Sample size / MDE plan`
     - `## Metrics` (`### Goal`, `### Measurement`, `### Guardrails`)
     - `## Results`
     - `## Conclusion`
   - Run `lint_experiments` to verify the completed spec passes the rules in `.growth-eng/lint-rules.json`.
