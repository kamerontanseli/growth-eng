# Design

## Context

The knowledge-base change bootstrapped `.growth-eng/` with the `init` prompt and the canonical template (see `specs/knowledge-base/`). The scaffold's demo tools were still the only registered surface. This change added the real write tools. See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**

- Focused tools with precise zod schemas — required fields enforced by the schema, not runtime unions.
- A guard chain where every error names the agent's next move (run `init` / call `create_feature_folder` / pass `start_date` or a new key).
- Frontmatter patching that preserves the template's inline comments.

**Non-Goals:**

- Reading and listing experiment docs — the agent's own file tools (`read_file`, `ls`, `grep`) cover them; the README states this division of labor.
- Deleting feature folders — destructive removal stays with the agent.
- Renaming experiment files — update patches frontmatter only.
- Nested custom values — scalars (string/number/boolean) only.

## Decisions

1. **Separate focused tools over an operation dispatcher.** Each operation gets its own precise zod schema; validation errors are schema-shaped and the LLM can self-correct from them. A dispatcher with a runtime union was rejected as fuzzier for routing and validation.
2. **Thin tools, logic in services.** `FeatureFolderService` and `ExperimentService` own the behavior; `tools.ts` only registers. Shared helpers (slug normalization, `.growth-eng` resolution, frontmatter split/patch) live in `kb-utils.ts`. Repo root is `process.cwd()` — MCP clients spawn the server in the repository root.
3. **Slug normalization on create and lookup.** Lowercase, collapse non-alphanumeric runs to a dash, trim dashes, error on empty. Applied to folder names, experiment names, and flag keys, so `Onboarding` ≡ `onboarding`, `.md` suffixes are stripped on lookup, and `../` traversal collapses into the slug — no path can escape the knowledge base.
4. **The filename is the feature flag key.** Duplicate key with a `start_date` renders `<key>-MM-DD-YYYY.md`; duplicate without one errors with the two ways forward. A dated collision errors too.
5. **Line-based frontmatter patch, no YAML serializer.** Known scalar keys are patched in place, preserving the template's inline comments; the `custom:` block is regenerated (`custom: {}` when empty, nested `key: value` otherwise); the body's `# <title>` is filled on create and never touched after. A YAML round-trip was rejected because it would strip the comments that document each field.
6. **`update_experiment` never renames and requires a patch.** Zod `.refine()` enforces "at least one field" at the schema level; unknown experiments error with a listing of what the folder holds.
7. **Seven planned tools shipped as three.** The original plan included `read_experiment`, `list_experiments`, `delete_experiment`, and `list_feature_folders`; implementation dropped them because the agent's own file tools already read and list, and destructive deletion belongs to the agent. The shipped README documents this: the server's tools cover the writes the harness can't do safely on its own.
8. **Tests boot the server in a sandbox.** `startServerIn(cwd)` in `tests/harness.ts` runs the real stdio server against a temp directory, so tool tests never touch this repository.

## Risks / Trade-offs

- Line-based patching is coupled to the template's shape → the template is a server-owned constant, and tests pin comment preservation and defaults on both create and update.
- `process.cwd()` assumes the server is spawned at the repo root → MCP clients do this, and tests pin the behavior from a sandbox cwd.
- Collision and guard errors could dead-end an agent → every error names the next move, and the agent/eval suites assert routing recovers from them.

## Migration Plan

Shipped as commit "feat: feature folder and experiment tools". No migration steps remain. This design is a reconstruction from the original plan record; where plan and shipped code differ (seven tools → three), the shipped behavior is authoritative.
