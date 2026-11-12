import { HostRunner, MCPClientManager } from "@mcpjam/sdk";
import { join } from "node:path";

/**
 * Server id used in the MCPClientManager config for the growth-eng stdio server.
 */
export const SERVER_ID = "growth-eng";

/**
 * The model the agent runs: particle-ai/particle-1 on OpenRouter.
 */
export const MODEL = "openrouter/particle-ai/particle-1";

/**
 * Whether an OpenRouter key is available. LLM-backed tests skip without it;
 * the direct-execution tests in tools.test.ts always run.
 */
export function hasOpenRouterKey(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

/**
 * Extract the text of a prompt rendered by `manager.getPrompt()`.
 */
export function promptText(prompt: unknown): string {
  const { messages = [] } = (prompt ?? {}) as {
    messages?: Array<{ content?: { text?: string } | string }>;
  };
  return messages
    .map((message) =>
      typeof message.content === "string" ? message.content : (message.content?.text ?? ""),
    )
    .join("\n\n");
}

/**
 * Absolute path to the stdio server entrypoint. The server resolves the
 * .growth-eng/ knowledge base against its working directory, so tests can
 * boot it rooted anywhere.
 */
const SERVER_ENTRY = join(import.meta.dir, "..", "src", "index.ts");

/**
 * Boot the growth-eng MCP server (src/index.ts) over stdio, rooted at cwd.
 * The server's tools operate on .growth-eng/ under its working directory,
 * so tests pass a throwaway sandbox instead of the repository itself.
 *
 * @param cwd Working directory for the server process. Defaults to the
 *   current directory.
 */
export async function startServerIn(cwd?: string): Promise<MCPClientManager> {
  const manager = new MCPClientManager({
    [SERVER_ID]: {
      command: "bun",
      args: ["run", SERVER_ENTRY],
      ...(cwd ? { cwd } : {}),
    },
  });
  await manager.connectToServer(SERVER_ID);
  return manager;
}

/**
 * Boot the growth-eng MCP server (src/index.ts) over stdio.
 */
export async function startServer(): Promise<MCPClientManager> {
  return startServerIn();
}

/**
 * Shut the server subprocess down.
 */
export async function stopServer(manager: MCPClientManager): Promise<void> {
  await manager.disconnectServer(SERVER_ID);
}

/**
 * A tool in the shape `MCPClientManager.getTools()` returns, so synthetic
 * tools (e.g. the file-system tools in init-prompt.test.ts) can join the
 * agent's toolset.
 */
export type SdkTool = Awaited<ReturnType<MCPClientManager["getTools"]>>[number];

/**
 * Build the LLM test agent wired to the growth-eng tools, plus any extra
 * synthetic tools the caller supplies.
 */
export async function createAgent(
  manager: MCPClientManager,
  extraTools: SdkTool[] = [],
): Promise<HostRunner> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not set. Put it in .env (see .env.example) or export it.",
    );
  }

  return new HostRunner({
    tools: [...(await manager.getTools()), ...extraTools],
    model: MODEL,
    apiKey,
    mcpClientManager: manager,
  });
}
