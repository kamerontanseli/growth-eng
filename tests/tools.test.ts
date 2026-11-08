import { assertCallToolResult } from "@mcpjam/sdk";
import type { MCPClientManager } from "@mcpjam/sdk";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { KnowledgeBaseService } from "../src/core/services/knowledge-base-service.js";
import { SERVER_ID, promptText, startServer, stopServer } from "./harness";

let manager: MCPClientManager;

beforeAll(async () => {
  manager = await startServer();
}, 30_000);

afterAll(async () => {
  await stopServer(manager);
});

describe("growth-eng MCP server (direct execution, no LLM)", () => {
  it("exposes the hello_world and goodbye tools", async () => {
    const { tools } = await manager.listTools(SERVER_ID);
    expect(tools.map((t) => t.name).sort()).toEqual(["goodbye", "hello_world"]);
  });

  it("hello_world greets by name", async () => {
    const result = assertCallToolResult(
      await manager.executeTool(SERVER_ID, "hello_world", { name: "Ada" }),
    );
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: "Hello, Ada! Welcome to the MCP Server.",
    });
  });

  it("goodbye bids farewell by name", async () => {
    const result = assertCallToolResult(
      await manager.executeTool(SERVER_ID, "goodbye", { name: "Ada" }),
    );
    expect(result.content[0]).toMatchObject({
      type: "text",
      text: "Goodbye, Ada! Thank you for using the MCP Server.",
    });
  });

  it("exposes the greeting and init prompts", async () => {
    const { prompts } = await manager.listPrompts(SERVER_ID);
    expect(prompts.map((p) => p.name).sort()).toEqual(["greeting", "init"]);
  });

  it("greeting prompt renders with the name argument", async () => {
    const prompt = await manager.getPrompt(SERVER_ID, {
      name: "greeting",
      arguments: { name: "Ada" },
    });
    expect(JSON.stringify(prompt)).toContain("Hello, Ada!");
  });

  it("init prompt embeds the experiment template verbatim", async () => {
    const prompt = await manager.getPrompt(SERVER_ID, { name: "init" });
    const text = promptText(prompt);

    expect(text).toContain(
      "Initialize the growth-eng knowledge base in this repository",
    );
    expect(text).toContain("Create .growth-eng/_template_.md");
    // The template must ride in the prompt verbatim, so an agent following it
    // can write the file byte-for-byte. The canonical file ends with a newline
    // the fenced block does not carry.
    expect(text).toContain(
      KnowledgeBaseService.getExperimentTemplate().replace(/\n+$/, ""),
    );
  });

  it("example resource template renders by id", async () => {
    const content = await manager.readResource(SERVER_ID, {
      uri: "example://42",
    });
    expect(JSON.stringify(content)).toContain(
      "This is an example resource with ID: 42",
    );
  });
});
