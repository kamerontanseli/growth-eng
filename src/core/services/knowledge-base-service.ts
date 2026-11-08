import { lines } from "../utils.js";

/**
 * The canonical experiment template, stored at .growth-eng/_template_.md
 * Every experiment is created from a copy of this file
 */
const EXPERIMENT_TEMPLATE = lines(
  "---",
  'title: ""',
  'feature_flag_key: ""',
  'start_date: ""',
  'end_date: ""',
  "status: draft              # draft | running | ended",
  'conclusion: ""             # won | loss | inconclusive | stopped_early | invalid',
  'winning_variant: ""        # e.g. control, treatment, ...',
  "# Free-form list of custom fields, e.g.",
  "#   - custom_field: 123",
  "custom: []",
  "---",
  "",
  "# <title>",
  "",
  "## Hypothesis",
  "We believe <change> will <effect> because <insight>.",
  "",
  "## Research",
  "<Evidence, prior data, user insights driving this experiment.>",
  "",
  "## Control",
  "<The existing experience all variants are measured against.>",
  "<Screenshot/design, if any: ../_images/<experiment>/control.png>",
  "",
  "## Variants",
  "| Variant | Description |",
  "|---|---|",
  "<Screenshots/designs, if any: ../_images/<experiment>/<variant>.png>",
  "",
  "## Sample size / MDE plan",
  "<Planned sample size, minimum detectable effect, power, alpha, runtime.>",
  "",
  "## Metrics",
  "### Goal",
  "<Primary metric this experiment must move.>",
  "",
  "### Measurement",
  "<How the metric is measured: instrumentation, attribution window.>",
  "",
  "### Guardrails",
  "<Metrics that must not degrade.>",
  "",
  "## Results",
  "| Variant | Metric | Value | Delta | Confidence |",
  "|---|---|---|---|---|",
  "",
  "## Conclusion",
  "<What we learned and what we do next.>",
);

/**
 * A service for the .growth-eng/ knowledge base the MCP operates out of
 */
export class KnowledgeBaseService {
  /**
   * The canonical experiment template (.growth-eng/_template_.md)
   * @returns The template content every experiment is created from, ending with a newline
   */
  public static getExperimentTemplate(): string {
    return EXPERIMENT_TEMPLATE + "\n";
  }

  /**
   * Generate the instructions for initializing the .growth-eng/ knowledge base
   * @returns The init prompt text handed to the agent
   */
  public static generateInitInstructions(): string {
    return lines(
      "Initialize the growth-eng knowledge base in this repository. Follow these steps exactly:",
      "",
      "1. If .growth-eng/_template_.md already exists, the knowledge base is already initialized. Report that and stop. Never overwrite it.",
      "2. Create the directory .growth-eng/",
      "3. Create the directory .growth-eng/_images/ with an empty .gitkeep file inside it. Git does not track empty directories. This folder stores screenshots and designs of the control and variant experiences.",
      "4. Create .growth-eng/_template_.md with exactly the content below, written verbatim.",
      "5. Do not add .growth-eng/ to .gitignore. The knowledge base is durable and should be committed to the repository.",
      "",
      "How the knowledge base is used:",
      "- Every experiment is created from a copy of _template_.md, stored at .growth-eng/<feature>/<experiment>.md",
      "- Screenshots and designs live in .growth-eng/_images/<experiment>/ (for example control.png and variant-a.png), named after the experiment doc",
      "",
      "Write .growth-eng/_template_.md with this content, verbatim:",
      "",
      "```markdown",
      EXPERIMENT_TEMPLATE,
      "```",
    );
  }
}
