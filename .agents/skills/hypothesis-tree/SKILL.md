---
name: hypothesis-tree
description: Scan the entirety of .growth-eng/ and create a hypothesis tree HTML artifact and diagram showing how experiments lead from one to another, highlighting winning hypotheses in green, losing ones in red, and inconclusive ones in grey.
---

# Hypothesis Tree

Usage: `/hypothesis-tree`

Scan all experiments and ideas in `.growth-eng/` and produce a visual hypothesis tree (HTML artifact / diagram) showing how hypotheses and learnings evolve from one experiment to another.

## Workflow

1. **Scan the entirety of `.growth-eng/`**:
   - Read every experiment spec in `.growth-eng/specs/**/*.md`, every draft idea in `.growth-eng/ideas/*.md`, and every rejected idea in `.growth-eng/ideas/rejected/*.md` (excluding `.growth-eng/_template_.md`).
   - Extract each document's frontmatter (`title`, `feature_flag_key`, `start_date`, `end_date`, `status`, `conclusion`, `winning_variant`, `custom`) and body sections (`Hypothesis`, `Research`, `Metrics`, `Results`, `Conclusion`).

2. **Map the lineage of hypotheses**:
   - Group experiments by feature area (`.growth-eng/specs/<feature>/`) or primary goal metric.
   - Determine how experiments connect to one another:
     - Explicit references in `## Research` or `## Conclusion` to prior experiments or learnings
     - Re-runs and iterations sharing a feature flag key (`<flag>.md` -> `<flag>-MM-DD-YYYY.md`)
     - Chronological progression (`start_date` / `end_date`) within a feature folder, plus downstream draft ideas in `.growth-eng/ideas/` and rejected ideas in `.growth-eng/ideas/rejected/`.

3. **Color-code nodes by outcome**:
   - **Winning hypotheses (`conclusion: "won"`)**: Highlight in **green** (e.g., background `#dcfce7`, border `#16a34a`, text `#14532d`).
   - **Losing hypotheses (`conclusion: "loss"`)**: Highlight in **red** (e.g., background `#fee2e2`, border `#dc2626`, text `#7f1d1d`).
   - **Inconclusive / other hypotheses (`conclusion: "inconclusive"`, `"stopped_early"`, `"invalid"`, or `status: "draft"` / `"running"` / un-concluded)**: Highlight in **grey** (e.g., background `#f3f4f6`, border `#6b7280`, text `#1f2937`).

4. **Generate the Hypothesis Tree HTML artifact and diagram**:
   - Build a self-contained, interactive HTML file (e.g. saved at `.growth-eng/images/hypothesis-tree.html` and/or presented as an HTML artifact) and include a diagram in the response so the user can immediately inspect how experiments lead from one to another.
   - Each node in the tree should display:
     - Experiment title and feature folder / `feature_flag_key`
     - Status, dates, and outcome badge (`won` in green, `loss` in red, `inconclusive` / `draft` / `running` in grey)
     - The core `Hypothesis` statement ("We believe ... will ... because ...")
     - Primary metric, observed delta / confidence (if ended), and key takeaway linking to child hypotheses.
