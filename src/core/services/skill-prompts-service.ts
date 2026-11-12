import { lines } from "../utils.js";

/** Arguments accepted by the generate-experiment-idea prompt. */
export interface GenerateExperimentIdeaPromptArgs {
  size?: string;
  focus_area?: string;
  details?: string;
}

/** Arguments accepted by the plan-experiment prompt. */
export interface PlanExperimentPromptArgs {
  idea_slug?: string;
}

/**
 * Service providing the MCP prompts that mirror the repository's Agent Skills
 * (`generate-experiment-idea`, `plan-experiment`, and `hypothesis-tree`), so
 * users can fetch and run them directly from the MCP server without installing
 * the skills separately.
 */
export class SkillPromptsService {
  /**
   * Generate instructions for `/generate-experiment-idea`.
   */
  public static generateExperimentIdeaPrompt(args: GenerateExperimentIdeaPromptArgs = {}): string {
    const contextLines: string[] = [];
    if (args.size) {
      contextLines.push(`- Requested test size: ${args.size} (xs | s | m | l | xl)`);
    }
    if (args.focus_area) {
      contextLines.push(`- Focus area: ${args.focus_area}`);
    }
    if (args.details) {
      contextLines.push(`- User provided details: ${args.details}`);
    }

    return lines(
      "Generate a new growth experiment idea. Follow these steps:",
      ...(contextLines.length > 0 ? ["", "Context:", ...contextLines] : []),
      "",
      "1. Read all experiments in .growth-eng/ (including .growth-eng/specs/**/*.md, .growth-eng/ideas/*.md, and .growth-eng/ideas/rejected/*.md) to understand what has worked, what hasn't worked, and what has already been drafted or rejected.",
      "2. Reason from first principles, performing research, understanding causal mechanics, and applying systems thinking to arrive at an experiment idea that will improve the target flow or metric, scoped to the requested test size (xs, s, m, l, or xl).",
      "3. Build HTML or ASCII mockups of the proposed control and treatment changes and present them to the user alongside the hypothesis, causal mechanism, and target metrics.",
      "4. Call the create_idea tool to stage the draft idea at .growth-eng/ideas/<experiment-slug>.md (reusing .growth-eng/_template_.md) and fill out the template sections.",
      "5. If the user rejects the idea, call the reject_idea tool to move it from .growth-eng/ideas/<experiment-slug>.md to .growth-eng/ideas/rejected/<experiment-slug>.md.",
    );
  }

  /**
   * Generate instructions for `/plan-experiment`.
   */
  public static generatePlanExperimentPrompt(args: PlanExperimentPromptArgs = {}): string {
    const ideaNote = args.idea_slug
      ? `Start from the staged draft idea at .growth-eng/ideas/${args.idea_slug.replace(/\.md$/, "")}.md and only ask questions for missing details.`
      : "If called after /generate-experiment-idea or if a matching draft exists in .growth-eng/ideas/<experiment-slug>.md, reuse the details in that file and only ask questions for missing details.";

    return lines(
      "Plan a new growth experiment specification. Follow these steps:",
      "",
      `1. ${ideaNote}`,
      "2. Read .growth-eng/_template_.md and .growth-eng/lint-rules.json to see every frontmatter field, section, and quality rule the experiment spec requires.",
      "3. Ask the user using your harness's ask_question tool (e.g. ask_question / AskUserQuestion / ask_user) for any details needed to fill out _template_.md (and only for missing details when promoting an existing draft from .growth-eng/ideas/<experiment-slug>.md).",
      "4. Ensure the feature folder exists at .growth-eng/specs/<feature>/ (call create_feature_folder if needed), then call the create_experiment tool to create .growth-eng/specs/<feature>/<experiment>.md.",
      "5. Fill out the markdown content of .growth-eng/specs/<feature>/<experiment>.md with the final details (Hypothesis, Research, Control, Variants, Sample size / MDE plan, Metrics, Results, Conclusion).",
    );
  }

  /**
   * Generate instructions for `/hypothesis-tree`.
   */
  public static generateHypothesisTreePrompt(): string {
    return lines(
      "Build a hypothesis tree for the .growth-eng/ knowledge base. Follow these steps:",
      "",
      "1. Scan the entirety of .growth-eng/ (all experiment specs in .growth-eng/specs/**/*.md, draft ideas in .growth-eng/ideas/*.md, and rejected ideas in .growth-eng/ideas/rejected/*.md, excluding .growth-eng/_template_.md).",
      "2. Map how experiments and hypotheses lead from one to another across features, iterations, and follow-up tests.",
      "3. Create a hypothesis tree HTML artifact / diagram so the user can see how experiments lead from one to another:",
      "   - Highlight winning hypotheses (conclusion: 'won') in green (#16a34a / #dcfce7).",
      "   - Highlight losing hypotheses (conclusion: 'loss') in red (#dc2626 / #fee2e2).",
      "   - Highlight inconclusive hypotheses (conclusion: 'inconclusive', 'stopped_early', 'invalid', or draft/running) in grey (#6b7280 / #f3f4f6).",
    );
  }
}
