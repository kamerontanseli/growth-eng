import { FastMCP } from "fastmcp";
import { z } from "zod";
import * as services from "./services/index.js";
import { lines } from "./utils.js";

/** A date written as YYYY-MM-DD, e.g. 2026-01-05. */
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a date in YYYY-MM-DD format");

/** A free-form map of custom fields with scalar values. */
const customFieldsSchema = z.record(
  z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/, "Keys may only use letters, numbers, underscores, and dashes"),
  z.union([z.string(), z.number(), z.boolean()]),
);

/** True when at least one patchable field is present. */
function hasPatchField(args: Record<string, unknown>): boolean {
  return [
    "title",
    "feature_flag_key",
    "start_date",
    "end_date",
    "status",
    "conclusion",
    "winning_variant",
    "custom",
  ].some((key) => args[key] !== undefined);
}

/**
 * Register all tools with the MCP server
 *
 * @param server The FastMCP server instance
 */
export function registerTools(server: FastMCP) {
  // Feature folders
  server.addTool({
    name: "create_feature_folder",
    description:
      "Create a feature folder at .growth-eng/<name> to hold that " +
      "feature's experiments. Requires the .growth-eng/ knowledge base to " +
      "be initialized (run the 'init' prompt first).",
    parameters: z.object({
      name: z
        .string()
        .describe(
          "Feature folder name, e.g. 'onboarding'. Normalized to " +
            "lowercase letters, numbers, and dashes.",
        ),
    }),
    execute: async ({ name }) => services.FeatureFolderService.create(name),
  });

  // Experiments
  server.addTool({
    name: "create_experiment",
    description: lines(
      "Create an experiment document by copying .growth-eng/_template_.md into a feature folder, filling in the frontmatter from the arguments, and returning the file path for you to fill out the markdown content.",
      "The filename comes from the feature_flag_key; if it collides with an existing experiment, pass start_date to create a dated variant (<feature_flag_key>-MM-DD-YYYY.md).",
      "Requires the knowledge base to be initialized ('init' prompt) and the feature folder to exist (create_feature_folder).",
    ),
    parameters: z.object({
      feature: z.string().describe("Feature folder to create the experiment in (must exist)"),
      title: z.string().describe("Human-readable experiment title, e.g. 'Simplify signup form'"),
      feature_flag_key: z
        .string()
        .describe("Feature flag key. Also the base filename of the experiment doc"),
      start_date: dateSchema
        .optional()
        .describe(
          "Experiment start date, YYYY-MM-DD. Also disambiguates a " + "duplicate feature_flag_key",
        ),
      end_date: dateSchema.optional().describe("Experiment end date, YYYY-MM-DD"),
      status: z
        .enum(services.EXPERIMENT_STATUSES)
        .optional()
        .describe("Experiment status (default: draft)"),
      conclusion: z
        .enum(services.EXPERIMENT_CONCLUSIONS)
        .optional()
        .describe("Experiment outcome (default: empty)"),
      winning_variant: z
        .string()
        .optional()
        .describe("Winning variant, e.g. 'control' or 'treatment' (default: empty)"),
      custom: customFieldsSchema
        .optional()
        .describe('Free-form map of custom fields, e.g. { "team": "growth" } (default: {})'),
    }),
    execute: async (params) => services.ExperimentService.create(params),
  });

  server.addTool({
    name: "update_experiment",
    description:
      "Update the frontmatter of an experiment document. Only the fields " +
      "you pass are changed; the markdown content is left untouched and the " +
      "file is never renamed.",
    parameters: z
      .object({
        feature: z.string().describe("Feature folder the experiment lives in"),
        name: z.string().describe("Experiment filename, with or without the .md extension"),
        title: z.string().optional().describe("New title"),
        feature_flag_key: z.string().optional().describe("New feature flag key"),
        start_date: dateSchema.optional().describe("New start date, YYYY-MM-DD"),
        end_date: dateSchema.optional().describe("New end date, YYYY-MM-DD"),
        status: z.enum(services.EXPERIMENT_STATUSES).optional().describe("New status"),
        conclusion: z.enum(services.EXPERIMENT_CONCLUSIONS).optional().describe("New conclusion"),
        winning_variant: z.string().optional().describe("New winning variant"),
        custom: customFieldsSchema
          .optional()
          .describe("New custom fields (replaces the whole custom block)"),
      })
      .refine(hasPatchField, {
        message: lines(
          "Provide at least one field to update:",
          "title, feature_flag_key, start_date, end_date, status, conclusion, winning_variant, or custom.",
        ),
      }),
    execute: async (params) => {
      const { feature, name, ...patch } = params;
      return services.ExperimentService.update(feature, name, patch);
    },
  });

  // Linting
  server.addTool({
    name: "lint_experiments",
    description: lines(
      "Return the lint rules from .growth-eng/lint-rules.json together with the prompt to lint the knowledge base:",
      "read every experiment at .growth-eng/**/*.md, judge each rule per experiment, and score each one",
      "Experiment Quality % = (rules followed / total rules) * 100.",
      "Requires the knowledge base to be initialized ('init' prompt).",
    ),
    parameters: z.object({}),
    execute: async () => services.LintService.lint(),
  });
}
