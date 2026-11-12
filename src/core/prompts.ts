import { FastMCP } from "fastmcp";
import * as services from "./services/index.js";

/**
 * Register all prompts with the MCP server
 *
 * @param server The FastMCP server instance
 */
export function registerPrompts(server: FastMCP) {
  // Initialize the .growth-eng/ knowledge base
  server.addPrompt({
    name: "init",
    description: "Initialize the .growth-eng/ knowledge base the MCP operates out of",
    arguments: [],
    load: async () => {
      return services.KnowledgeBaseService.generateInitInstructions();
    },
  });

  // Generate an experiment idea (/generate-experiment-idea)
  server.addPrompt({
    name: "generate-experiment-idea",
    description:
      "Read past experiments in .growth-eng/, reason from first principles to propose an experiment idea, build HTML or ASCII mockups, stage the draft in .growth-eng/ideas/<experiment-slug>.md, and move rejected ideas to .growth-eng/ideas/rejected/",
    arguments: [
      {
        name: "size",
        description: "Size of test: xs, s, m, l, or xl",
        required: false,
        enum: ["xs", "s", "m", "l", "xl"],
      },
      {
        name: "focus_area",
        description: "Focus area or product flow to improve, e.g. 'onboarding'",
        required: false,
      },
      {
        name: "details",
        description: "User provided details, context, or target metrics",
        required: false,
      },
    ],
    load: async (args) => {
      return services.SkillPromptsService.generateExperimentIdeaPrompt(args);
    },
  });

  // Plan an experiment (/plan-experiment)
  server.addPrompt({
    name: "plan-experiment",
    description:
      "Plan a new experiment by asking the user for details with ask_question tools (reusing .growth-eng/ideas/<experiment-slug>.md when available), calling create_experiment, and filling out the experiment spec",
    arguments: [
      {
        name: "idea_slug",
        description:
          "Optional experiment slug from .growth-eng/ideas/<experiment-slug>.md to promote into a full experiment spec",
        required: false,
      },
    ],
    load: async (args) => {
      return services.SkillPromptsService.generatePlanExperimentPrompt(args);
    },
  });

  // Build a hypothesis tree (/hypothesis-tree)
  server.addPrompt({
    name: "hypothesis-tree",
    description:
      "Scan .growth-eng/ and create a hypothesis tree HTML/artifact/diagram highlighting winning hypotheses in green, losing ones in red, and inconclusive ones in grey",
    arguments: [],
    load: async () => {
      return services.SkillPromptsService.generateHypothesisTreePrompt();
    },
  });
}
