# Design

## Context

The server is a FastMCP + Bun stdio server, launched through `npx`/`bunx` straight from GitHub (see `proposal.md` - Why). It grew out of the template-mcp-server scaffold, whose demo greeting service defined the service class pattern. The knowledge base needed bootstrapping before any experiment tooling could exist.

## Goals / Non-Goals

**Goals:**

- One command (`init`) that turns any repository into a growth-eng workspace, with no server-side filesystem writes.
- A canonical experiment template owned by the server, so every experiment starts from the same structure.

**Non-Goals:**

- Creating feature folders or experiments — that came later in the experiment-tools change.
- Server-side state: the server holds constants and returns text; it never touches the repo.

## Decisions

1. **Init is a prompt, not a tool.** Prompts are user-guided templates: the user selects `/init`, the client renders the messages, and the agent executes them with its own file tools. The alternative — server-side `mkdir`/`writeFile` — was rejected because the server's working directory is unreliable under `npx`-launched installs, and because the division of labor (MCP is the brain, agent is the hands) keeps the server stateless and safe.
2. **The template is a string constant in the service.** `EXPERIMENT_TEMPLATE` lives in `knowledge-base-service.ts`; `getExperimentTemplate()` exposes it; the init prompt embeds it verbatim in a fenced block. The server, not the README, is the source of truth — documentation quotes it, tests pin it.
3. **Idempotency by instruction.** A prompt cannot check preconditions server-side, so the instructions themselves carry the guard: if `_template_.md` exists, report already-initialized and stop. The instructions also forbid overwriting, which the later file-writing tools adopted as a hard rule.
4. **`_images/` gets a `.gitkeep`.** Git does not track empty directories; the placeholder keeps the screenshots folder in the repo from day one.
5. **The knowledge base is committed.** The instructions explicitly say not to add `.growth-eng/` to `.gitignore` — experiment docs are durable records, not build artifacts.
6. **Image paths in the template are relative** (`../_images/<experiment>/...`) because experiment docs live in `<feature>/` subfolders.

## Risks / Trade-offs

- An LLM following the instructions can deviate (skip a step, reformat the template) → the init prompt e2e test pins the outcome in a sandbox, and the no-LLM contract tests pin the rendered content; trailing-newline drift is tolerated in the e2e comparison because models reliably add or drop a final newline.
- Template drift between README, server, and written files → the server constant is the single source; README and tests both point at it.
- The shipped `.gitignore` lists `.growth-eng/` under build output, which contradicts decision 5; that tension predates this migration and is left as-is in the record.

## Migration Plan

Shipped as commit "feat: init prompt". No migration steps remain. This design doc is a reconstruction from the original plan record; where plan and shipped code differ, the shipped behavior is authoritative (notably `custom: {}` as a map, fixed in the experiment-tools change).
