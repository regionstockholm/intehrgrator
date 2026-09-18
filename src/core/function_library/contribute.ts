import { serializeFunctionBundle } from "./bundle.ts";
import type { FunctionBundle } from "./types.ts";

export const FUNCTION_LIBRARY_GITHUB_REPO = "regionstockholm/intehrgrator";
export const GITHUB_SIGNUP_URL = "https://github.com/signup";
export const GITHUB_LOGIN_URL = "https://github.com/login";

/** GitHub rejects very long query strings; keep the new-issue URL under this. */
export const GITHUB_ISSUE_URL_MAX = 7000;

export interface FunctionContribution {
  title: string;
  body: string;
  truncated: boolean;
}

export interface FunctionContributionSubmitResult {
  htmlUrl: string;
  via: "api" | "web";
  truncated: boolean;
}

export function functionContributionIssue(
  bundle: FunctionBundle,
  description: string,
): FunctionContribution {
  const trimmed = description.trim();
  if (!trimmed) {
    throw new Error("A description is required before contributing a Function");
  }
  const title = `Function library: ${bundle.name}`;
  const fullBody = issueBody(bundle, trimmed, serializeFunctionBundle(bundle));
  const fullUrl = githubNewIssueUrl(title, fullBody);
  if (fullUrl.length <= GITHUB_ISSUE_URL_MAX) {
    return { title, body: fullBody, truncated: false };
  }
  const shortBody = issueBody(bundle, trimmed, null);
  return { title, body: shortBody, truncated: true };
}

export function functionContributionWebUrl(bundle: FunctionBundle, description: string): string {
  const issue = functionContributionIssue(bundle, description);
  return githubNewIssueUrl(issue.title, issue.body);
}

export async function submitFunctionContribution(
  bundle: FunctionBundle,
  description: string,
  options?: { githubToken?: string; fetch?: typeof fetch; repo?: string },
): Promise<FunctionContributionSubmitResult> {
  const trimmed = description.trim();
  if (!trimmed) {
    throw new Error("A description is required before contributing a Function");
  }
  const repo = options?.repo ?? FUNCTION_LIBRARY_GITHUB_REPO;
  const token = options?.githubToken?.trim();
  if (token) {
    const body = issueBody(bundle, trimmed, serializeFunctionBundle(bundle));
    const htmlUrl = await createGithubIssue(
      repo,
      { title: `Function library: ${bundle.name}`, body, truncated: false },
      token,
      options?.fetch ?? globalThis.fetch,
    );
    return { htmlUrl, via: "api", truncated: false };
  }
  const issue = functionContributionIssue(bundle, trimmed);
  return {
    htmlUrl: githubNewIssueUrl(issue.title, issue.body, repo),
    via: "web",
    truncated: issue.truncated,
  };
}

export function githubNewIssueUrl(
  title: string,
  body: string,
  repo = FUNCTION_LIBRARY_GITHUB_REPO,
): string {
  const params = new URLSearchParams({ title, body, labels: "enhancement" });
  return `https://github.com/${repo}/issues/new?${params.toString()}`;
}

function issueBody(bundle: FunctionBundle, description: string, json: string | null): string {
  const params = bundle.parameters.length ? bundle.parameters.join(", ") : "(none)";
  const tables = bundle.decisionTables.length ? bundle.decisionTables.join(", ") : "(none)";
  const definition = json
    ? ["## Function definition", "", "```json", json.trimEnd(), "```"].join("\n")
    : [
      "## Function definition",
      "",
      "The Function bundle was too large for a prefilled GitHub URL.",
      `Attach the downloaded \`${bundle.name}.intehr-function.json\` file to this issue.`,
    ].join("\n");
  return [
    "## Description",
    "",
    description,
    "",
    "## Function",
    "",
    `- **Name:** ${bundle.name}`,
    `- **Parameters:** ${params}`,
    `- **Returns:** ${bundle.returns ?? "value"}`,
    bundle.locale ? `- **Locale:** ${bundle.locale}` : undefined,
    `- **Decision tables:** ${tables}`,
    "",
    definition,
    "",
    "Filed from intEHRgrator **Contribute**. Maintainers review by hand — do not auto-merge.",
  ].filter((line) => line !== undefined).join("\n");
}

async function createGithubIssue(
  repo: string,
  issue: FunctionContribution,
  token: string,
  fetchFn: typeof fetch,
): Promise<string> {
  const res = await fetchFn(`https://api.github.com/repos/${repo}/issues`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: issue.title,
      body: issue.body,
      labels: ["enhancement"],
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub issue create failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json() as { html_url?: string };
  if (!json.html_url) throw new Error("GitHub issue create did not return html_url");
  return json.html_url;
}
