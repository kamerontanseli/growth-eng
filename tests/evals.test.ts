import type { HostRunner, MCPClientManager, PromptResult } from "@mcpjam/sdk";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { KnowledgeBaseService } from "../src/core/services/knowledge-base-service.js";
import { LintService } from "../src/core/services/lint-service.js";
import { SERVER_ID, createAgent, hasOpenRouterKey, startServerIn, stopServer } from "./harness";

/**
 * Local statistical evals for tool routing, run entirely against the LLM and
 * the MCP server.
 *
 * These do not use EvalTest/EvalSuite: @mcpjam/sdk 10.x authenticates every
 * EvalTest/EvalSuite run with an MCPJam identity (run start plus a
 * per-iteration reservation) even when reporting is disabled, which would not
 * be local. The loop below is the same measurement - N iterations per case,
 * gated on aggregate accuracy - using only HostRunner, which has no MCPJam
 * involvement.
 */

// Statistical evals: N iterations per case. Override with EVAL_ITERATIONS.
const ITERATIONS = Number.parseInt(process.env.EVAL_ITERATIONS ?? "10", 10);

// Iterations of one case run in parallel; each gets a fresh runner so prompt
// histories stay independent.
const CONCURRENCY = 3;

const ACCURACY_THRESHOLD = 0.9;
const RUN_TIMEOUT_MS = 90_000;

const CASES = [
  {
    id: "create-feature-folder-routing",
    prompt: "Create a feature folder called onboarding for experiments.",
    tool: "create_feature_folder",
  },
  {
    id: "create-idea-routing",
    prompt: 'Create a draft experiment idea with slug "social-proof-banner".',
    tool: "create_idea",
  },
  {
    id: "reject-idea-routing",
    prompt: 'Reject the draft experiment idea "bad-checkout-idea".',
    tool: "reject_idea",
  },
  {
    id: "create-experiment-routing",
    prompt:
      'Create an experiment titled "Simplify signup form" with feature flag ' +
      'key "simplify-signup" in the onboarding feature.',
    tool: "create_experiment",
  },
  {
    id: "update-experiment-routing",
    prompt:
      'Mark the "referrals-nudge" experiment in the onboarding feature as ' +
      'ended with conclusion "won".',
    tool: "update_experiment",
  },
  {
    id: "lint-experiments-routing",
    prompt: "Lint the experiments in the .growth-eng/ knowledge base.",
    tool: "lint_experiments",
  },
] as const;

let manager: MCPClientManager;
let agent: HostRunner;
let sandbox: string;

describe.skipIf(!hasOpenRouterKey())("growth-eng tool-routing eval suite (local)", () => {
  beforeAll(async () => {
    // Iterations share the server, so it is booted in a throwaway sandbox
    // holding an initialized knowledge base with an 'onboarding' feature
    // folder and one experiment for the update-routing case to patch.
    sandbox = await mkdtemp(join(tmpdir(), "growth-eng-evals-"));
    await mkdir(join(sandbox, ".growth-eng", "images"), { recursive: true });
    await mkdir(join(sandbox, ".growth-eng", "ideas", "rejected"), {
      recursive: true,
    });
    await mkdir(join(sandbox, ".growth-eng", "specs", "onboarding"), {
      recursive: true,
    });
    await writeFile(
      join(sandbox, ".growth-eng", "_template_.md"),
      KnowledgeBaseService.getExperimentTemplate(),
    );
    await writeFile(join(sandbox, ".growth-eng", "lint-rules.json"), LintService.getDefaultRules());
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

  it(`routes feature folder, idea, experiment, and lint calls at >= ${(ACCURACY_THRESHOLD * 100).toFixed(0)}% over ${ITERATIONS} iterations each`, async () => {
    const perCase: Record<string, { passed: number; total: number }> = {};

    for (const { id, prompt, tool } of CASES) {
      perCase[id] = { passed: 0, total: 0 };

      for (let batchStart = 0; batchStart < ITERATIONS; batchStart += CONCURRENCY) {
        const batchSize = Math.min(CONCURRENCY, ITERATIONS - batchStart);
        const results = await Promise.all(
          Array.from({ length: batchSize }, () =>
            // withOptions({}) = fresh runner with its own prompt history
            agent.withOptions({}).run(prompt, {
              timeoutMs: RUN_TIMEOUT_MS,
            }),
          ),
        );

        for (const result of results) {
          perCase[id].total += 1;
          if (!result.hasError() && result.hasToolCall(tool)) {
            perCase[id].passed += 1;
          } else {
            console.log(`  [${id}] failed iteration: ${summarize(result)}`);
          }
        }

        console.log(
          `  eval progress: ${Math.min(batchStart + batchSize, ITERATIONS)}/${ITERATIONS} (${id})`,
        );
      }

      const { passed, total } = perCase[id];
      console.log(`  ${id}: ${((passed / total) * 100).toFixed(1)}%`);
    }

    const passedTotal = Object.values(perCase).reduce((sum, c) => sum + c.passed, 0);
    const totalIterations = Object.values(perCase).reduce((sum, c) => sum + c.total, 0);
    const accuracy = passedTotal / totalIterations;
    console.log(`  suite accuracy: ${(accuracy * 100).toFixed(1)}%`);

    expect(accuracy).toBeGreaterThanOrEqual(ACCURACY_THRESHOLD);
  }, 600_000);
});

function summarize(result: PromptResult): string {
  if (result.hasError()) {
    return `error: ${result.getError()}`;
  }
  const tools = result.toolsCalled().join(", ");
  return `called [${tools.length > 0 ? tools : "none"}]`;
}
