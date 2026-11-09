# Spec Delta

## Purpose

Creates and maintains experiment docs and their feature folders in the `.growth-eng/` knowledge base through focused write tools, with guard errors that always name the agent's next move.

## ADDED Requirements

### Requirement: Feature folder creation
The `create_feature_folder` tool SHALL create `.growth-eng/<name>/` with the name normalized to lowercase letters, numbers, and dashes, and MUST refuse to create a folder that already exists.

#### Scenario: Create and normalize
- **WHEN** `create_feature_folder` is called with the name "Onboarding"
- **THEN** the folder is created at `.growth-eng/onboarding/`

#### Scenario: Duplicate refused
- **WHEN** the normalized folder already exists
- **THEN** the tool returns an error saying the folder already exists

#### Scenario: Name cannot be normalized
- **WHEN** the name normalizes to an empty slug
- **THEN** the tool returns an error asking for a name like 'onboarding'

### Requirement: Experiment creation
The `create_experiment` tool SHALL copy the canonical template into the feature folder with its frontmatter filled from the arguments, name the file after the feature flag key, and return the path for the agent to fill in the markdown body. Dates use YYYY-MM-DD; status defaults to `draft`, conclusion and winning variant default to empty, and custom fields default to an empty map.

#### Scenario: Create with defaults
- **WHEN** `create_experiment` is called with feature, title, and feature flag key
- **THEN** the experiment doc is created at `.growth-eng/<feature>/<flag-key>.md` with the frontmatter filled, the template's inline comments preserved, `# <title>` replaced with the title, and the body left for the agent

#### Scenario: Duplicate flag key with a start date
- **WHEN** an experiment with the same flag key exists in the feature and a start date is passed
- **THEN** the doc is created as `<flag-key>-MM-DD-YYYY.md` using the start date

#### Scenario: Duplicate flag key without a start date
- **WHEN** an experiment with the same flag key exists and no start date is passed
- **THEN** the tool returns an error telling the agent to pass a start date or a different flag key

#### Scenario: Feature folder missing
- **WHEN** the feature folder does not exist
- **THEN** the tool returns an error telling the agent to call `create_feature_folder` first

#### Scenario: Knowledge base or template missing
- **WHEN** `.growth-eng/` or `_template_.md` does not exist
- **THEN** the tool returns an error telling the agent to run the `init` prompt

### Requirement: Experiment frontmatter update
The `update_experiment` tool SHALL patch only the frontmatter fields passed, leave the markdown body untouched, and never rename the file. It MUST require at least one patch field and MUST error on an unknown experiment.

#### Scenario: Patch fields
- **WHEN** `update_experiment` is called with a status and conclusion
- **THEN** only those frontmatter fields change and the body is untouched

#### Scenario: No patch fields
- **WHEN** `update_experiment` is called without any patchable field
- **THEN** the schema rejects the call, listing the patchable fields

#### Scenario: Unknown experiment
- **WHEN** the named experiment does not exist in the feature folder
- **THEN** the tool returns an error listing the experiments the folder does contain

### Requirement: Names are normalized everywhere
Names and keys SHALL be normalized on creation and lookup — lowercase, runs of non-alphanumeric characters collapsed to a single dash, dashes trimmed — so the same name always resolves to the same slug and no name can point outside the knowledge base.

#### Scenario: Path traversal neutralized
- **WHEN** a name or key contains path separators or parent-directory segments
- **THEN** normalization collapses them into the slug and the resolved path stays inside `.growth-eng/`
