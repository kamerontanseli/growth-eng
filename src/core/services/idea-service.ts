import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { lines } from "../utils.js";
import { requireKnowledgeBase, requireTemplatePath, slugifyOrThrow } from "./kb-utils.js";

/**
 * A service for drafting and rejecting experiment ideas under
 * `.growth-eng/ideas/` and `.growth-eng/ideas/rejected/`.
 */
export class IdeaService {
  /**
   * Create a draft experiment idea at `.growth-eng/ideas/<experiment-slug>.md`
   * by copying `.growth-eng/_template_.md`, and return a prompt instructing
   * the calling LLM to fill out the idea template.
   *
   * @param slug The experiment idea slug, normalized to lowercase letters, numbers, and dashes
   * @returns A prompt naming the created file and instructing the LLM to fill out the template
   */
  public static async create(slug: string): Promise<string> {
    const ideaSlug = slugifyOrThrow("Idea slug", slug.replace(/\.md$/, ""));
    const root = requireKnowledgeBase();
    const templatePath = requireTemplatePath();
    const ideasDir = join(root, "ideas");
    const ideaPath = join(ideasDir, `${ideaSlug}.md`);

    if (existsSync(ideaPath)) {
      throw new Error(`Idea '.growth-eng/ideas/${ideaSlug}.md' already exists.`);
    }

    const template = await readFile(templatePath, "utf8");
    await mkdir(ideasDir, { recursive: true });
    await writeFile(ideaPath, template);

    return lines(
      `Created idea: .growth-eng/ideas/${ideaSlug}.md`,
      `Now fill out the idea template in .growth-eng/ideas/${ideaSlug}.md: ` +
        "populate the frontmatter (title, feature_flag_key, status: draft) and " +
        "fill out the markdown sections (Hypothesis, Research, Control, Variants, " +
        "Sample size / MDE plan, Metrics).",
    );
  }

  /**
   * Reject a draft experiment idea by moving it from
   * `.growth-eng/ideas/<experiment-slug>.md` to
   * `.growth-eng/ideas/rejected/<experiment-slug>.md`, and return a prompt
   * instructing the calling LLM that the idea has been rejected and moved.
   *
   * @param slug The experiment idea slug, with or without the .md extension
   * @returns A prompt confirming the idea was rejected and moved to the rejected folder
   */
  public static async reject(slug: string): Promise<string> {
    const ideaSlug = slugifyOrThrow("Idea slug", slug.replace(/\.md$/, ""));
    const root = requireKnowledgeBase();
    const ideasDir = join(root, "ideas");
    const sourcePath = join(ideasDir, `${ideaSlug}.md`);

    if (!existsSync(sourcePath)) {
      const found = existsSync(ideasDir)
        ? (await readdir(ideasDir)).filter((file) => file.endsWith(".md")).sort()
        : [];
      const foundNote =
        found.length > 0 ? `Found: ${found.join(", ")}.` : "The folder has no ideas yet.";
      throw new Error(`No idea named "${ideaSlug}.md" in .growth-eng/ideas. ` + foundNote);
    }

    const rejectedDir = join(ideasDir, "rejected");
    const destPath = join(rejectedDir, `${ideaSlug}.md`);
    if (existsSync(destPath)) {
      throw new Error(`Rejected idea '.growth-eng/ideas/rejected/${ideaSlug}.md' already exists.`);
    }

    await mkdir(rejectedDir, { recursive: true });
    await rename(sourcePath, destPath);

    return lines(
      `Rejected idea: moved .growth-eng/ideas/${ideaSlug}.md to .growth-eng/ideas/rejected/${ideaSlug}.md`,
      `The idea "${ideaSlug}" has been rejected and moved to .growth-eng/ideas/rejected/${ideaSlug}.md. ` +
        "Keep it there as part of the knowledge base's memory so future ideation does not repeat rejected ideas.",
    );
  }
}
