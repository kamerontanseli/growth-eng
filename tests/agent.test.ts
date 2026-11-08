import { matchToolCalls } from "@mcpjam/sdk";
import type { HostRunner, MCPClientManager } from "@mcpjam/sdk";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import {
  MODEL,
  REASONING_EFFORT,
  createAgent,
  hasOpenRouterKey,
  startServer,
  stopServer,
} from "./harness";

let manager: MCPClientManager;
let agent: HostRunner;

describe.skipIf(!hasOpenRouterKey())(
  `${MODEL} tool selection (${REASONING_EFFORT} reasoning)`,
  () => {
    beforeAll(async () => {
      manager = await startServer();
      agent = await createAgent(manager);
    }, 60_000);

    afterAll(async () => {
      await stopServer(manager);
    });

    it("calls hello_world with the right name", async () => {
      const result = await agent.run("Say hello to Ada.");

      expect(result.hasError()).toBe(false);
      expect(result.hasToolCall("hello_world")).toBe(true);
      expect(result.getToolArguments("hello_world")).toMatchObject({
        name: "Ada",
      });
      expect(result.text).toContain("Ada");
    }, 120_000);

    it("calls goodbye with the right name", async () => {
      const result = await agent.run("Time to wrap up, say goodbye to Ada.");

      expect(result.hasError()).toBe(false);
      expect(matchToolCalls(["goodbye"], result.toolsCalled())).toBe(true);
      expect(result.getToolArguments("goodbye")).toMatchObject({
        name: "Ada",
      });
    }, 120_000);

    it("does not call tools for an unrelated question", async () => {
      const result = await agent.run(
        "What is the capital of France? Answer directly.",
      );

      expect(result.hasToolCall("hello_world")).toBe(false);
      expect(result.hasToolCall("goodbye")).toBe(false);
      expect(result.text.toLowerCase()).toContain("paris");
    }, 120_000);
  },
);
