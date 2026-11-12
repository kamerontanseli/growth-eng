# Growth Eng MCP

Growth Eng MCP is a [Model Context Protocol](https://modelcontextprotocol.io) server built with [FastMCP](https://github.com/punkpeye/fastmcp) and [Bun](https://bun.sh). It exposes tools, prompts, and Agent Skills that let an AI agent act as a growth engineer: ideating, planning, shipping, linting, and visualizing experiments.

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

Once connected, the server's tools and prompts (`init`, `generate-experiment-idea`, `plan-experiment`, and `hypothesis-tree`) are available to the agent.

## Install the Skills

This repository ships Agent Skills in `.agents/skills/` following the [dotagents](https://github.com/bgreenwell/dotagents) convention. Install them into your project or coding agent with [`skills`](https://github.com/vercel-labs/skills):

```bash
npx skills add kamerontanseli/growth-eng
```

Or install a specific skill:

```bash
npx skills add kamerontanseli/growth-eng --skill generate-experiment-idea
npx skills add kamerontanseli/growth-eng --skill plan-experiment
npx skills add kamerontanseli/growth-eng --skill hypothesis-tree
```

### Available skills & MCP prompts

Every skill is also registered as an MCP prompt on the server so you can fetch and use it directly without installing the skills separately:

| Skill / Prompt | Usage & What it does |
|---|---|
| `/generate-experiment-idea <size of test=xs s m l xl> <focus area> <user provided details>` | Reads all experiments in `.growth-eng/` to understand what worked and hasn't worked, reasons from first principles (research, causal mechanics, systems thinking) to propose an experiment, builds HTML or ASCII mockups of control and treatment changes, stages draft ideas in `.growth-eng/ideas/<experiment-slug>.md`, and moves rejected ideas to `.growth-eng/ideas/rejected/<experiment-slug>.md` |
| `/plan-experiment` | Plans a new experiment by asking the user via the harness's `ask_question` tool for details needed to fill out `_template_.md` (or reuses `.growth-eng/ideas/<experiment-slug>.md` when called after `/generate-experiment-idea` and only asks for missing details), calls `create_experiment`, and writes the final experiment spec |
| `/hypothesis-tree` | Scans the entirety of `.growth-eng/` and creates a hypothesis tree HTML artifact / diagram showing how experiments lead from one to another, highlighting winning hypotheses in green, losing ones in red, and inconclusive ones in grey |

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
├── lint-rules.json # the rules experiments are linted against
├── images/         # control/variant screenshots and designs
├── ideas/          # drafting area for LLMs to write new experiment ideas
│   ├── <experiment>.md       # draft idea files
│   └── rejected/             # memory folder for rejected experiment specs ideas
└── specs/
    └── <feature>/            # one folder per feature, e.g. onboarding/
        └── <experiment>.md
```

Run the `init` prompt to bootstrap it. The MCP returns step-by-step instructions with the template and the default lint rules verbatim; the agent then creates the files, and never overwrites an existing `_template_.md` or `lint-rules.json`.

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
<Screenshot/design, if any: ../../images/<experiment>/control.png>

## Variants
| Variant | Description |
|---|---|
<Screenshots/designs, if any: ../../images/<experiment>/<variant>.png>

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

The server's tools cover the writes the harness can't do safely on its own, plus `lint_experiments`, which hands the agent the repository's lint rules and the scoring prompt; for reading and listing, the agent uses its own file tools (`read_file`, `ls`, `grep`) directly against `.growth-eng/`:

| Tool | What it does |
|---|---|
| `create_feature_folder` | Creates `.growth-eng/specs/<feature>/` |
| `create_idea` | Creates `.growth-eng/ideas/<experiment-slug>.md` from `_template_.md` and returns a prompt for the LLM to fill out the idea template |
| `reject_idea` | Moves `.growth-eng/ideas/<experiment-slug>.md` to `.growth-eng/ideas/rejected/<experiment-slug>.md` and returns a prompt instructing the LLM that the idea has been rejected and moved to that path |
| `create_experiment` | Copies `_template_.md` into `.growth-eng/specs/<feature>/<experiment>.md`, fills the frontmatter from the arguments, and returns the file path for the agent to fill in |
| `update_experiment` | Patches experiment frontmatter (the body is untouched, the file is never renamed) |
| `lint_experiments` | Returns the lint rules from `.growth-eng/lint-rules.json` plus the prompt to read every experiment, judge each rule, and score it |

`create_experiment` names the file after the feature flag key: `<feature_flag_key>.md`, or `<feature_flag_key>-MM-DD-YYYY.md` when the key already exists in the feature and a `start_date` is passed. Its frontmatter covers title, flag key, dates, status (`draft` / `running` / `ended`), conclusion, winning variant, and a free-form `custom` map.

Every tool checks its preconditions and, when one is missing, returns an error that tells the agent the next step: run the `init` prompt when the knowledge base, template, or lint rules are missing, or call `create_feature_folder` when the feature folder does not exist yet. `lint_experiments` also rejects a rules file that isn't valid JSON or holds a rule without a `lint_rule` description and a `severity` of `error` or `warning`, naming the offending rule.

Screenshots and designs live in `.growth-eng/images/<experiment>/` (for example `control.png` and `variant-a.png`), named after the experiment doc.

## Linting experiments

`lint_experiments` scores every experiment doc against the rules in `.growth-eng/lint-rules.json`. It returns the loaded rules (with a count by severity) and the scoring prompt; the agent then reads every experiment at `.growth-eng/specs/**/*.md` (excluding `_template_.md` and drafts in `ideas/`) with its own file tools, judges each rule per experiment, and reports:

- **Per experiment**: `Experiment Quality % = (rules followed / total rules) * 100`, with each broken rule named (id, severity, why it breaks) and what to change to follow it.
- **Overall**: the average of the per-experiment scores.

Every rule counts equally, whatever its severity: severity is shown in the breakdown but doesn't weight the score.

### Setting up your own rules

The rules file is a JSON object keyed by rule id. Each rule carries a `severity` (`error` or `warning`), the `lint_rule` the judge applies, and ideally a `bad_example` / `good_example` pair that shows the judge exactly where the line sits:

```json
{
  "hypothesis/is-falsifiable": {
    "severity": "error",
    "lint_rule": "The hypothesis must predict a specific observable outcome, so that a result could prove it wrong.",
    "bad_example": "The new setup checklist will increase activation.",
    "good_example": "Showing the setup checklist during signup will increase MCP installations amongst new users."
  },
  "team/has-an-owner": {
    "severity": "warning",
    "lint_rule": "The spec must name the team that owns the experiment.",
    "bad_example": "No owner is named anywhere in the spec.",
    "good_example": "The growth core team owns this experiment."
  }
}
```

To set up your own rules, edit `.growth-eng/lint-rules.json` in your repository: add, edit, or remove rules, and commit the file alongside the rest of the knowledge base. Re-running the `init` prompt never overwrites it. To restore the default ruleset (24 rules: 19 error, 5 warning, covering hypothesis, metrics, guardrails, variants, audience, randomization, power, duration, analysis, decision, and rollout), delete the file and run the `init` prompt again.

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

- `OPENROUTER_API_KEY` — required by the LLM tests. The agent runs [`openrouter/particle-ai/particle-1`](https://docs.mcpjam.com/sdk/reference/llm-providers#openrouter) on OpenRouter; tests that need the LLM skip when the key is absent.

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
.agents/
└── skills/               # Agent Skills (dotagents convention)
    ├── generate-experiment-idea/
    ├── plan-experiment/
    └── hypothesis-tree/
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
