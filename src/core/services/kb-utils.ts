import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Shared helpers for the services that operate on the .growth-eng/ knowledge
 * base: path resolution, name normalization, and frontmatter patching.
 */

/** Directory the knowledge base lives in, relative to the repository root. */
const GROWTH_ENG_DIR = ".growth-eng";

/** Name of the canonical experiment template file inside the knowledge base. */
const TEMPLATE_FILE = "_template_.md";

/** Values allowed in an experiment's custom fields. */
type CustomValue = string | number | boolean;

/** The free-form `custom:` mapping in experiment frontmatter. */
export type CustomFields = Record<string, CustomValue>;

/** Frontmatter fields of an experiment that can be written or patched. */
export interface ExperimentPatch {
  title?: string;
  feature_flag_key?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  conclusion?: string;
  winning_variant?: string;
  custom?: CustomFields;
}

/** The scalar frontmatter keys of an experiment, in template order. */
const SCALAR_KEYS = [
  "title",
  "feature_flag_key",
  "start_date",
  "end_date",
  "status",
  "conclusion",
  "winning_variant",
] as const;

/**
 * Root of the knowledge base in the repository the server operates on. The
 * server is spawned in the repository's root, so its working directory is the
 * repository.
 */
function knowledgeBaseRoot(): string {
  return join(process.cwd(), GROWTH_ENG_DIR);
}

/**
 * The knowledge base must already exist, or the error tells the agent to run
 * the 'init' prompt.
 *
 * @returns The absolute path of the .growth-eng/ directory
 */
export function requireKnowledgeBase(): string {
  const root = knowledgeBaseRoot();
  if (!existsSync(root)) {
    throw new Error(
      `The .growth-eng/ knowledge base is not initialized ` +
        `(no .growth-eng/ directory in ${process.cwd()}). ` +
        "Run the 'init' prompt first: it creates .growth-eng/ and " +
        ".growth-eng/_template_.md.",
    );
  }
  return root;
}

/**
 * The experiment template must already exist, or the error tells the agent to
 * run the 'init' prompt.
 *
 * @returns The absolute path of .growth-eng/_template_.md
 */
export function requireTemplatePath(): string {
  const template = join(knowledgeBaseRoot(), TEMPLATE_FILE);
  if (!existsSync(template)) {
    throw new Error(
      `.growth-eng/${TEMPLATE_FILE} not found. Run the 'init' prompt to ` +
        "create it (existing files are never overwritten).",
    );
  }
  return template;
}

/**
 * Normalize a name into a slug: lowercase, runs of anything that is not a
 * letter or digit collapse into a single dash, no leading/trailing dashes.
 * This also neutralizes path segments ("../x" becomes "x"), so a name can
 * never point outside the knowledge base.
 *
 * @param label What the name is used for, in error messages
 * @param name The raw name
 * @returns The normalized slug
 */
export function slugifyOrThrow(label: string, name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) {
    throw new Error(
      `${label} "${name}" cannot be turned into a valid name: after ` +
        "normalization (lowercase letters, numbers, dashes) it is empty. " +
        "Use a name like 'onboarding'.",
    );
  }
  return slug;
}

/** Encode a string as a YAML double-quoted scalar. */
function yamlString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Encode one custom field value as a YAML scalar. */
function yamlScalar(value: CustomValue): string {
  return typeof value === "string" ? yamlString(value) : String(value);
}

/** The lines making up the `custom:` block for the given fields. */
function customBlockLines(custom: CustomFields): string[] {
  const entries = Object.entries(custom);
  if (entries.length === 0) {
    return ["custom: {}"];
  }
  return ["custom:", ...entries.map(([key, value]) => `  ${key}: ${yamlScalar(value)}`)];
}

/** A markdown document split into its frontmatter lines and its body. */
interface FrontmatterSplit {
  lines: string[];
  body: string;
}

/**
 * Split a markdown document into its '---' delimited frontmatter and body.
 *
 * @param content The document
 * @returns The split, or null when the document opens with no frontmatter
 */
function splitFrontmatter(content: string): FrontmatterSplit | null {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") {
    return null;
  }
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end === -1) {
    return null;
  }
  return { lines: lines.slice(1, end), body: lines.slice(end + 1).join("\n") };
}

/** Reassemble a document from frontmatter lines and a body. */
function joinFrontmatter(lines: string[], body: string): string {
  return `---\n${lines.join("\n")}\n---\n${body}`;
}

/**
 * Find where a frontmatter line's trailing comment starts: a '#' preceded by
 * a space, outside any double-quoted scalar. Returns the index of that space,
 * or -1 when the line carries no comment.
 */
function commentStart(rest: string): number {
  let inQuotes = false;
  for (let i = 0; i < rest.length; i++) {
    const char = rest[i];
    if (inQuotes && char === "\\") {
      i++;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && char === "#" && i > 0 && rest[i - 1] === " ") {
      return i - 1;
    }
  }
  return -1;
}

/** Replace a scalar key's value in a frontmatter line, keeping any comment. */
function patchScalarLine(line: string, key: string, value: string): string {
  const prefix = `${key}:`;
  const rest = line.slice(prefix.length);
  const commentIndex = commentStart(rest);
  const comment = commentIndex === -1 ? "" : rest.slice(commentIndex);
  return `${prefix} ${yamlString(value)}${comment}`;
}

/**
 * Patch an experiment document's frontmatter: replace the values of patched
 * scalar keys (preserving their inline comments), regenerate the `custom:`
 * block when patched, and leave every other line — including the entire body
 * — untouched. Keys that are patched but missing from a hand-edited file are
 * appended, so a patch never silently drops a field.
 *
 * @param content The experiment document
 * @param patch The frontmatter fields to write
 * @param bodyTransform Optional transform applied to the body
 * @returns The patched document
 */
export function applyFrontmatterPatch(
  content: string,
  patch: ExperimentPatch,
  bodyTransform?: (body: string) => string,
): string {
  const split = splitFrontmatter(content);
  if (!split) {
    throw new Error(
      "The experiment file has malformed frontmatter: expected the file to " +
        "open with a '---' delimited YAML block.",
    );
  }

  const out: string[] = [];
  const appliedScalars = new Set<string>();
  let customApplied = patch.custom === undefined;
  let skippingCustom = false;

  for (const line of split.lines) {
    if (skippingCustom) {
      // Lines still belonging to the replaced custom block: indented or blank.
      if (line.trim() === "" || /^\s/.test(line)) {
        continue;
      }
      skippingCustom = false;
    }

    const scalarKey = SCALAR_KEYS.find(
      (key) => patch[key] !== undefined && line.startsWith(`${key}:`),
    );
    if (scalarKey) {
      out.push(patchScalarLine(line, scalarKey, patch[scalarKey] as string));
      appliedScalars.add(scalarKey);
      continue;
    }

    if (!customApplied && line.startsWith("custom:")) {
      out.push(...customBlockLines(patch.custom as CustomFields));
      customApplied = true;
      skippingCustom = true;
      continue;
    }

    out.push(line);
  }

  for (const key of SCALAR_KEYS) {
    if (patch[key] !== undefined && !appliedScalars.has(key)) {
      out.push(`${key}: ${yamlString(patch[key] as string)}`);
    }
  }
  if (!customApplied) {
    out.push(...customBlockLines(patch.custom as CustomFields));
  }

  const body = bodyTransform ? bodyTransform(split.body) : split.body;
  return joinFrontmatter(out, body);
}
