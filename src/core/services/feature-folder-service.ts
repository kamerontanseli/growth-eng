import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { lines } from "../utils.js";
import { requireKnowledgeBase, slugifyOrThrow } from "./kb-utils.js";

/**
 * A service for the feature folders (`.growth-eng/<feature>/`) that
 * experiments are filed under.
 */
export class FeatureFolderService {
  /**
   * Create a feature folder. The knowledge base must be initialized first;
   * an existing folder is never recreated.
   *
   * @param name The feature folder name, normalized to a lowercase slug
   * @returns A message naming the created folder
   */
  public static async create(name: string): Promise<string> {
    const slug = slugifyOrThrow("Feature folder name", name);
    const root = requireKnowledgeBase();
    const dir = join(root, slug);
    if (existsSync(dir)) {
      throw new Error(`Feature folder '.growth-eng/${slug}' already exists.`);
    }
    await mkdir(dir);
    return lines(
      `Created feature folder: .growth-eng/${slug}`,
      `Experiments for this feature live there as .growth-eng/${slug}/` +
        "<experiment>.md — create them with the create_experiment tool.",
    );
  }
}
