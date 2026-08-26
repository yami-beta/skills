#!/usr/bin/env node
/**
 * Wait for meaningful GitHub Pull Request state changes.
 *
 * This helper is intentionally read-only. It emits one JSON result and exits so an
 * agent can re-fetch authoritative state before deciding whether to mutate anything.
 */

import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import process from "node:process";

type JsonObject = Record<string, unknown>;

type CommandResult = {
  returncode: number;
  stdout: string;
  stderr: string;
};

type Arguments = {
  pr?: string;
  repo?: string;
  interval: number;
  timeout: number;
};

class WatchError extends Error {}

function run(command: string[], accepted: number[] = [0]): CommandResult {
  const completed = spawnSync(command[0], command.slice(1), {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  if (completed.error) {
    throw new WatchError(`${command.slice(0, 3).join(" ")}: ${completed.error.message}`);
  }

  const result = {
    returncode: completed.status ?? 1,
    stdout: completed.stdout ?? "",
    stderr: completed.stderr ?? "",
  };
  if (!accepted.includes(result.returncode)) {
    const detail = result.stderr.trim() || result.stdout.trim() || "command failed";
    throw new WatchError(`${command.slice(0, 3).join(" ")}: ${detail}`);
  }
  return result;
}

function parseJson(text: string, source: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new WatchError(`invalid JSON from ${source}: ${detail}`);
  }
}

function jsonCommand(command: string[], accepted: number[] = [0]): unknown {
  return parseJson(run(command, accepted).stdout, command.slice(0, 3).join(" "));
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function jsonLines(command: string[]): JsonObject[] {
  const result = run(command);
  const values: JsonObject[] = [];
  for (const line of result.stdout.split("\n")) {
    if (!line.trim()) continue;
    const value = parseJson(line, command.slice(0, 3).join(" "));
    if (!isObject(value)) {
      throw new WatchError(`unexpected JSON value from ${command.slice(0, 3).join(" ")}`);
    }
    values.push(value);
  }
  return values;
}

function resolveRepo(explicitRepo?: string): string {
  if (explicitRepo) return explicitRepo;
  const value = run(["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
  const repo = value.stdout.trim();
  if (!repo || !repo.includes("/")) throw new WatchError("could not resolve repository");
  return repo;
}

function prView(pr: string | undefined, repo: string): JsonObject {
  const command = ["gh", "pr", "view"];
  if (pr) command.push(pr);
  command.push(
    "--repo",
    repo,
    "--json",
    "number,url,state,isDraft,headRefOid,baseRefOid,mergeable,mergeStateStatus,reviewDecision",
  );
  const value = jsonCommand(command);
  if (!isObject(value)) throw new WatchError("unexpected PR metadata");
  return value;
}

function checks(prNumber: number, repo: string): JsonObject[] {
  const command = [
    "gh",
    "pr",
    "checks",
    String(prNumber),
    "--repo",
    repo,
    "--json",
    "name,state,bucket,link,workflow",
  ];
  const result = run(command, [0, 1]);
  if (
    result.returncode === 1 &&
    !result.stdout.trim() &&
    result.stderr.includes("no checks reported")
  ) {
    return [];
  }
  const value = parseJson(result.stdout, "gh pr checks");
  if (!Array.isArray(value) || !value.every(isObject)) {
    throw new WatchError("unexpected checks metadata");
  }
  return value.sort((left, right) =>
    `${String(left.workflow ?? "")}\u0000${String(left.name ?? "")}`.localeCompare(
      `${String(right.workflow ?? "")}\u0000${String(right.name ?? "")}`,
    ),
  );
}

function restCollection(endpoint: string, fields: string): JsonObject[] {
  return jsonLines(["gh", "api", "--paginate", endpoint, "--jq", `.[] | ${fields} | @json`]);
}

function reviewThreads(repo: string, prNumber: number): JsonObject[] {
  const [owner, name] = repo.split("/", 2);
  const query = `
query($owner:String!, $name:String!, $number:Int!, $after:String) {
  repository(owner:$owner, name:$name) {
    pullRequest(number:$number) {
      reviewThreads(first:100, after:$after) {
        nodes {
          id
          isResolved
          isOutdated
          comments(last:1) {
            nodes { id databaseId updatedAt author { login } }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}`;
  let after: string | undefined;
  const threads: JsonObject[] = [];

  while (true) {
    const command = [
      "gh",
      "api",
      "graphql",
      "-f",
      `query=${query}`,
      "-F",
      `owner=${owner}`,
      "-F",
      `name=${name}`,
      "-F",
      `number=${prNumber}`,
    ];
    if (after !== undefined) command.push("-f", `after=${after}`);
    const payload = jsonCommand(command);
    if (!isObject(payload)) throw new WatchError("unexpected review thread metadata");

    const data = payload.data;
    const repository = isObject(data) ? data.repository : undefined;
    const pullRequest = isObject(repository) ? repository.pullRequest : undefined;
    const connection = isObject(pullRequest) ? pullRequest.reviewThreads : undefined;
    const nodes = isObject(connection) ? connection.nodes : undefined;
    const pageInfo = isObject(connection) ? connection.pageInfo : undefined;
    if (!Array.isArray(nodes) || !nodes.every(isObject) || !isObject(pageInfo)) {
      throw new WatchError("unexpected review thread metadata");
    }

    threads.push(...nodes);
    if (!pageInfo.hasNextPage) break;
    after = typeof pageInfo.endCursor === "string" ? pageInfo.endCursor : undefined;
    if (!after) throw new WatchError("review thread pagination ended without a cursor");
  }

  return threads.sort((left, right) =>
    String(left.id ?? "").localeCompare(String(right.id ?? "")),
  );
}

function snapshot(pr: string | undefined, repo: string): JsonObject {
  const metadata = prView(pr, repo);
  if (metadata.state !== "OPEN") return { pr: metadata };
  const number = metadata.number;
  if (typeof number !== "number" || !Number.isInteger(number)) {
    throw new WatchError("PR number is missing");
  }
  const root = `repos/${repo}`;
  return {
    pr: metadata,
    checks: checks(number, repo),
    reviews: restCollection(
      `${root}/pulls/${number}/reviews?per_page=100`,
      "{id, state, submitted_at, user: .user.login}",
    ),
    inline_comments: restCollection(
      `${root}/pulls/${number}/comments?per_page=100`,
      "{id, updated_at, in_reply_to_id, user: .user.login}",
    ),
    issue_comments: restCollection(
      `${root}/issues/${number}/comments?per_page=100`,
      "{id, updated_at, user: .user.login}",
    ),
    review_threads: reviewThreads(repo, number),
  };
}

function changedSections(previous: JsonObject, current: JsonObject): string[] {
  return Object.keys(current).filter(
    (key) => JSON.stringify(previous[key]) !== JSON.stringify(current[key]),
  );
}

function objectArray(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter(isObject) : [];
}

function summarize(value: JsonObject): JsonObject {
  const checkSummary = objectArray(value.checks).map((item) => ({
    name: item.name,
    state: item.state,
    bucket: item.bucket,
    workflow: item.workflow,
  }));
  const countKeys = ["reviews", "inline_comments", "issue_comments", "review_threads"];
  return {
    pr: isObject(value.pr) ? value.pr : {},
    checks: checkSummary,
    counts: Object.fromEntries(countKeys.map((key) => [key, objectArray(value[key]).length])),
  };
}

function emit(event: string, values: JsonObject = {}): void {
  console.log(JSON.stringify({ event, ...values }));
}

function usage(): string {
  return [
    "Usage: watch_pr.ts [options]",
    "",
    "Options:",
    "  --pr <number-or-url>  Pull Request; defaults to the current branch PR",
    "  --repo <owner/name>   Repository; defaults to the current repository",
    "  --interval <seconds>  Polling interval (default: 30, minimum: 30)",
    "  --timeout <seconds>   Maximum watch duration (default: 2700)",
    "  -h, --help            Show this help",
  ].join("\n");
}

function positiveNumber(value: string | undefined, option: string): number {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw new WatchError(`${option} requires a positive integer`);
  }
  return Number(value);
}

function optionValue(argv: string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new WatchError(`${option} requires a value`);
  }
  return value;
}

function parseArgs(argv: string[]): Arguments {
  const args: Arguments = { interval: 30, timeout: 2700 };
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "-h" || option === "--help") {
      console.log(usage());
      process.exit(0);
    }
    if (option === "--pr") args.pr = optionValue(argv, index++, option);
    else if (option === "--repo") args.repo = optionValue(argv, index++, option);
    else if (option === "--interval") {
      args.interval = positiveNumber(optionValue(argv, index++, option), option);
    } else if (option === "--timeout") {
      args.timeout = positiveNumber(optionValue(argv, index++, option), option);
    } else {
      throw new WatchError(`unknown option: ${option}`);
    }
  }
  if (args.interval < 30) throw new WatchError("--interval must be at least 30 seconds");
  if (args.timeout < 1) throw new WatchError("--timeout must be positive");
  return args;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function main(): Promise<number> {
  let args: Arguments;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    return 2;
  }

  let repo: string;
  let baseline: JsonObject;
  try {
    repo = resolveRepo(args.repo);
    baseline = snapshot(args.pr, repo);
  } catch (error) {
    emit("error", { error: error instanceof Error ? error.message : String(error) });
    return 4;
  }

  const baselinePr = isObject(baseline.pr) ? baseline.pr : {};
  if (baselinePr.state !== "OPEN") {
    emit("closed", { current: summarize(baseline) });
    return 3;
  }

  const deadline = performance.now() + args.timeout * 1000;
  let consecutiveErrors = 0;
  while (true) {
    const remaining = deadline - performance.now();
    if (remaining <= 0) {
      emit("timeout", { current: summarize(baseline) });
      return 2;
    }
    await sleep(Math.min(args.interval * 1000, remaining));

    let current: JsonObject;
    try {
      current = snapshot(args.pr, repo);
      consecutiveErrors = 0;
    } catch (error) {
      consecutiveErrors += 1;
      if (consecutiveErrors >= 3) {
        emit("error", {
          error: error instanceof Error ? error.message : String(error),
          consecutive_errors: consecutiveErrors,
          current: summarize(baseline),
        });
        return 4;
      }
      continue;
    }

    const currentPr = isObject(current.pr) ? current.pr : {};
    if (currentPr.state !== "OPEN") {
      emit("closed", { previous: summarize(baseline), current: summarize(current) });
      return 3;
    }
    const reasons = changedSections(baseline, current);
    if (reasons.length > 0) {
      emit("state_changed", {
        reasons,
        previous: summarize(baseline),
        current: summarize(current),
      });
      return 0;
    }
  }
}

process.exitCode = await main();
