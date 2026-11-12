import { existsSync } from "node:fs";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { lines } from "../utils.js";
import {
  applyFrontmatterPatch,
  requireKnowledgeBase,
  requireTemplatePath,
  slugifyOrThrow,
  type CustomFields,
  type ExperimentPatch,
} from "./kb-utils.js";

/** Statuses an experiment document can be in. */
export const EXPERIMENT_STATUSES = ["draft", "running", "ended"] as const;
type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number];

/** Outcomes a concluded experiment document can record. */
export const EXPERIMENT_CONCLUSIONS = [
  "won",
  "loss",
  "inconclusive",
  "stopped_early",
  "invalid",
] as const;
type ExperimentConclusion = (typeof EXPERIMENT_CONCLUSIONS)[number];

/** Arguments accepted by create. */
export interface CreateExperimentArgs {
  feature: string;
  title: string;
  feature_flag_key: string;
  start_date?: string;
  end_date?: string;
  status?: ExperimentStatus;
  conclusion?: ExperimentConclusion;
  winning_variant?: string;
  custom?: CustomFields;
}

/** A resolved experiment file location inside a feature folder. */
interface ExperimentLocation {
  featureSlug: string;
  featureDir: string;
  slug: string;
  path: string;
}

/**
 * Locate a feature folder, or fail with an error telling the agent to create
 * it first.
 */
function locateFeature(root: string, feature: string): { featureSlug: string; featureDir: string } {
  const featureSlug = slugifyOrThrow("Feature", feature);
  const featureDir = join(root, "specs", featureSlug);
  if (!existsSync(featureDir)) {
    throw new Error(
      `Feature folder '.growth-eng/specs/${featureSlug}' does not exist. ` +
        `Create it first with the create_feature_folder tool: ` +
        `{ "name": "${featureSlug}" }.`,
    );
  }
  return { featureSlug, featureDir };
}

/**
 * Locate an experiment file, or fail with an error listing what the feature
 * folder does contain.
 */
async function locateExperiment(
  root: string,
  feature: string,
  name: string,
): Promise<ExperimentLocation> {
  const { featureSlug, featureDir } = locateFeature(root, feature);
  const slug = slugifyOrThrow("Experiment name", name.replace(/\.md$/, ""));
  const path = join(featureDir, `${slug}.md`);
  if (!existsSync(path)) {
    const found = (await readdir(featureDir)).filter((file) => file.endsWith(".md")).sort();
    const foundNote =
      found.length > 0 ? `Found: ${found.join(", ")}.` : "The folder has no experiments yet.";
    throw new Error(
      `No experiment named "${slug}.md" in .growth-eng/specs/${featureSlug}. ` + foundNote,
    );
  }
  return { featureSlug, featureDir, slug, path };
}

/** Render a YYYY-MM-DD date as MM-DD-YYYY for dated experiment filenames. */
function filenameDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${month}-${day}-${year}`;
}

/**
 * A service for the experiment documents (`.growth-eng/specs/<feature>/<experiment>.md`)
 * created from the canonical template.
 */
export class ExperimentService {
  /**
   * Create an experiment: copy .growth-eng/_template_.md into the feature
   * folder with frontmatter filled from the arguments, and return the path
   * for the agent to fill out the markdown content.
   *
   * The filename is the feature flag key; a duplicate key is disambiguated
   * with the start date (<key>-MM-DD-YYYY.md).
   *
   * @param args The experiment fields
   * @returns A message naming the created file and what to do next
   */
  public static async create(args: CreateExperimentArgs): Promise<string> {
    const root = requireKnowledgeBase();
    const templatePath = requireTemplatePath();
    const { featureSlug, featureDir } = locateFeature(root, args.feature);

    const keySlug = slugifyOrThrow("Feature flag key", args.feature_flag_key);
    let filename = `${keySlug}.md`;
    if (existsSync(join(featureDir, filename))) {
      if (!args.start_date) {
        throw new Error(
          `An experiment with feature flag key "${args.feature_flag_key}" ` +
            `already exists in .growth-eng/specs/${featureSlug} (${filename}). ` +
            `Pass a start_date (YYYY-MM-DD) to create a dated variant ` +
            `(${keySlug}-MM-DD-YYYY.md), or use a different feature_flag_key.`,
        );
      }
      filename = `${keySlug}-${filenameDate(args.start_date)}.md`;
      if (existsSync(join(featureDir, filename))) {
        throw new Error(
          `An experiment with feature flag key "${args.feature_flag_key}" ` +
            `and start date ${args.start_date} already exists in ` +
            `.growth-eng/specs/${featureSlug} (${filename}). Use a different ` +
            `feature_flag_key or start_date.`,
        );
      }
    }

    const template = await readFile(templatePath, "utf8");
    const content = applyFrontmatterPatch(
      template,
      {
        title: args.title,
        feature_flag_key: args.feature_flag_key,
        start_date: args.start_date ?? "",
        end_date: args.end_date ?? "",
        status: args.status ?? "draft",
        conclusion: args.conclusion ?? "",
        winning_variant: args.winning_variant ?? "",
        custom: args.custom ?? {},
      },
      (body) => body.replace("# <title>", `# ${args.title}`),
    );
    await writeFile(join(featureDir, filename), content);

    return lines(
      `Created experiment: .growth-eng/specs/${featureSlug}/${filename}`,
      "The frontmatter is filled in from your arguments. Now fill out the " +
        "markdown content: Hypothesis, Research, Control, Variants, Sample " +
        "size / MDE plan, Metrics, Results, Conclusion.",
    );
  }

  /**
   * Patch an experiment document's frontmatter. Only the fields passed are
   * changed; the markdown body is left untouched and the file is never
   * renamed.
   *
   * @param feature The feature folder
   * @param name The experiment filename, with or without the .md extension
   * @param patch The frontmatter fields to write
   * @returns A message naming the updated file
   */
  public static async update(
    feature: string,
    name: string,
    patch: ExperimentPatch,
  ): Promise<string> {
    const root = requireKnowledgeBase();
    const location = await locateExperiment(root, feature, name);
    const content = await readFile(location.path, "utf8");
    const updated = applyFrontmatterPatch(content, patch);
    await writeFile(location.path, updated);
    return lines(
      `Updated experiment frontmatter: .growth-eng/specs/${location.featureSlug}/${location.slug}.md`,
      "The markdown content below the frontmatter was left untouched, and " +
        "the file was not renamed.",
    );
  }
}
