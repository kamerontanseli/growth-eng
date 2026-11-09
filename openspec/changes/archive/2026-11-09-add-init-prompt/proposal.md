# Proposal

## Why

Before any tool could operate, the server needed a way to bootstrap the `.growth-eng/` knowledge base. The server runs over stdio, launched through `npx`/`bunx` straight from GitHub, so having the server itself write files would depend on fragile working-directory assumptions. The design that fits: the MCP is the brain, the agent is the hands — the server returns instructions, and the agent writes the files with its own file tools.

## What Changes

- New `init` prompt (no arguments) whose rendered content carries step-by-step bootstrap instructions for creating the knowledge base.
- Creates `.growth-eng/`, `.growth-eng/_images/` (with a `.gitkeep` file, since git does not track empty directories), and `.growth-eng/_template_.md` written verbatim from the canonical experiment template.
- Idempotent by instruction: an existing `_template_.md` means the knowledge base is already initialized; nothing is ever overwritten.
- Instructs the agent not to add `.growth-eng/` to `.gitignore` — the knowledge base is durable and belongs in the repository.
- The canonical experiment template lives in the server as the source of truth; `create_experiment` later copies it per experiment.
- README section documenting the `init` prompt and the knowledge-base layout.

## Capabilities

### New Capabilities

- `knowledge-base`: bootstrapping and defining the `.growth-eng/` knowledge base — the init prompt that creates it, the canonical experiment template every experiment derives from, and the layout convention for experiment docs and images.

### Modified Capabilities

<!-- None: the project had no specs before this change. -->

## Impact

- `src/core/services/knowledge-base-service.ts` (new): template constant, `getExperimentTemplate()`, `generateInitInstructions()`.
- `src/core/services/index.ts`: export the new service.
- `src/core/prompts.ts`: register the `init` prompt.
- `README.md`: knowledge-base section.

## Migration Note

This change is a reconstruction of already-shipped work (`git` history: "feat: init prompt"), migrated from the original record at `.factory/docs/2026-11-08-add-init-prompt-that-bootstraps-the-growth-eng-knowledge-base.md`. The tasks below are marked complete because the work is live in the repository. Where the original plan and shipped code differ, the shipped behavior is authoritative: the template's custom fields ship as a map (`custom: {}`), not the list (`custom: []`) sketched in the original plan.
