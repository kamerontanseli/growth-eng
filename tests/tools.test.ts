import { assertCallToolResult } from "@mcpjam/sdk";
import type { MCPClientManager } from "@mcpjam/sdk";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { KnowledgeBaseService } from "../src/core/services/knowledge-base-service.js";
import { LintService } from "../src/core/services/lint-service.js";
import { SERVER_ID, promptText, startServerIn, stopServer } from "./harness";

/** A tool result in the shape assertCallToolResult narrows to. */
type ToolResult = ReturnType<typeof assertCallToolResult>;

/** The full tool surface of the server. */
const TOOL_NAMES = [
  "create_experiment",
  "create_feature_folder",
  "create_idea",
  "lint_experiments",
  "reject_idea",
  "update_experiment",
];

/** The full prompt surface of the server. */
const PROMPT_NAMES = ["generate-experiment-idea", "hypothesis-tree", "init", "plan-experiment"];

/** Execute a tool and return its result, whatever it is. */
async function callTool(
  manager: MCPClientManager,
  tool: string,
  args: Record<string, unknown> = {},
): Promise<ToolResult> {
  return assertCallToolResult(await manager.executeTool(SERVER_ID, tool, args));
}

/** The text content of a tool result. */
function textOf(result: ToolResult): string {
  return result.content.map((block) => ("text" in block ? block.text : "")).join("\n");
}

/** Execute a tool, assert it failed, and return its error text. */
async function expectToolError(
  manager: MCPClientManager,
  tool: string,
  args: Record<string, unknown> = {},
): Promise<string> {
  const result = await callTool(manager, tool, args);
  expect(result.isError).toBe(true);
  return textOf(result);
}

/** Create an initialized knowledge base in the given directory. */
async function bootstrapKnowledgeBase(root: string): Promise<void> {
  await mkdir(join(root, ".growth-eng", "images"), { recursive: true });
  await mkdir(join(root, ".growth-eng", "ideas", "rejected"), { recursive: true });
  await mkdir(join(root, ".growth-eng", "specs"), { recursive: true });
  await writeFile(join(root, ".growth-eng", "images", ".gitkeep"), "");
  await writeFile(join(root, ".growth-eng", "ideas", "rejected", ".gitkeep"), "");
  await writeFile(join(root, ".growth-eng", "specs", ".gitkeep"), "");
  await writeFile(
    join(root, ".growth-eng", "_template_.md"),
    KnowledgeBaseService.getExperimentTemplate(),
  );
  await writeFile(join(root, ".growth-eng", "lint-rules.json"), LintService.getDefaultRules());
}

/** Parse the frontmatter of a markdown document as YAML. */
function parseFrontmatter(content: string): Record<string, unknown> {
  const lines = content.split("\n");
  const end = lines.indexOf("---", 1);
  return Bun.YAML.parse(lines.slice(1, end).join("\n")) as Record<string, unknown>;
}

/** The body of a document: everything after the closing frontmatter marker. */
function bodyOf(content: string): string {
  return content.slice(content.indexOf("---", 3) + 3);
}

describe("growth-eng MCP server (direct execution, no LLM)", () => {
  let manager: MCPClientManager;
  let sandbox: string;

  beforeAll(async () => {
    // The server's tools operate on .growth-eng/ under their working
    // directory, so the server is booted in a throwaway sandbox.
    sandbox = await mkdtemp(join(tmpdir(), "growth-eng-kb-"));
    await bootstrapKnowledgeBase(sandbox);
    manager = await startServerIn(sandbox);
  }, 30_000);

  afterAll(async () => {
    await stopServer(manager);
    await rm(sandbox, { recursive: true, force: true });
  });

  it("exposes the feature folder, idea, experiment, and lint tools", async () => {
    const { tools } = await manager.listTools(SERVER_ID);
    expect(tools.map((tool) => tool.name).sort()).toEqual(TOOL_NAMES);
  });

  it("exposes the init and skill prompts", async () => {
    const { prompts } = await manager.listPrompts(SERVER_ID);
    expect(prompts.map((prompt) => prompt.name).sort()).toEqual(PROMPT_NAMES);
  });

  it("exposes no resources", async () => {
    const { resources } = await manager.listResources(SERVER_ID);
    expect(resources).toEqual([]);
  });

  it("init prompt embeds the experiment template and lint rules verbatim", async () => {
    const prompt = await manager.getPrompt(SERVER_ID, { name: "init" });
    const text = promptText(prompt);

    expect(text).toContain("Initialize the growth-eng knowledge base in this repository");
    expect(text).toContain(".growth-eng/images/");
    expect(text).toContain(".growth-eng/ideas/rejected/");
    expect(text).toContain(".growth-eng/specs/");
    // The template must ride in the prompt verbatim, so an agent following it
    // can write the file byte-for-byte. The canonical file ends with a newline
    // the fenced block does not carry.
    expect(text).toContain(KnowledgeBaseService.getExperimentTemplate().replace(/\n+$/, ""));
    // The default lint rules ride in the prompt verbatim too, for the same
    // reason: the rules file must land byte-for-byte.
    expect(text).toContain(LintService.getDefaultRules().replace(/\n+$/, ""));
  });

  it("renders the skill prompts (generate-experiment-idea, plan-experiment, hypothesis-tree)", async () => {
    const ideaPrompt = await manager.getPrompt(SERVER_ID, {
      name: "generate-experiment-idea",
      arguments: {
        size: "s",
        focus_area: "onboarding",
        details: "Reduce signup drop-off",
      },
    });
    const ideaText = promptText(ideaPrompt);
    expect(ideaText).toContain("Requested test size: s");
    expect(ideaText).toContain("Focus area: onboarding");
    expect(ideaText).toContain("Reduce signup drop-off");
    expect(ideaText).toContain(".growth-eng/ideas/");
    expect(ideaText).toContain("rejected");

    const planPrompt = await manager.getPrompt(SERVER_ID, {
      name: "plan-experiment",
      arguments: { idea_slug: "simplify-signup" },
    });
    const planText = promptText(planPrompt);
    expect(planText).toContain(".growth-eng/ideas/simplify-signup.md");
    expect(planText).toContain("create_experiment");

    const treePrompt = await manager.getPrompt(SERVER_ID, {
      name: "hypothesis-tree",
    });
    const treeText = promptText(treePrompt);
    expect(treeText).toContain("green");
    expect(treeText).toContain("red");
    expect(treeText).toContain("grey");
  });

  describe("feature folders", () => {
    it("creates the folder under .growth-eng/specs/ and normalizes the name", async () => {
      const result = await callTool(manager, "create_feature_folder", {
        name: "Onboarding Flow",
      });
      expect(result.isError).toBeUndefined();
      expect(textOf(result)).toContain(".growth-eng/specs/onboarding-flow");
      expect(
        (await stat(join(sandbox, ".growth-eng", "specs", "onboarding-flow"))).isDirectory(),
      ).toBe(true);
    });

    it("refuses to create a folder twice", async () => {
      const text = await expectToolError(manager, "create_feature_folder", {
        name: "onboarding-flow",
      });
      expect(text).toContain("already exists");
    });
  });

  describe("ideas", () => {
    it("creates a draft idea from the template under .growth-eng/ideas/ and returns a prompt to fill it out", async () => {
      const result = await callTool(manager, "create_idea", {
        slug: "Simplify Signup",
      });
      expect(result.isError).toBeUndefined();
      expect(textOf(result)).toContain(".growth-eng/ideas/simplify-signup.md");
      expect(textOf(result)).toContain("fill out the idea template");

      const content = await readFile(
        join(sandbox, ".growth-eng", "ideas", "simplify-signup.md"),
        "utf8",
      );
      expect(content).toBe(KnowledgeBaseService.getExperimentTemplate());
    });

    it("refuses to create a duplicate idea", async () => {
      const text = await expectToolError(manager, "create_idea", {
        slug: "simplify-signup",
      });
      expect(text).toContain("already exists");
    });

    it("rejects an idea by moving it to .growth-eng/ideas/rejected/ and returns a prompt", async () => {
      const result = await callTool(manager, "reject_idea", {
        slug: "simplify-signup",
      });
      expect(result.isError).toBeUndefined();
      expect(textOf(result)).toContain(".growth-eng/ideas/rejected/simplify-signup.md");
      expect(textOf(result)).toContain("rejected and moved");
      expect(existsSync(join(sandbox, ".growth-eng", "ideas", "simplify-signup.md"))).toBe(false);
      expect(
        existsSync(join(sandbox, ".growth-eng", "ideas", "rejected", "simplify-signup.md")),
      ).toBe(true);
    });

    it("fails when rejecting an idea that does not exist", async () => {
      const text = await expectToolError(manager, "reject_idea", {
        slug: "nonexistent-idea",
      });
      expect(text).toContain('No idea named "nonexistent-idea.md"');
    });
  });

  describe("experiments", () => {
    it("copies the template into .growth-eng/specs/<feature>/ and fills the frontmatter from the arguments", async () => {
      const result = await callTool(manager, "create_experiment", {
        feature: "Onboarding Flow",
        title: "Simplify signup",
        feature_flag_key: "simplify-signup",
        start_date: "2026-01-05",
        status: "running",
        custom: { team: "growth", priority: 1 },
      });
      expect(textOf(result)).toContain(".growth-eng/specs/onboarding-flow/simplify-signup.md");

      const content = await readFile(
        join(sandbox, ".growth-eng", "specs", "onboarding-flow", "simplify-signup.md"),
        "utf8",
      );
      expect(parseFrontmatter(content)).toEqual({
        title: "Simplify signup",
        feature_flag_key: "simplify-signup",
        start_date: "2026-01-05",
        end_date: "",
        status: "running",
        conclusion: "",
        winning_variant: "",
        custom: { team: "growth", priority: 1 },
      });
      // The template's inline comments survive the patch.
      expect(content).toContain("# draft | running | ended");
      expect(content).toContain("# won | loss | inconclusive | stopped_early | invalid");
      // The body heading is filled from the title; the rest stays for the agent.
      expect(content).toContain("# Simplify signup");
      expect(content).not.toContain("<title>");
      expect(content).toContain("## Hypothesis");
      expect(content).toContain("## Metrics");
    });

    it("applies the documented defaults for optional fields", async () => {
      await callTool(manager, "create_experiment", {
        feature: "onboarding-flow",
        title: "Referrals nudge",
        feature_flag_key: "referrals-nudge",
      });
      const content = await readFile(
        join(sandbox, ".growth-eng", "specs", "onboarding-flow", "referrals-nudge.md"),
        "utf8",
      );
      expect(parseFrontmatter(content)).toEqual({
        title: "Referrals nudge",
        feature_flag_key: "referrals-nudge",
        start_date: "",
        end_date: "",
        status: "draft",
        conclusion: "",
        winning_variant: "",
        custom: {},
      });
    });

    it("points at create_feature_folder when the feature folder is missing", async () => {
      const text = await expectToolError(manager, "create_experiment", {
        feature: "ghost",
        title: "Phantom",
        feature_flag_key: "phantom-flag",
      });
      expect(text).toContain(".growth-eng/specs/ghost");
      expect(text).toContain("create_feature_folder");
    });

    it("rejects invalid arguments", async () => {
      const base = {
        feature: "onboarding-flow",
        title: "Invalid",
        feature_flag_key: "invalid-flag",
      };
      const invalid = [
        { ...base, start_date: "2026/01/05" },
        { ...base, end_date: "05-01-2026" },
        { ...base, status: "paused" },
        { ...base, conclusion: "great" },
        { ...base, custom: { "bad key": 1 } },
      ];
      for (const args of invalid) {
        await expectToolError(manager, "create_experiment", args);
      }
      // Missing required field.
      await expectToolError(manager, "create_experiment", {
        feature: "onboarding-flow",
        feature_flag_key: "invalid-flag",
      });
      expect(
        existsSync(join(sandbox, ".growth-eng", "specs", "onboarding-flow", "invalid-flag.md")),
      ).toBe(false);
    });

    it("disambiguates duplicate flag keys with the start date", async () => {
      await callTool(manager, "create_feature_folder", { name: "checkout" });
      await callTool(manager, "create_experiment", {
        feature: "checkout",
        title: "One-page checkout",
        feature_flag_key: "one-page-checkout",
      });
      expect(
        existsSync(join(sandbox, ".growth-eng", "specs", "checkout", "one-page-checkout.md")),
      ).toBe(true);

      // Same flag key, no start_date to disambiguate: error says what to pass.
      const withoutDate = await expectToolError(manager, "create_experiment", {
        feature: "checkout",
        title: "One-page checkout v2",
        feature_flag_key: "one-page-checkout",
      });
      expect(withoutDate).toContain("start_date");

      // With a start_date, a dated variant is created.
      const dated = await callTool(manager, "create_experiment", {
        feature: "checkout",
        title: "One-page checkout v2",
        feature_flag_key: "one-page-checkout",
        start_date: "2026-03-01",
      });
      expect(textOf(dated)).toContain("one-page-checkout-03-01-2026.md");
      expect(
        existsSync(
          join(sandbox, ".growth-eng", "specs", "checkout", "one-page-checkout-03-01-2026.md"),
        ),
      ).toBe(true);

      // Same flag key and date: error suggests a different key or date.
      const sameDate = await expectToolError(manager, "create_experiment", {
        feature: "checkout",
        title: "One-page checkout v3",
        feature_flag_key: "one-page-checkout",
        start_date: "2026-03-01",
      });
      expect(sameDate).toContain("already exists");
    });

    it("patches frontmatter and leaves the body untouched", async () => {
      const file = join(sandbox, ".growth-eng", "specs", "onboarding-flow", "referrals-nudge.md");
      const before = await readFile(file, "utf8");
      const result = await callTool(manager, "update_experiment", {
        feature: "onboarding-flow",
        name: "referrals-nudge",
        status: "ended",
        conclusion: "won",
        winning_variant: "treatment",
        end_date: "2026-02-01",
        custom: { shipped: true },
      });
      expect(textOf(result)).toContain("referrals-nudge.md");
      const after = await readFile(file, "utf8");
      expect(parseFrontmatter(after)).toEqual({
        title: "Referrals nudge",
        feature_flag_key: "referrals-nudge",
        start_date: "",
        end_date: "2026-02-01",
        status: "ended",
        conclusion: "won",
        winning_variant: "treatment",
        custom: { shipped: true },
      });
      // The markdown body is byte-for-byte unchanged.
      expect(bodyOf(after)).toBe(bodyOf(before));
      // The template's inline comments survive the patch.
      expect(after).toContain("# draft | running | ended");
    });

    it("requires at least one field to update", async () => {
      const text = await expectToolError(manager, "update_experiment", {
        feature: "onboarding-flow",
        name: "referrals-nudge",
      });
      expect(text).toContain("at least one field");
    });

    it("rejects unknown experiments and invalid values on update", async () => {
      const missing = await expectToolError(manager, "update_experiment", {
        feature: "onboarding-flow",
        name: "ghost-experiment",
        status: "ended",
      });
      expect(missing).toContain("No experiment");
      // The error lists what the feature folder does contain.
      expect(missing).toContain("Found:");
      expect(missing).toContain("simplify-signup.md");
      await expectToolError(manager, "update_experiment", {
        feature: "onboarding-flow",
        name: "referrals-nudge",
        status: "paused",
      });
    });
  });

  describe("lint_experiments", () => {
    const rulesPath = () => join(sandbox, ".growth-eng", "lint-rules.json");

    it("returns the rules and the scoring prompt from an initialized knowledge base", async () => {
      const result = await callTool(manager, "lint_experiments");
      expect(result.isError).not.toBe(true);
      const text = textOf(result);
      expect(text).toContain(
        "Loaded 27 lint rules from .growth-eng/lint-rules.json (21 error, 6 warning)",
      );
      // The rules ride in the result verbatim, so the calling LLM judges
      // against exactly what the repository holds.
      expect(text).toContain(LintService.getDefaultRules().replace(/\n+$/, ""));
      // The scoring prompt: the formula, the glob, the template exclusion.
      expect(text).toContain("Experiment Quality % = (rules followed / total rules) * 100");
      expect(text).toContain(".growth-eng/specs/**/*.md");
      expect(text).toContain("_template_.md");
      expect(text).toContain("nothing to lint");
    });

    it("returns customized rules from the knowledge base, not the defaults", async () => {
      const custom = {
        "team/has-a-custom-rule": {
          severity: "warning",
          lint_rule: "The spec must name the team that owns the experiment.",
          bad_example: "No owner is named anywhere in the spec.",
          good_example: "The growth core team owns this experiment.",
        },
      };
      await writeFile(rulesPath(), JSON.stringify(custom, null, 2));
      try {
        const result = await callTool(manager, "lint_experiments");
        const text = textOf(result);
        expect(text).toContain(
          "Loaded 1 lint rules from .growth-eng/lint-rules.json (0 error, 1 warning)",
        );
        expect(text).toContain("team/has-a-custom-rule");
        expect(text).toContain("The spec must name the team that owns the experiment.");
        expect(text).not.toContain("hypothesis/is-falsifiable");
      } finally {
        await writeFile(rulesPath(), LintService.getDefaultRules());
      }
    });

    it("tells the agent to run the init prompt when the rules file is missing", async () => {
      await rm(rulesPath());
      try {
        const text = await expectToolError(manager, "lint_experiments");
        expect(text).toContain(".growth-eng/lint-rules.json");
        expect(text).toContain("init");
      } finally {
        await writeFile(rulesPath(), LintService.getDefaultRules());
      }
    });

    it("rejects malformed JSON, naming the file and the fix", async () => {
      await writeFile(rulesPath(), "{ not json");
      try {
        const text = await expectToolError(manager, "lint_experiments");
        expect(text).toContain(".growth-eng/lint-rules.json");
        expect(text).toContain("not valid JSON");
        expect(text).toContain("init");
      } finally {
        await writeFile(rulesPath(), LintService.getDefaultRules());
      }
    });

    it("rejects an invalid rule shape, naming the offending rule", async () => {
      await writeFile(
        rulesPath(),
        JSON.stringify({
          "broken-rule": { severity: "error" },
          "odd-severity": { severity: "high", lint_rule: "A rule." },
        }),
      );
      try {
        const text = await expectToolError(manager, "lint_experiments");
        // The first invalid rule in the file fails the parse, so the error
        // names that one.
        expect(text).toContain("broken-rule");
        expect(text).toContain("is missing its lint_rule description");
      } finally {
        await writeFile(rulesPath(), LintService.getDefaultRules());
      }
    });
  });
});

describe("tools against an uninitialized knowledge base", () => {
  let manager: MCPClientManager;
  let sandbox: string;

  beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "growth-eng-empty-"));
    manager = await startServerIn(sandbox);
  }, 30_000);

  afterAll(async () => {
    await stopServer(manager);
    await rm(sandbox, { recursive: true, force: true });
  });

  it("create_feature_folder tells the agent to run the init prompt", async () => {
    const text = await expectToolError(manager, "create_feature_folder", {
      name: "onboarding",
    });
    expect(text).toContain("init");
  });

  it("create_idea tells the agent to run the init prompt", async () => {
    const text = await expectToolError(manager, "create_idea", {
      slug: "onboarding-idea",
    });
    expect(text).toContain("init");
  });

  it("reject_idea tells the agent to run the init prompt", async () => {
    const text = await expectToolError(manager, "reject_idea", {
      slug: "onboarding-idea",
    });
    expect(text).toContain("init");
  });

  it("create_experiment tells the agent to run the init prompt", async () => {
    const text = await expectToolError(manager, "create_experiment", {
      feature: "onboarding",
      title: "Too early",
      feature_flag_key: "too-early",
    });
    expect(text).toContain("init");
  });

  it("lint_experiments tells the agent to run the init prompt", async () => {
    const text = await expectToolError(manager, "lint_experiments");
    expect(text).toContain("init");
  });
});

describe("knowledge base without a template", () => {
  let manager: MCPClientManager;
  let sandbox: string;

  beforeAll(async () => {
    sandbox = await mkdtemp(join(tmpdir(), "growth-eng-notemplate-"));
    await mkdir(join(sandbox, ".growth-eng"));
    manager = await startServerIn(sandbox);
  }, 30_000);

  afterAll(async () => {
    await stopServer(manager);
    await rm(sandbox, { recursive: true, force: true });
  });

  it("create_feature_folder works without the template", async () => {
    const result = await callTool(manager, "create_feature_folder", {
      name: "onboarding",
    });
    expect(textOf(result)).toContain(".growth-eng/specs/onboarding");
  });

  it("create_idea tells the agent to run the init prompt", async () => {
    const text = await expectToolError(manager, "create_idea", {
      slug: "no-template-idea",
    });
    expect(text).toContain("init");
  });

  it("create_experiment tells the agent to run the init prompt", async () => {
    const text = await expectToolError(manager, "create_experiment", {
      feature: "onboarding",
      title: "No template",
      feature_flag_key: "no-template",
    });
    expect(text).toContain("init");
  });
});
