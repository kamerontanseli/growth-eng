# Proposal

## Why

With the knowledge base bootstrapped, agents had no safe way to create experiment docs: copying the template and patching its frontmatter is exactly the kind of write an LLM harness should not improvise, and the scaffold's demo tools (`hello_world`, `goodbye`, a `greeting` prompt, an `example` resource) did no real work. Focused tools with precise schemas replace them.

## What Changes

- Three focused tools replace the demo tools, prompt, and resource: `create_feature_folder`, `create_experiment`, `update_experiment`.
- `create_feature_folder` creates `.growth-eng/<name>/` with the name normalized to lowercase letters, numbers, and dashes, and refuses duplicates.
- `create_experiment` copies the canonical template into a feature folder, fills the frontmatter from the arguments, names the file after the feature flag key, disambiguates a duplicate key with the start date (`<key>-MM-DD-YYYY.md`), and returns the path for the agent to fill in the markdown body.
- `update_experiment` patches only the frontmatter fields passed (at least one required), leaves the body untouched, and never renames the file.
- Every guard error names the agent's next move: run the `init` prompt, call `create_feature_folder`, or pass a `start_date` / different flag key.
- Template fix: custom fields become a map (`custom: {}`), matching the create default.
- Reading and listing stay with the agent's own file tools — the read/list/delete tools from the original plan were not shipped.

## Capabilities

### New Capabilities

- `experiment-docs`: creating and maintaining experiment docs and their feature folders in the `.growth-eng/` knowledge base — the three write tools, name normalization, frontmatter patching, and the guard-chain errors.

### Modified Capabilities

<!-- None: the knowledge-base spec covers init and the template; this change adds new behavior without altering it. -->

## Impact

- `src/core/tools.ts`: register the three tools; drop `hello_world` / `goodbye`.
- `src/core/services/experiment-service.ts` (new), `src/core/services/feature-folder-service.ts` (new), `src/core/services/kb-utils.ts` (new shared helpers), `src/core/services/index.ts`.
- `src/core/prompts.ts`: drop the `greeting` prompt; `src/server/server.ts`: drop the example resource wiring.
- `tests/harness.ts`: `startServerIn(cwd)` for sandboxed runs; `tests/tools.test.ts`, `tests/agent.test.ts`, `tests/evals.test.ts` rewritten for the new surface.
- `README.md`: tools table, the reads-stay-with-the-agent philosophy, the guard chain.

## Migration Note

This change is a reconstruction of already-shipped work (`git` history: "feat: feature folder and experiment tools"), migrated from the original record at `.factory/docs/2026-11-08-feature-folder-and-experiment-crud-tools.md`. The tasks below are marked complete because the work is live in the repository. The original plan sketched seven tools; the shipped surface is three — read, list, and delete were dropped because the agent's own file tools already cover reads, and destructive deletion was left to the agent deliberately. The shipped behavior is authoritative.
