---
name: generate-experiment-idea
description: Generate a growth experiment idea from first principles by reading past experiments in .growth-eng/, building HTML or ASCII mockups of control and treatment changes, staging the draft in .growth-eng/ideas/<experiment-slug>.md, and moving rejected ideas to .growth-eng/ideas/rejected/.
---

# Generate Experiment Idea

Usage: `/generate-experiment-idea <size of test=xs|s|m|l|xl> <focus area> <user provided details>`

Generate a rigorous, high-leverage growth experiment idea grounded in past experiment learnings, first-principles reasoning, causal mechanics, and systems thinking.

## Arguments

- **Size of test (`xs` | `s` | `m` | `l` | `xl`)**:
  - `xs`: Copy, headline, CTA label, or micro-copy tweak.
  - `s`: Single-component UI change, form field simplification, or inline nudge.
  - `m`: Multi-component flow change, step reordering, or new modal/checklist within an existing flow.
  - `l`: New multi-step flow variant, pricing/packaging restructuring, or stateful onboarding experience.
  - `xl`: End-to-end flow redesign or new viral/retention loop.
- **Focus area**: The feature, surface, funnel stage, or metric to target (e.g., `onboarding`, `checkout`, `activation`, `retention`).
- **User provided details**: Any specific constraints, observations, audience segments, or goals supplied by the user.

## Workflow

1. **Read the `.growth-eng/` knowledge base**:
   - Read all past and active experiment specs in `.growth-eng/specs/**/*.md` to understand what has worked (`conclusion: "won"`), what failed (`conclusion: "loss"`), and what was inconclusive (`conclusion: "inconclusive"`).
   - Read existing draft ideas in `.growth-eng/ideas/*.md` and rejected ideas in `.growth-eng/ideas/rejected/*.md` so you never propose a duplicate or previously rejected idea.
   - Read `.growth-eng/_template_.md` and `.growth-eng/lint-rules.json` to ensure the idea will satisfy the repository's experiment standards.

2. **Reason from first principles, causal mechanics, and systems thinking**:
   - Inspect the relevant product code and user flow for `<focus area>` and `<user provided details>`.
   - Deconstruct the user journey from first principles: what user motivation, friction, cognitive load, or information gap governs behavior at this step?
   - Trace the **causal mechanism**: explain *why* the proposed change will alter user behavior and move the primary behavioral metric.
   - Apply **systems thinking**: account for second-order effects, upstream/downstream cannibalization, interference across users or organizations, and guardrail metrics that must not degrade.
   - Scope the intervention to match the requested `<size of test>` (`xs`, `s`, `m`, `l`, or `xl`).

3. **Build HTML or ASCII mockups of Control and Treatment**:
   - Create clear **HTML** (e.g. saved under `.growth-eng/images/<experiment-slug>/` or rendered as an interactive preview) or **ASCII mockups** comparing the **Control** (the existing experience) and the **Treatment / Variant(s)** side-by-side.
   - Present the proposed experiment, causal reasoning, research basis, target metrics, and the Control vs. Treatment mockups to the user.

4. **Stage the draft idea in `.growth-eng/ideas/<experiment-slug>.md`**:
   - Call the `create_idea` MCP tool with `slug: "<experiment-slug>"` (or create `.growth-eng/ideas/<experiment-slug>.md` from `.growth-eng/_template_.md`).
   - Fill out the draft idea file in `.growth-eng/ideas/<experiment-slug>.md` with the frontmatter (`title`, `feature_flag_key`, `status: draft`) and markdown sections (`Hypothesis`, `Research`, `Control`, `Variants`, `Sample size / MDE plan`, `Metrics`).

5. **Review with the user and handle rejection**:
   - Ask the user whether they want to accept the idea, iterate on it, or reject it.
   - If the user **rejects** the idea, call the `reject_idea` MCP tool with `slug: "<experiment-slug>"` to move `.growth-eng/ideas/<experiment-slug>.md` to `.growth-eng/ideas/rejected/<experiment-slug>.md` so future ideation remembers why it was rejected.
   - If the user **accepts** the idea, let them know they can run `/plan-experiment` to promote `.growth-eng/ideas/<experiment-slug>.md` into a full experiment spec in `.growth-eng/specs/<feature>/<experiment>.md`.
