import { readFile } from "node:fs/promises";
import { lines } from "../utils.js";
import { LINT_RULES_FILE, requireLintRulesPath } from "./kb-utils.js";

/**
 * The default lint ruleset, stored at .growth-eng/lint-rules.json by the
 * init prompt. Every experiment is judged against the rules in that file,
 * so a repository can customize its rules by editing it. The constant holds
 * the JSON verbatim: the init prompt embeds it in a fenced block for the
 * agent to write byte-for-byte, and JSON.stringify would normalize away the
 * blank lines between the rule groups.
 */
const DEFAULT_LINT_RULES = `{
  "hypothesis/is-falsifiable": {
    "severity": "error",
    "lint_rule": "The hypothesis must predict a specific observable outcome, so that a result could prove it wrong. A hypothesis phrased as a hope, such as 'this will improve the experience', with no prediction a result could contradict, breaks this rule.",
    "bad_example": "The new setup checklist will increase activation.",
    "good_example": "Showing the setup checklist during signup will increase MCP installations amongst new users."
  },
  "hypothesis/names-metric-and-direction": {
    "severity": "error",
    "lint_rule": "The hypothesis must name the metric it expects to move and the direction of the expected change, for example 'increases checkout completion'. A hypothesis that only says something will be better or will improve breaks this rule, because no particular result could contradict it.",
    "bad_example": "The new pricing page will increase subscription purchases among new signups.",
    "good_example": "The new pricing page will increase subscription conversion rate by at least 10% for new organization sign ups."
  },
  "hypothesis/explains-the-mechanism": {
    "severity": "warning",
    "lint_rule": "The hypothesis must explain why the change should alter user behaviour, naming the reasoning that connects the change to the outcome. A hypothesis that states a prediction alone, with no cause behind it, breaks this rule.",
    "bad_example": "Adding reviews to product pages will increase add-to-cart rate.",
    "good_example": "Adding recent reviews beside the price will increase add-to-cart rate because shoppers can judge quality at the moment they decide, which lowers the hesitation that currently sends them back to search results."
  },
  "hypothesis/is-based-on-evidence": {
    "severity": "error",
    "lint_rule": "The spec must point to the evidence behind the hypothesis, such as research, analytics, support tickets, or a previous experiment result. A hypothesis with no evidence named anywhere in the spec breaks this rule, since the change would rest on an idea someone wanted to ship.",
    "bad_example": "We want to try a shorter signup form because the current one feels long.",
    "good_example": "Support logged 214 tickets last quarter from users who abandoned signup at the address step, and funnel data shows 38% of starters leave on that step, so testing a shorter form should push more users to the final step and increase completion rate."
  },

  "metrics/has-one-primary-metric": {
    "severity": "error",
    "lint_rule": "The spec must name exactly one primary metric, which is the single number the experiment will be judged on. A spec that names several metrics as primary, or names none, breaks this rule.",
    "bad_example": "Success will be judged on signups, revenue, retention, and support tickets, with all four treated as primary.",
    "good_example": "The experiment will be judged on one primary metric, checkout completion rate, while signups and revenue are tracked to help explain the results of the experiment."
  },
  "metrics/primary-metric-measures-behaviour": {
    "severity": "warning",
    "lint_rule": "The primary metric must measure what users do, such as a completed action, a payment, or a returning session. A survey score, a stated intention, or a sentiment rating as the primary metric breaks this rule unless the spec justifies it and puts a behavioural measure beside it.",
    "bad_example": "The primary metric is the average satisfaction score from the post-purchase survey.",
    "good_example": "The primary metric is repeat purchase rate, the share of buyers who place a second order within 30 days."
  },

  "guardrails/are-listed": {
    "severity": "error",
    "lint_rule": "The spec must list the guardrail metrics the change must not damage, such as latency, error rate, retention, or revenue. A spec with no guardrail named anywhere breaks this rule, whatever else it covers.",
    "bad_example": "We will watch overall health while the experiment runs.",
    "good_example": "Guardrails are page latency, checkout error rate, and 7-day retention, and each one is reviewed alongside the primary metric before any launch decision."
  },
  "guardrails/have-launch-thresholds": {
    "severity": "error",
    "lint_rule": "Each guardrail must state the degradation that would block a launch, as a number or a bound rather than a direction to keep an eye on. A guardrail named with no threshold breaks this rule, because the decision would then depend on how convincing the primary result looks.",
    "bad_example": "Guardrails are latency and error rate, and we will keep an eye on both during the test.",
    "good_example": "The launch is blocked if p95 latency rises by more than 50ms or checkout errors rise by more than 0.2 percentage points against control."
  },

  "variants/control-is-described": {
    "severity": "error",
    "lint_rule": "The spec must describe the control experience in enough detail that a reader who has never seen it can tell what users see today: the options offered, the layout, and the call to action. A control named only as 'the current page' or 'existing behaviour' breaks this rule.",
    "bad_example": "Control: the current page.",
    "good_example": "Control: the current settings page, which shows a vertical list of toggles with Save at the bottom and a single blue Upgrade button in the header."
  },
  "variants/each-differs-from-control-stated": {
    "severity": "error",
    "lint_rule": "Each variant must state exactly what differs from the control, in content, layout, or behaviour, so the tested change is unambiguous. A variant described only by a name, or one whose difference a reader has to infer, breaks this rule.",
    "bad_example": "Variant B: the new design.",
    "good_example": "Variant B keeps the control layout and changes only the header call to action from Upgrade to See plans, with the destination page unchanged."
  },
  "variants/multi-change-bundles-are-labelled": {
    "severity": "error",
    "lint_rule": "When a variant changes more than one thing, the spec must say so and treat the result as evidence about the bundle, since the effect of a single change cannot be separated afterwards. A spec that leaves a variant's scope unstated, so a reader cannot tell whether one change or several is being tested, breaks this rule.",
    "bad_example": "Variant B refreshes the signup page.",
    "good_example": "Variant B changes the headline and shortens the form together, so this test treats the pair as one bundle and the result will be read as evidence about the bundle as a whole."
  },

  "audience/has-exclusion-criteria": {
    "severity": "warning",
    "lint_rule": "The spec must state who is left out, such as employees, bots, or users in regions with legal restrictions, and why they are left out. A spec that names no exclusion at all breaks this rule.",
    "bad_example": "The experiment will run for all users.",
    "good_example": "Employees, automated traffic, and users in the EU beta cohort are excluded, with employees and bots left out to keep internal use from skewing the rates and the beta cohort left out while its legal review is open."
  },

  "randomization/states-the-unit": {
    "severity": "error",
    "lint_rule": "The spec must name the randomization unit, such as user, session, or cluster, and the choice must match how the product is used. A spec that never says what gets randomized breaks this rule, since every rate in the analysis depends on that choice.",
    "bad_example": "Traffic will be split evenly and results compared between the two groups.",
    "good_example": "Randomization is at the user level, so each signed-in user stays in one arm for the whole test."
  },
  "randomization/unit-matches-interference": {
    "severity": "warning",
    "lint_rule": "The randomization unit must account for interference between users, so sharing, network effects, or marketplace dynamics do not leak the treatment across arms. A spec with no word on interference breaks this rule unless it explains why none is plausible for this product.",
    "bad_example": "This experiment will be ran on users.",
    "good_example": "This experiment will be ran on organisations as they own the relationship to subscriptions which will allow us to measure subscription conversion rate without bias."
  },
  "randomization/states-the-split": {
    "severity": "error",
    "lint_rule": "The spec must state the share of traffic each arm receives, and justify any unequal split by cost or risk. A staged ramp that gives each arm's share at each stage satisfies this rule, and a spec that names no percentages breaks it.",
    "bad_example": "Traffic will be ramped up gradually as confidence grows.",
    "good_example": "Traffic runs at 50/50 between control and variant for the full test."
  },
  "power/has-a-sample-size-calculation": {
    "severity": "error",
    "lint_rule": "The spec must include a sample size calculation for the primary metric at the stated minimum detectable effect. A target picked by feel, with no calculation behind it, breaks this rule.",
    "bad_example": "We need about 5,000 users per arm, which feels like enough for a change this size.",
    "good_example": "At a 20% baseline checkout rate and a 2 point minimum effect, the calculation calls for 6,100 users per arm at 80% power."
  },
  "power/states-the-significance-level": {
    "severity": "error",
    "lint_rule": "The spec must state the significance level it will use and stick to it, declaring any per-segment or per-metric level up front. A spec that names no significance level breaks this rule.",
    "bad_example": "Results will be checked for significance once the data is in.",
    "good_example": "The primary comparison uses a significance level of 0.05, and the two segment cuts for desktop and mobile use a significance level of 0.01."
  },
  "power/traffic-makes-the-test-feasible": {
    "severity": "error",
    "lint_rule": "The spec must show that the expected traffic supports the required sample within a realistic window. A spec with no expected traffic named, or a window the traffic cannot fill, breaks this rule, and a test that would run for months is expected to be rescheduled or scoped to a bigger effect.",
    "bad_example": "The test needs 40,000 users per arm and will run until it gets them.",
    "good_example": "The pricing page receives about 9,000 eligible visitors a day, so the 12,200 users the calculation requires across both arms arrive in roughly two days of full traffic and comfortably inside the two-week window."
  },
  "duration/covers-full-business-cycles": {
    "severity": "error",
    "lint_rule": "The test window must span whole weekly cycles, so day-of-week patterns do not land in one arm more than another. A window that ends mid-week, or runs for a fraction of a week, breaks this rule.",
    "bad_example": "The test will run for four days, from Thursday through Sunday.",
    "good_example": "The test will run for two full weeks, starting and ending on a Monday, so each arm carries the same mix of weekdays and weekends."
  },
  "duration/has-a-fixed-horizon": {
    "severity": "error",
    "lint_rule": "The spec must set the planned end date or the required sample before launch and commit to deciding at that horizon. A spec with no end date and no target sample breaks this rule.",
    "bad_example": "The test will run until the results look clear.",
    "good_example": "The test ends on 30 June or when each arm reaches 6,100 users, whichever comes later, and the ship decision is made at that point."
  },
  "analysis/names-the-statistical-test": {
    "severity": "error",
    "lint_rule": "The spec must name the statistical test or estimator the analysis will use for the primary metric, such as a two-proportion test on user-level rates. A spec that says the arms will be compared and stops breaks this rule.",
    "bad_example": "We will compare the conversion rates between the two arms at the end.",
    "good_example": "The primary analysis uses a two-proportion test on user-level checkout rates, with each user counted once in the arm they were assigned to."
  },
  "decision/has-criteria-before-launch": {
    "severity": "error",
    "lint_rule": "The spec must state what result counts as a win, a loss, and an inconclusive outcome before the test starts, so the ship decision is not negotiated after the numbers arrive. A spec with no win or loss threshold breaks this rule.",
    "bad_example": "We will decide whether to ship once we see how the numbers come out.",
    "good_example": "The change ships if checkout completion lifts by at least 2 points with the interval clear of zero, it is dropped if the lift is negative, and any result in between counts as inconclusive."
  },
  "decision/plans-for-an-inconclusive-result": {
    "severity": "warning",
    "lint_rule": "The spec must say what happens when the result is inconclusive, meaning the confidence interval includes both zero and the effect it was powered to detect: whether the change ships anyway, and what the null teaches the team. A spec that covers only what a win and a loss mean breaks this rule.",
    "bad_example": "If the change wins we ship it, and if it loses we drop it.",
    "good_example": "If the interval covers both zero and the 2 point effect the test was powered for, the variant stays off, the current page remains the default, and the team records the pricing question as still open for a larger test."
  },
  "rollout/has-a-rollback-plan": {
    "severity": "error",
    "lint_rule": "The spec must say how the change is turned off if something goes wrong and who has the authority to do it. A spec with no kill switch and no named owner breaks this rule.",
    "bad_example": "If something goes wrong after launch, the team will look into it.",
    "good_example": "The change ships behind the checkout_v2 flag, and the on-call engineer can turn the flag off without a deploy, with the product lead holding the authority to order the rollback."
  }
}`;

/** A lint rule as it appears in .growth-eng/lint-rules.json. */
interface LintRule {
  severity: "error" | "warning";
  lint_rule: string;
  bad_example?: string;
  good_example?: string;
}

/**
 * Parse and validate the lint rules file. The file is a JSON object keyed by
 * rule id; each rule carries a severity ("error" or "warning") and a
 * lint_rule description, and may carry a bad_example and a good_example.
 * Errors name the offending rule so the agent can fix the file.
 *
 * @param raw The raw content of .growth-eng/lint-rules.json
 * @returns The rules, keyed by rule id
 */
function parseLintRules(raw: string): Map<string, LintRule> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(
      `.growth-eng/${LINT_RULES_FILE} is not valid JSON: ` +
        `${(error as Error).message}. Fix the file, or delete it and run ` +
        "the 'init' prompt to restore the default rules.",
    );
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(
      `.growth-eng/${LINT_RULES_FILE} must be a JSON object keyed by rule ` +
        'id, e.g. { "my-rule": { "severity": "error", "lint_rule": "..." } }. ' +
        "Fix the file, or delete it and run the 'init' prompt to restore the " +
        "default rules.",
    );
  }

  const entries = Object.entries(parsed as Record<string, unknown>);
  if (entries.length === 0) {
    throw new Error(
      `.growth-eng/${LINT_RULES_FILE} contains no rules, so no score can be ` +
        "produced. Add rules to the file, or delete it and run the 'init' " +
        "prompt to restore the default rules.",
    );
  }

  const rules = new Map<string, LintRule>();
  for (const [id, value] of entries) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      throw new Error(
        `Lint rule "${id}" in .growth-eng/${LINT_RULES_FILE} must be an object ` +
          'with a severity ("error" or "warning") and a lint_rule description.',
      );
    }
    const rule = value as Record<string, unknown>;
    if (typeof rule.lint_rule !== "string" || rule.lint_rule.trim() === "") {
      throw new Error(
        `Lint rule "${id}" in .growth-eng/${LINT_RULES_FILE} is missing its ` +
          "lint_rule description. Give the rule a sentence the judge can " +
          "apply, as the default rules do.",
      );
    }
    if (rule.severity !== "error" && rule.severity !== "warning") {
      throw new Error(
        `Lint rule "${id}" in .growth-eng/${LINT_RULES_FILE} has severity ` +
          `"${String(rule.severity)}"; it must be "error" or "warning".`,
      );
    }
    for (const key of ["bad_example", "good_example"]) {
      if (rule[key] !== undefined && typeof rule[key] !== "string") {
        throw new Error(
          `Lint rule "${id}" in .growth-eng/${LINT_RULES_FILE}: ${key} must ` + "be text.",
        );
      }
    }
    rules.set(id, {
      severity: rule.severity,
      lint_rule: rule.lint_rule,
      bad_example: rule.bad_example as string | undefined,
      good_example: rule.good_example as string | undefined,
    });
  }
  return rules;
}

/**
 * The scoring prompt handed back with the rules, telling the calling LLM how
 * to lint the knowledge base. Every rule counts equally, whatever its
 * severity: the score is the share of rules an experiment follows.
 */
const LINT_PROMPT = lines(
  "1. Read every experiment document at .growth-eng/specs/**/*.md (or .growth-eng/**/*.md, excluding .growth-eng/_template_.md and drafts in .growth-eng/ideas/) with your own file tools.",
  "2. For each experiment, judge whether it follows each of the rules above. A rule is either followed or broken; use its bad_example and good_example to decide, and judge the whole document, not only the section a rule seems to name.",
  "3. Score each experiment: Experiment Quality % = (rules followed / total rules) * 100. Every rule counts equally, whatever its severity.",
  "4. Report, for each experiment: the score, every broken rule (id, severity, and why it breaks), and what to change to follow it.",
  "5. Finish with the overall Experiment Quality %: the average of the per-experiment scores. If there are no experiment documents, report that there is nothing to lint.",
);

/**
 * A service for linting the experiment documents in the knowledge base
 * against the rules in .growth-eng/lint-rules.json.
 */
export class LintService {
  /**
   * The default lint ruleset (.growth-eng/lint-rules.json)
   * @returns The default rules as JSON text, 24 rules (19 error, 5 warning)
   */
  public static getDefaultRules(): string {
    return DEFAULT_LINT_RULES;
  }

  /**
   * Load the repository's lint rules and return them with the scoring
   * prompt. The calling LLM reads the experiment documents with its own
   * file tools, judges each rule per experiment, and reports the scores.
   *
   * @returns The rule summary, the rules verbatim, and the scoring prompt
   */
  public static async lint(): Promise<string> {
    const rulesPath = requireLintRulesPath();
    const raw = await readFile(rulesPath, "utf8");
    const rules = parseLintRules(raw);
    const errors = [...rules.values()].filter((rule) => rule.severity === "error").length;
    const warnings = rules.size - errors;

    return lines(
      `Loaded ${rules.size} lint rules from .growth-eng/${LINT_RULES_FILE} ` +
        `(${errors} error, ${warnings} warning).`,
      "",
      "Lint rules:",
      "",
      "```json",
      raw.trimEnd(),
      "```",
      "",
      "Now lint the experiments:",
      "",
      LINT_PROMPT,
    );
  }
}
