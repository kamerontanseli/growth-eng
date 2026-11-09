import { FastMCP } from "fastmcp";
import * as services from "./services/index.js";

/**
 * Register all prompts with the MCP server
 *
 * @param server The FastMCP server instance
 */
export function registerPrompts(server: FastMCP) {
  // Initialize the .growth-eng/ knowledge base
  server.addPrompt({
    name: "init",
    description: "Initialize the .growth-eng/ knowledge base the MCP operates out of",
    arguments: [],
    load: async () => {
      return services.KnowledgeBaseService.generateInitInstructions();
    },
  });
}
