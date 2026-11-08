# Growth Eng MCP

A framework that's used internally at FLORA to power autonomous growth engineers that plan, build, and run experiments for your app 24/7.

Growth Eng MCP is a [Model Context Protocol](https://modelcontextprotocol.io) server built with [FastMCP](https://github.com/punkpeye/fastmcp) and [Bun](https://bun.sh). It exposes tools, prompts, and resources that let an AI agent act as a growth engineer: ideating, shipping, and measuring experiments without human intervention.

## Install the MCP

The package isn't published to npm. `npx`/`bunx` install it straight from GitHub, so setup is a single command:

```bash
npx -y github:kamerontanseli/growth-eng
```

### Requirements

- [Bun](https://bun.sh) v1.0 or later, on your `PATH` — the executable is TypeScript with a `bun` shebang, so Bun is required even when the server is launched through `npx`

### Connect to your MCP client

The server communicates over stdio.

**Claude Code**

```bash
claude mcp add growth-eng -- npx -y github:kamerontanseli/growth-eng
```

**Claude Desktop / Cursor / other clients**

Add the following to your `claude_desktop_config.json` (or equivalent MCP config):

```json
{
  "mcpServers": {
    "growth-eng": {
      "command": "npx",
      "args": ["-y", "github:kamerontanseli/growth-eng"]
    }
  }
}
```

If you'd rather skip the npm layer, use `bunx` instead:

```json
{
  "mcpServers": {
    "growth-eng": {
      "command": "bunx",
      "args": ["github:kamerontanseli/growth-eng"]
    }
  }
}
```

Once connected, the server's tools (like `hello_world` and `goodbye`), prompts, and resources are available to the agent.

### Run from source

```bash
git clone https://github.com/kamerontanseli/growth-eng.git
cd growth-eng
bun install
bun start   # stdio server
```

### Run over HTTP (optional)

For setups where stdio isn't an option, the server also supports SSE transport:

```bash
bun run start:http
```

By default it listens on `http://localhost:3001` with the SSE endpoint at `/sse`. Set the `PORT` environment variable to change the port:

```bash
PORT=8080 bun run start:http
```

## Development

```bash
bun run dev        # Start the stdio server with auto-reload
bun run dev:http   # Start the HTTP server with auto-reload
bun run lint       # Lint with oxlint
bun run fmt        # Format with oxfmt
bun run build      # Build to ./build
```

## Project structure

```
src/
├── index.ts              # stdio entrypoint
├── server/
│   ├── server.ts         # FastMCP server setup and registration
│   └── http-server.ts    # SSE transport entrypoint
└── core/
    ├── tools.ts          # Tool definitions
    ├── prompts.ts        # Prompt definitions
    ├── resources.ts      # Resource definitions
    └── services/         # Business logic behind the tools
```

To add a capability, define the logic in a service under `src/core/services/`, then register a tool, prompt, or resource in `src/core/tools.ts`, `prompts.ts`, or `resources.ts`.
