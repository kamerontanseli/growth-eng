import { assertCallToolResult } from "@mcpjam/sdk";
import type { MCPClientManager } from "@mcpjam/sdk";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { KnowledgeBaseService } from "../src/core/services/knowledge-base-service.js";
import { SERVER_ID, promptText, startServerIn, stopServer } from "./harness";

/** A tool result in the shape assertCallToolResult narrows to. */
type ToolResult = ReturnType<typeof assertCallToolResult>;

/** The full tool surface of the server. */
const TOOL_NAMES = ["create_experiment", "create_feature_folder", "update_experiment"];

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
  return result.content
    .map((block) => ("text" in block ? block.text : ""))
    .join("\n");
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
  await mkdir(join(root, ".growth-eng", "_images"), { recursive: true });
  await writeFile(join(root, ".growth-eng", "_images", ".gitkeep"), "");
  await writeFile(
    join(root, ".growth-eng", "_template_.md"),
    KnowledgeBaseService.getExperimentTemplate(),
  );
}

/** Parse the frontmatter of a markdown document as YAML. */
function parseFrontmatter(content: string): Record<string, unknown> {
  const lines = content.split("\n");
  const end = lines.indexOf("---", 1);
  return Bun.YAML.parse(lines.slice(1, end).join("\n")) as Record<
    string,
    unknown
  >;
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

  it("exposes the feature folder and experiment tools", async () => {
    const { tools } = await manager.listTools(SERVER_ID);
    expect(tools.map((tool) => tool.name).sort()).toEqual(TOOL_NAMES);
  });

  it("exposes only the init prompt", async () => {
    const { prompts } = await manager.listPrompts(SERVER_ID);
    expect(prompts.map((prompt) => prompt.name)).toEqual(["init"]);
  });

  it("exposes no resources", async () => {
    const { resources } = await manager.listResources(SERVER_ID);
    expect(resources).toEqual([]);
  });

  it("init prompt embeds the experiment template verbatim", async () => {
    const prompt = await manager.getPrompt(SERVER_ID, { name: "init" });
    const text = promptText(prompt);

    expect(text).toContain(
      "Initialize the growth-eng knowledge base in this repository",
    );
    // The template must ride in the prompt verbatim, so an agent following it
    // can write the file byte-for-byte. The canonical file ends with a newline
    // the fenced block does not carry.
    expect(text).toContain(
      KnowledgeBaseService.getExperimentTemplate().replace(/\n+$/, ""),
    );
  });

  describe("feature folders", () => {
    it("creates the folder and normalizes the name", async () => {
      const result = await callTool(manager, "create_feature_folder", {
        name: "Onboarding Flow",
      });
      expect(result.isError).toBeUndefined();
      expect(textOf(result)).toContain(".growth-eng/onboarding-flow");
      expect(
        (await stat(join(sandbox, ".growth-eng", "onboarding-flow"))).isDirectory(),
      ).toBe(true);
    });

    it("refuses to create a folder twice", async () => {
      const text = await expectToolError(manager, "create_feature_folder", {
        name: "onboarding-flow",
      });
      expect(text).toContain("already exists");
    });
  });

  describe("experiments", () => {
    it("copies the template and fills the frontmatter from the arguments", async () => {
      const result = await callTool(manager, "create_experiment", {
        feature: "Onboarding Flow",
        title: "Simplify signup",
        feature_flag_key: "simplify-signup",
        start_date: "2026-01-05",
        status: "running",
        custom: { team: "growth", priority: 1 },
      });
      expect(textOf(result)).toContain(
        ".growth-eng/onboarding-flow/simplify-signup.md",
      );

      const content = await readFile(
        join(sandbox, ".growth-eng", "onboarding-flow", "simplify-signup.md"),
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
        join(sandbox, ".growth-eng", "onboarding-flow", "referrals-nudge.md"),
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
      expect(text).toContain(".growth-eng/ghost");
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
        existsSync(join(sandbox, ".growth-eng", "onboarding-flow", "invalid-flag.md")),
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
        existsSync(
          join(sandbox, ".growth-eng", "checkout", "one-page-checkout.md"),
        ),
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
          join(
            sandbox,
            ".growth-eng",
            "checkout",
            "one-page-checkout-03-01-2026.md",
          ),
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
      const file = join(
        sandbox,
        ".growth-eng",
        "onboarding-flow",
        "referrals-nudge.md",
      );
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

  it("create_experiment tells the agent to run the init prompt", async () => {
    const text = await expectToolError(manager, "create_experiment", {
      feature: "onboarding",
      title: "Too early",
      feature_flag_key: "too-early",
    });
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
    expect(textOf(result)).toContain(".growth-eng/onboarding");
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
