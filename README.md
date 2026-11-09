# Growth Eng MCP

Growth Eng MCP is a [Model Context Protocol](https://modelcontextprotocol.io) server built with [FastMCP](https://github.com/punkpeye/fastmcp) and [Bun](https://bun.sh). It exposes tools and prompts that let an AI agent act as a growth engineer: ideating, shipping, and measuring experiments without human intervention.

Based on [mcpdotdirect/template-mcp-server](https://github.com/mcpdotdirect/template-mcp-server).

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

Once connected, the server's tools and the `init` prompt are available to the agent.

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

## The knowledge base

The framework operates out of a `.growth-eng/` directory in your repository:

```
.growth-eng/
├── _template_.md   # the canonical experiment template
├── _images/        # control/variant screenshots and designs
└── <feature>/      # one folder per feature, e.g. onboarding/
    └── <experiment>.md
```

Run the `init` prompt to bootstrap it. The MCP returns step-by-step instructions and the template verbatim; the agent then creates the files, and never overwrites an existing `_template_.md`.

This is the canonical template the init prompt writes to `_template_.md` (the server, not this README, is the source of truth — it lives in `src/core/services/knowledge-base-service.ts`):

```markdown
---
title: ""
feature_flag_key: ""
start_date: ""
end_date: ""
status: draft              # draft | running | ended
conclusion: ""             # won | loss | inconclusive | stopped_early | invalid
winning_variant: ""        # e.g. control, treatment, ...
# Free-form map of custom fields, e.g.
#   custom_field: 123
custom: {}
---

# <title>

## Hypothesis
We believe <change> will <effect> because <insight>.

## Research
<Evidence, prior data, user insights driving this experiment.>

## Control
<The existing experience all variants are measured against.>
<Screenshot/design, if any: ../_images/<experiment>/control.png>

## Variants
| Variant | Description |
|---|---|
<Screenshots/designs, if any: ../_images/<experiment>/<variant>.png>

## Sample size / MDE plan
<Planned sample size, minimum detectable effect, power, alpha, runtime.>

## Metrics
### Goal
<Primary metric this experiment must move.>

### Measurement
<How the metric is measured: instrumentation, attribution window.>

### Guardrails
<Metrics that must not degrade.>

## Results
| Variant | Metric | Value | Delta | Confidence |
|---|---|---|---|---|

## Conclusion
<What we learned and what we do next.>
```

Every experiment is a copy of this template: `create_experiment` fills in the frontmatter from the tool arguments (keeping the inline comments) and replaces `# <title>` with the experiment's title; the rest is for the agent to fill out.

## Tools

The server's tools cover the writes the harness can't do safely on its own; for reading and listing, the agent uses its own file tools (`read_file`, `ls`, `grep`) directly against `.growth-eng/`:

| Tool | What it does |
|---|---|
| `create_feature_folder` | Creates `.growth-eng/<feature>/` |
| `create_experiment` | Copies `_template_.md` into a feature folder, fills the frontmatter from the arguments, and returns the file path for the agent to fill in |
| `update_experiment` | Patches experiment frontmatter (the body is untouched, the file is never renamed) |

`create_experiment` names the file after the feature flag key: `<feature_flag_key>.md`, or `<feature_flag_key>-MM-DD-YYYY.md` when the key already exists in the feature and a `start_date` is passed. Its frontmatter covers title, flag key, dates, status (`draft` / `running` / `ended`), conclusion, winning variant, and a free-form `custom` map.

Every tool checks its preconditions and, when one is missing, returns an error that tells the agent the next step: run the `init` prompt when the knowledge base or template is missing, or call `create_feature_folder` when the feature folder does not exist yet.

Screenshots and designs live in `.growth-eng/_images/<experiment>/` (for example control.png and variant-a.png), named after the experiment doc.

## Testing

Tests use [`@mcpjam/sdk`](https://docs.mcpjam.com/sdk/quickstart) and Bun's built-in test runner, with the MCP server booted over stdio by the test harness (`tests/harness.ts`).

```bash
bun test            # everything: direct tool tests + LLM agent tests + evals
bun test tests/tools.test.ts         # direct tool execution, no LLM needed
bun test tests/agent.test.ts         # LLM tool-selection tests
bun test tests/init-prompt.test.ts   # user-selected init prompt is rendered by the client and drives the agent to create .growth-eng/ and write _template_.md in a sandbox
bun test tests/evals.test.ts         # statistical eval suite
```

Configuration lives in `.env` (see `.env.example`):

- `OPENROUTER_API_KEY` — required by the LLM tests. The agent runs `openai/gpt-6-luna` on OpenRouter with medium reasoning; tests that need the LLM skip when the key is absent.

Everything runs locally: no MCPJam account or key is involved. The statistical evals run N iterations per case (10 by default, override with `EVAL_ITERATIONS`) and gate on 90% aggregate tool-routing accuracy.

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
    ├── utils.ts          # Shared string utilities
    └── services/         # Business logic behind the tools
```

To add a capability, define the logic in a service under `src/core/services/`, then register a tool or prompt in `src/core/tools.ts` or `prompts.ts`.
