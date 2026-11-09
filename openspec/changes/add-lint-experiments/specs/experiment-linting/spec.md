# Spec Delta

## Purpose

Scores the experiment docs in the `.growth-eng/` knowledge base against a customizable ruleset, so experiment quality is measured the same way by every calling LLM.

## ADDED Requirements

### Requirement: Init creates the lint rules file
The init prompt SHALL instruct the agent to create `.growth-eng/lint-rules.json` with the server's default ruleset written verbatim, and MUST instruct the agent to never overwrite an existing rules file or an existing `_template_.md`.

#### Scenario: Fresh repository
- **WHEN** the knowledge base is empty and the agent follows the init prompt
- **THEN** both `.growth-eng/_template_.md` and `.growth-eng/lint-rules.json` are created with the server's default content verbatim

#### Scenario: Template exists, rules file missing
- **WHEN** `.growth-eng/_template_.md` exists and `.growth-eng/lint-rules.json` does not
- **THEN** the init prompt instructs the agent to create only the rules file and to leave the template untouched

#### Scenario: Both files exist
- **WHEN** both `.growth-eng/_template_.md` and `.growth-eng/lint-rules.json` exist
- **THEN** the init prompt tells the agent the knowledge base is already initialized and instructs it to write nothing

### Requirement: Rules file format
The rules file SHALL be a JSON object keyed by rule id. Each rule MUST have a `severity` of `error` or `warning` and a non-empty `lint_rule` description; `bad_example` and `good_example` are optional string fields that guide the judge.

#### Scenario: Valid custom rules
- **WHEN** the rules file is a JSON object whose rules each carry a valid severity and a non-empty lint_rule description
- **THEN** the rules are accepted and linting runs against them

#### Scenario: Invalid rule shape
- **WHEN** a rule in the file is missing its lint_rule description or carries a severity other than error or warning
- **THEN** the lint tool returns an error naming the offending rule and what is wrong with it

### Requirement: Lint tool returns rules and scoring prompt
The `lint_experiments` tool SHALL take no arguments and return the rules from the repository's `.growth-eng/lint-rules.json` together with a scoring prompt telling the calling LLM to read every experiment doc at `.growth-eng/**/*.md` (excluding `_template_.md`) and judge each rule per experiment.

#### Scenario: Initialized knowledge base
- **WHEN** the tool is called and the rules file exists and is valid
- **THEN** the result states how many error and warning rules were loaded, embeds the rules verbatim, and includes the scoring prompt

#### Scenario: Customized rules apply
- **WHEN** the repository's rules file has been edited with custom rules
- **THEN** the tool returns the customized rules from the file, not the server's defaults

### Requirement: Lint preconditions
The lint tool SHALL check its preconditions and return an error that names the next step.

#### Scenario: Uninitialized knowledge base
- **WHEN** no `.growth-eng/` directory exists
- **THEN** the tool returns an error telling the agent to run the `init` prompt

#### Scenario: Rules file missing
- **WHEN** `.growth-eng/` exists but `.growth-eng/lint-rules.json` does not
- **THEN** the tool returns an error telling the agent to run the `init` prompt to create it

#### Scenario: Malformed JSON
- **WHEN** the rules file does not parse as JSON
- **THEN** the tool returns an error naming the file and instructing the agent to fix it

### Requirement: Score semantics
The scoring prompt SHALL instruct the calling LLM to score each experiment as `Experiment Quality % = (rules followed / total rules) * 100`, where every rule counts equally regardless of severity, and to report an overall score as the average of the per-experiment scores.

#### Scenario: Multiple experiments
- **WHEN** the knowledge base holds more than one experiment doc
- **THEN** the prompt instructs the LLM to report one score per experiment plus an overall average

#### Scenario: No experiments
- **WHEN** the knowledge base holds no experiment docs besides `_template_.md`
- **THEN** the prompt instructs the LLM to report that there is nothing to lint rather than a score

### Requirement: Custom rules are documented
The README SHALL document how to set up custom lint rules: the rules file location, the rule format, and that editing the file customizes what `lint_experiments` returns.

#### Scenario: Reader customizes the ruleset
- **WHEN** a reader follows the README's linting section
- **THEN** they can add, edit, or remove rules in `.growth-eng/lint-rules.json`, and know the file is committed to the repository and never overwritten by re-running init
