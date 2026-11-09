import type { HostRunner, MCPClientManager } from "@mcpjam/sdk";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { KnowledgeBaseService } from "../src/core/services/knowledge-base-service.js";
import { LintService } from "../src/core/services/lint-service.js";
import {
  MODEL,
  REASONING_EFFORT,
  SERVER_ID,
  createAgent,
  hasOpenRouterKey,
  startServerIn,
  stopServer,
} from "./harness";

/** The full tool surface of the server. */
const TOOL_NAMES = [
  "create_experiment",
  "create_feature_folder",
  "lint_experiments",
  "update_experiment",
];

let manager: MCPClientManager;
let agent: HostRunner;
let sandbox: string;

describe.skipIf(!hasOpenRouterKey())(
  `${MODEL} tool selection (${REASONING_EFFORT} reasoning)`,
  () => {
    beforeAll(async () => {
      // The agent's tool calls mutate the working directory, so the server
      // is booted in a throwaway sandbox holding an initialized knowledge
      // base with an 'onboarding' feature folder and one experiment to update.
      sandbox = await mkdtemp(join(tmpdir(), "growth-eng-agent-"));
      await mkdir(join(sandbox, ".growth-eng", "_images"), { recursive: true });
      await writeFile(
        join(sandbox, ".growth-eng", "_template_.md"),
        KnowledgeBaseService.getExperimentTemplate(),
      );
      await writeFile(
        join(sandbox, ".growth-eng", "lint-rules.json"),
        LintService.getDefaultRules(),
      );
      await mkdir(join(sandbox, ".growth-eng", "onboarding"));
      manager = await startServerIn(sandbox);
      await manager.executeTool(SERVER_ID, "create_experiment", {
        feature: "onboarding",
        title: "Referrals nudge",
        feature_flag_key: "referrals-nudge",
      });
      agent = await createAgent(manager);
    }, 60_000);

    afterAll(async () => {
      await stopServer(manager);
      await rm(sandbox, { recursive: true, force: true });
    });

    it("calls create_feature_folder with the right name", async () => {
      const result = await agent.run(
        "Create a feature folder called checkout for experiments to live in.",
      );

      expect(result.hasError()).toBe(false);
      expect(result.hasToolCall("create_feature_folder")).toBe(true);
      expect(result.getToolArguments("create_feature_folder")).toMatchObject({
        name: "checkout",
      });
    }, 120_000);

    it("calls create_experiment with the right arguments", async () => {
      const result = await agent.run(
        'Create an experiment titled "Simplify signup form" with feature ' +
          'flag key "simplify-signup" in the onboarding feature.',
      );

      expect(result.hasError()).toBe(false);
      expect(result.hasToolCall("create_experiment")).toBe(true);
      expect(result.getToolArguments("create_experiment")).toMatchObject({
        feature: "onboarding",
        title: "Simplify signup form",
        feature_flag_key: "simplify-signup",
      });
    }, 120_000);

    it("calls update_experiment with the right arguments", async () => {
      const result = await agent.run(
        'Mark the "referrals-nudge" experiment in the onboarding feature ' +
          'as ended with conclusion "won".',
      );

      expect(result.hasError()).toBe(false);
      expect(result.hasToolCall("update_experiment")).toBe(true);
      expect(result.getToolArguments("update_experiment")).toMatchObject({
        feature: "onboarding",
        name: "referrals-nudge",
        status: "ended",
        conclusion: "won",
      });
    }, 120_000);

    it("calls lint_experiments when asked to lint the experiments", async () => {
      const result = await agent.run(
        "Lint the experiments in the .growth-eng/ knowledge base.",
      );

      expect(result.hasError()).toBe(false);
      expect(result.hasToolCall("lint_experiments")).toBe(true);
    }, 120_000);

    it("does not call tools for an unrelated question", async () => {
      const result = await agent.run(
        "What is the capital of France? Answer directly.",
      );

      for (const tool of TOOL_NAMES) {
        expect(result.hasToolCall(tool)).toBe(false);
      }
      expect(result.text.toLowerCase()).toContain("paris");
    }, 120_000);
  },
);
