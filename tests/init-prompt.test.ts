import type { HostRunner, MCPClientManager } from "@mcpjam/sdk";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { KnowledgeBaseService } from "../src/core/services/knowledge-base-service.js";
import { LintService } from "../src/core/services/lint-service.js";
import {
  SERVER_ID,
  createAgent,
  hasOpenRouterKey,
  promptText,
  startServer,
  stopServer,
  type SdkTool,
} from "./harness";

/**
 * End-to-end tests of the `init` prompt, following the MCP prompt contract:
 * prompts are user-guided templates, not model-driven tool calls. The user
 * selects the prompt in their client (e.g. `/init`); the client sends
 * prompts/get and receives structured messages ready to send to the model.
 *
 * The tests act as that client: they send prompts/get for the user-selected
 * `init` prompt and hand the returned messages to the agent unchanged. The
 * agent has `read_file`, `create_directory`, and `write_file` tools scoped
 * to a throwaway sandbox directory standing in for the repository.
 *
 * Two scenarios: a fresh repository, where the prompt must get the agent to
 * create .growth-eng/ with _template_.md and lint-rules.json; and a knowledge
 * base from before lint rules existed, where the prompt must get the agent to
 * create only the missing lint-rules.json and leave the template untouched.
 *
 * The companion no-LLM tests in tools.test.ts pin the rest of the prompt
 * contract: prompts/list discovery, and the rendered content embedding the
 * template and the default lint rules verbatim.
 */

const RUN_TIMEOUT_MS = 240_000;

/** Resolve a path inside the sandbox, refusing escapes. */
function resolveInside(root: string, relative: string): string {
  const resolved = resolve(root, relative);
  const prefix = root.endsWith(sep) ? root : root + sep;
  if (!resolved.startsWith(prefix)) {
    throw new Error(`Path is outside the working directory: ${relative}`);
  }
  return resolved;
}

/** Run a sandbox operation, reporting failures to the model instead of throwing. */
async function toolResult(
  op: () => Promise<string>,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  try {
    return { content: [{ type: "text", text: await op() }] };
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${(error as Error).message}` }],
      isError: true,
    };
  }
}

function createDirectoryTool(root: string): SdkTool {
  return {
    name: "create_directory",
    description:
      "Create a directory in the working directory of this repository. " +
      "path is relative (e.g. `.growth-eng/`). Parent directories are created as needed.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
    execute: async (args) =>
      toolResult(async () => {
        const dir = resolveInside(root, String(args.path));
        await mkdir(dir, { recursive: true });
        return `Created directory: ${String(args.path)}`;
      }),
  };
}

function readFileTool(root: string): SdkTool {
  return {
    name: "read_file",
    description:
      "Read a file from the working directory of this repository and return its content. " +
      "path is relative (e.g. `.growth-eng/_template_.md`). " +
      "Fails when the file does not exist.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" } },
      required: ["path"],
      additionalProperties: false,
    },
    execute: async (args) =>
      toolResult(async () => {
        const file = resolveInside(root, String(args.path));
        const content = await readFile(file, "utf8");
        return content;
      }),
  };
}

function writeFileTool(root: string): SdkTool {
  return {
    name: "write_file",
    description:
      "Write a file in the working directory of this repository with the given content, " +
      "exactly as provided. path is relative (e.g. `.growth-eng/_template_.md`). " +
      "Parent directories are created as needed. Existing files are overwritten.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
    execute: async (args) =>
      toolResult(async () => {
        const file = resolveInside(root, String(args.path));
        await mkdir(dirname(file), { recursive: true });
        const content = String(args.content);
        await writeFile(file, content);
        return `Wrote ${String(args.path)} (${content.length} characters)`;
      }),
  };
}

/**
 * Compare file content verbatim, ignoring trailing newlines: models reliably
 * add or drop a final newline, and that is not a template change.
 */
function withoutTrailingNewlines(text: string): string {
  return text.replace(/\n+$/, "");
}

describe.skipIf(!hasOpenRouterKey())("init prompt end-to-end", () => {
  describe("fresh repository", () => {
    let manager: MCPClientManager;
    let agent: HostRunner;
    let sandbox: string;

    beforeAll(async () => {
      sandbox = await mkdtemp(join(tmpdir(), "growth-eng-init-"));
      manager = await startServer();
      agent = await createAgent(manager, [
        readFileTool(sandbox),
        createDirectoryTool(sandbox),
        writeFileTool(sandbox),
      ]);
    }, 60_000);

    afterAll(async () => {
      await stopServer(manager);
      await rm(sandbox, { recursive: true, force: true });
    });

    it(
      "has the user-selected init prompt drive the agent to create .growth-eng/ and write _template_.md and lint-rules.json",
      async () => {
        // The user selected the init prompt (e.g. `/init`). The client sends
        // prompts/get and receives structured messages ready to send to the model.
        const prompt = await manager.getPrompt(SERVER_ID, { name: "init" });
        const messages = (
          prompt as { messages: Array<{ role: string }> }
        ).messages;
        expect(messages.length).toBeGreaterThan(0);
        expect(messages[0].role).toBe("user");

        // The client hands the rendered messages to the agent unchanged; the
        // model then acts on them with its file tools.
        const result = await agent.run(promptText(prompt), {
          timeoutMs: RUN_TIMEOUT_MS,
        });
        expect(result.hasError()).toBe(false);

        // The agent made the .growth-eng/ directory.
        const dir = await stat(join(sandbox, ".growth-eng"));
        expect(dir.isDirectory()).toBe(true);

        // And wrote _template_.md inside it, with the template content verbatim.
        const written = await readFile(
          join(sandbox, ".growth-eng", "_template_.md"),
          "utf8",
        );
        const expected = KnowledgeBaseService.getExperimentTemplate();
        expect(withoutTrailingNewlines(written)).toBe(
          withoutTrailingNewlines(expected),
        );

        // And wrote lint-rules.json with the default rules. The rules are
        // compared semantically: a model copying a long JSON block preserves
        // the ruleset, but not necessarily the byte layout (the blank lines
        // between rule groups). The prompt-contract tests pin verbatim.
        const writtenRules = await readFile(
          join(sandbox, ".growth-eng", "lint-rules.json"),
          "utf8",
        );
        expect(JSON.parse(writtenRules)).toEqual(
          JSON.parse(LintService.getDefaultRules()),
        );
      },
      300_000,
    );
  });

  describe("knowledge base initialized before lint rules existed", () => {
    let manager: MCPClientManager;
    let agent: HostRunner;
    let sandbox: string;

    beforeAll(async () => {
      sandbox = await mkdtemp(join(tmpdir(), "growth-eng-partial-"));
      // A knowledge base from before the lint rules file existed: the
      // template is there, the rules file is not.
      await mkdir(join(sandbox, ".growth-eng", "_images"), { recursive: true });
      await writeFile(join(sandbox, ".growth-eng", "_images", ".gitkeep"), "");
      await writeFile(
        join(sandbox, ".growth-eng", "_template_.md"),
        KnowledgeBaseService.getExperimentTemplate(),
      );
      manager = await startServer();
      agent = await createAgent(manager, [
        readFileTool(sandbox),
        createDirectoryTool(sandbox),
        writeFileTool(sandbox),
      ]);
    }, 60_000);

    afterAll(async () => {
      await stopServer(manager);
      await rm(sandbox, { recursive: true, force: true });
    });

    it(
      "drives the agent to create only the missing lint-rules.json and leave the template untouched",
      async () => {
        const prompt = await manager.getPrompt(SERVER_ID, { name: "init" });
        const result = await agent.run(promptText(prompt), {
          timeoutMs: RUN_TIMEOUT_MS,
        });
        expect(result.hasError()).toBe(false);

        // The missing rules file is created with the default rules.
        const writtenRules = await readFile(
          join(sandbox, ".growth-eng", "lint-rules.json"),
          "utf8",
        );
        expect(JSON.parse(writtenRules)).toEqual(
          JSON.parse(LintService.getDefaultRules()),
        );

        // The existing template is left exactly as it was.
        const template = await readFile(
          join(sandbox, ".growth-eng", "_template_.md"),
          "utf8",
        );
        expect(withoutTrailingNewlines(template)).toBe(
          withoutTrailingNewlines(KnowledgeBaseService.getExperimentTemplate()),
        );
      },
      300_000,
    );
  });
});
