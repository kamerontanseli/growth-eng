import { FastMCP } from "fastmcp";
import { z } from "zod";
import * as services from "./services/index.js";

/**
 * Register all prompts with the MCP server
 * @param server The FastMCP server instance
 */
export function registerPrompts(server: FastMCP) {
  // Example prompt
  server.addPrompt({
    name: "greeting",
    description: "A simple greeting prompt",
    arguments: [
      {
        name: "name",
        description: "Name to greet",
        required: true,
      },
    ],
    load: async ({ name }) => {
      return `Hello, ${name}! How can I help you today?`;
    },
  });

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
