#!/usr/bin/env python3
"""Wait for meaningful GitHub Pull Request state changes.

This helper is intentionally read-only. It emits one JSON result and exits so an
agent can re-fetch authoritative state before deciding whether to mutate anything.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
from dataclasses import dataclass
from typing import Any, Iterable


class WatchError(RuntimeError):
    pass


@dataclass(frozen=True)
class CommandResult:
    returncode: int
    stdout: str
    stderr: str


def run(command: list[str], accepted: Iterable[int] = (0,)) -> CommandResult:
    completed = subprocess.run(command, capture_output=True, text=True, check=False)
    result = CommandResult(completed.returncode, completed.stdout, completed.stderr)
    if result.returncode not in set(accepted):
        detail = result.stderr.strip() or result.stdout.strip() or "command failed"
        raise WatchError(f"{' '.join(command[:3])}: {detail}")
    return result


def json_command(command: list[str], accepted: Iterable[int] = (0,)) -> Any:
    result = run(command, accepted)
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise WatchError(f"invalid JSON from {' '.join(command[:3])}: {error}") from error


def json_lines(command: list[str]) -> list[dict[str, Any]]:
    result = run(command)
    values: list[dict[str, Any]] = []
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        try:
            value = json.loads(line)
        except json.JSONDecodeError as error:
            raise WatchError(f"invalid JSON line from {' '.join(command[:3])}: {error}") from error
        if not isinstance(value, dict):
            raise WatchError(f"unexpected JSON value from {' '.join(command[:3])}")
        values.append(value)
    return values


def resolve_repo(explicit_repo: str | None) -> str:
    if explicit_repo:
        return explicit_repo
    value = run(["gh", "repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"])
    repo = value.stdout.strip()
    if not repo or "/" not in repo:
        raise WatchError("could not resolve repository")
    return repo


def pr_view(pr: str | None, repo: str) -> dict[str, Any]:
    command = ["gh", "pr", "view"]
    if pr:
        command.append(pr)
    command.extend(
        [
            "--repo",
            repo,
            "--json",
            "number,url,state,isDraft,headRefOid,baseRefOid,mergeable,mergeStateStatus,reviewDecision",
        ]
    )
    value = json_command(command)
    if not isinstance(value, dict):
        raise WatchError("unexpected PR metadata")
    return value


def checks(pr_number: int, repo: str) -> list[dict[str, Any]]:
    command = [
        "gh",
        "pr",
        "checks",
        str(pr_number),
        "--repo",
        repo,
        "--json",
        "name,state,bucket,link,workflow",
    ]
    result = run(command, accepted=(0, 1))
    if result.returncode == 1 and not result.stdout.strip() and "no checks reported" in result.stderr:
        return []
    try:
        value = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise WatchError(f"invalid JSON from gh pr checks: {error}") from error
    if not isinstance(value, list):
        raise WatchError("unexpected checks metadata")
    return sorted(value, key=lambda item: (item.get("workflow") or "", item.get("name") or ""))


def rest_collection(endpoint: str, fields: str) -> list[dict[str, Any]]:
    return json_lines(["gh", "api", "--paginate", endpoint, "--jq", f".[] | {fields} | @json"])


def review_threads(repo: str, pr_number: int) -> list[dict[str, Any]]:
    owner, name = repo.split("/", 1)
    query = """
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
}
"""
    after: str | None = None
    threads: list[dict[str, Any]] = []
    while True:
        command = [
            "gh",
            "api",
            "graphql",
            "-f",
            f"query={query}",
            "-F",
            f"owner={owner}",
            "-F",
            f"name={name}",
            "-F",
            f"number={pr_number}",
        ]
        if after is not None:
            command.extend(["-f", f"after={after}"])
        payload = json_command(command)
        try:
            connection = payload["data"]["repository"]["pullRequest"]["reviewThreads"]
            nodes = connection["nodes"]
            page_info = connection["pageInfo"]
        except (KeyError, TypeError) as error:
            raise WatchError("unexpected review thread metadata") from error
        threads.extend(nodes)
        if not page_info.get("hasNextPage"):
            break
        after = page_info.get("endCursor")
        if not after:
            raise WatchError("review thread pagination ended without a cursor")
    return sorted(threads, key=lambda item: item.get("id") or "")


def snapshot(pr: str | None, repo: str) -> dict[str, Any]:
    metadata = pr_view(pr, repo)
    if metadata.get("state") != "OPEN":
        return {"pr": metadata}
    number = metadata.get("number")
    if not isinstance(number, int):
        raise WatchError("PR number is missing")
    root = f"repos/{repo}"
    return {
        "pr": metadata,
        "checks": checks(number, repo),
        "reviews": rest_collection(
            f"{root}/pulls/{number}/reviews?per_page=100",
            "{id, state, submitted_at, user: .user.login}",
        ),
        "inline_comments": rest_collection(
            f"{root}/pulls/{number}/comments?per_page=100",
            "{id, updated_at, in_reply_to_id, user: .user.login}",
        ),
        "issue_comments": rest_collection(
            f"{root}/issues/{number}/comments?per_page=100",
            "{id, updated_at, user: .user.login}",
        ),
        "review_threads": review_threads(repo, number),
    }


def changed_sections(previous: dict[str, Any], current: dict[str, Any]) -> list[str]:
    return [key for key in current if previous.get(key) != current.get(key)]


def summarize(value: dict[str, Any]) -> dict[str, Any]:
    return {
        "pr": value.get("pr", {}),
        "checks": [
            {key: item.get(key) for key in ("name", "state", "bucket", "workflow")}
            for item in value.get("checks", [])
        ],
        "counts": {
            key: len(value.get(key, []))
            for key in ("reviews", "inline_comments", "issue_comments", "review_threads")
        },
    }


def emit(event: str, **values: Any) -> None:
    print(json.dumps({"event": event, **values}, ensure_ascii=False, sort_keys=True))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pr", help="Pull Request number or URL; defaults to the current branch PR")
    parser.add_argument("--repo", help="Repository in owner/name form; defaults to the current repository")
    parser.add_argument("--interval", type=int, default=30, help="Polling interval in seconds (minimum 30)")
    parser.add_argument("--timeout", type=int, default=2700, help="Maximum watch duration in seconds")
    args = parser.parse_args()
    if args.interval < 30:
        parser.error("--interval must be at least 30 seconds")
    if args.timeout < 1:
        parser.error("--timeout must be positive")
    return args


def main() -> int:
    args = parse_args()
    try:
        repo = resolve_repo(args.repo)
        baseline = snapshot(args.pr, repo)
    except WatchError as error:
        emit("error", error=str(error))
        return 4

    if baseline["pr"].get("state") != "OPEN":
        emit("closed", current=summarize(baseline))
        return 3

    deadline = time.monotonic() + args.timeout
    consecutive_errors = 0
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            emit("timeout", current=summarize(baseline))
            return 2
        time.sleep(min(args.interval, remaining))
        try:
            current = snapshot(args.pr, repo)
            consecutive_errors = 0
        except WatchError as error:
            consecutive_errors += 1
            if consecutive_errors >= 3:
                emit(
                    "error",
                    error=str(error),
                    consecutive_errors=consecutive_errors,
                    current=summarize(baseline),
                )
                return 4
            continue

        if current["pr"].get("state") != "OPEN":
            emit("closed", previous=summarize(baseline), current=summarize(current))
            return 3
        reasons = changed_sections(baseline, current)
        if reasons:
            emit(
                "state_changed",
                reasons=reasons,
                previous=summarize(baseline),
                current=summarize(current),
            )
            return 0


if __name__ == "__main__":
    sys.exit(main())
