# knowledge-base Specification

## Purpose
Bootstraps and defines the `.growth-eng/` knowledge base the growth-eng tools operate out of: the init prompt that creates it, the canonical experiment template every experiment derives from, and the layout convention for experiment docs and images.

## Requirements

### Requirement: Init prompt creates the knowledge base
The `init` prompt SHALL render step-by-step instructions that create the `.growth-eng/` knowledge base: the directory itself, an `_images/` directory kept in git via a `.gitkeep` file, and `_template_.md` written verbatim from the canonical experiment template.

#### Scenario: Fresh repository
- **WHEN** no `.growth-eng/` directory exists and the agent follows the init prompt
- **THEN** `.growth-eng/`, `.growth-eng/_images/.gitkeep`, and `.growth-eng/_template_.md` are created, with the template content written verbatim

#### Scenario: Knowledge base is durable
- **WHEN** the init instructions are rendered
- **THEN** they tell the agent not to add `.growth-eng/` to `.gitignore`, so the knowledge base is committed to the repository

### Requirement: Init is idempotent and never overwrites
The init prompt SHALL instruct the agent to treat an existing `_template_.md` as proof the knowledge base is already initialized, and MUST instruct the agent to never overwrite an existing `_template_.md`.

#### Scenario: Template already exists
- **WHEN** `.growth-eng/_template_.md` already exists
- **THEN** the init prompt instructs the agent to report that the knowledge base is already initialized and to write nothing

### Requirement: Canonical experiment template
The init prompt SHALL embed the canonical experiment template verbatim, and the server SHALL be the source of truth for its content. The template defines every experiment doc: frontmatter (title, feature flag key, start and end dates, status, conclusion, winning variant, custom field map) and the body sections Hypothesis, Research, Control, Variants, Sample size / MDE plan, Metrics (Goal, Measurement, Guardrails), Results, and Conclusion.

#### Scenario: Rendered prompt embeds the template
- **WHEN** the client fetches the `init` prompt
- **THEN** the rendered message contains the template content verbatim, with all frontmatter keys and body sections intact

#### Scenario: Documentation follows the server
- **WHEN** the template content is described anywhere in documentation
- **THEN** it matches the server's canonical template, which is the source of truth

### Requirement: Knowledge base layout
The knowledge base SHALL hold experiment docs at `.growth-eng/<feature>/<experiment>.md`, one folder per feature, with control and variant screenshots at `.growth-eng/_images/<experiment>/`, named after the experiment doc.

#### Scenario: Experiment doc location
- **WHEN** an experiment is added for a feature
- **THEN** its doc lives in that feature's folder under `.growth-eng/`, and its screenshots live in an `_images/` subfolder named after the experiment doc
