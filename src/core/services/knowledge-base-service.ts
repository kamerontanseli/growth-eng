import { lines } from "../utils.js";
import { LintService } from "./lint-service.js";

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
  "# Free-form map of custom fields, e.g.",
  "#   custom_field: 123",
  "custom: {}",
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
  "<Screenshot/design, if any: ../../images/<experiment>/control.png>",
  "",
  "## Variants",
  "| Variant | Description |",
  "|---|---|",
  "<Screenshots/designs, if any: ../../images/<experiment>/<variant>.png>",
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
      "1. If .growth-eng/_template_.md and .growth-eng/lint-rules.json both exist, the knowledge base is already initialized. Report that and stop. Never overwrite either file.",
      "2. If .growth-eng/_template_.md does not exist: create the directory .growth-eng/, create the directories .growth-eng/images/, .growth-eng/ideas/rejected/, and .growth-eng/specs/ (with an empty .gitkeep file inside each so git tracks them), and create .growth-eng/_template_.md with exactly the content below, written verbatim.",
      "3. If .growth-eng/lint-rules.json does not exist: create it with exactly the content below, written verbatim.",
      "4. Do not add .growth-eng/ to .gitignore. The knowledge base is durable and should be committed to the repository.",
      "",
      "How the knowledge base is used:",
      "- Every experiment is created from a copy of _template_.md, stored at .growth-eng/specs/<feature>/<experiment>.md",
      "- Draft experiment ideas live in .growth-eng/ideas/<experiment>.md, and rejected ideas are moved to .growth-eng/ideas/rejected/<experiment>.md",
      "- Screenshots and designs live in .growth-eng/images/<experiment>/ (for example control.png and variant-a.png), named after the experiment doc",
      "- lint_experiments lints every experiment against the rules in .growth-eng/lint-rules.json, so edit that file to set up your own rules",
      "",
      "Write .growth-eng/_template_.md with this content, verbatim (skip this step if the file already exists):",
      "",
      "```markdown",
      EXPERIMENT_TEMPLATE,
      "```",
      "",
      "Write .growth-eng/lint-rules.json with this content, verbatim (skip this step if the file already exists):",
      "",
      "```json",
      LintService.getDefaultRules(),
      "```",
    );
  }
}
