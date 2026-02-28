#!/usr/bin/env node
/**
 * resolve-conflicts.ts
 *
 * Automatically resolves git merge conflicts and pushes changes to the remote
 * branch without creating a pull request.
 *
 * Strategy options (via CONFLICT_STRATEGY env var):
 *   ours   – keep local changes on conflict  (default)
 *   theirs – accept incoming changes on conflict
 */

import { execSync, ExecSyncOptions } from "child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConflictStrategy = "ours" | "theirs";

interface RunResult {
  stdout: string;
  exitCode: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(command: string, opts: ExecSyncOptions = {}): RunResult {
  try {
    const stdout = execSync(command, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      ...opts,
    }) as string;
    return { stdout: stdout.trim(), exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; status?: number; message?: string };
    return {
      stdout: (e.stdout ?? e.message ?? "").toString().trim(),
      exitCode: e.status ?? 1,
    };
  }
}

function log(msg: string): void {
  process.stdout.write(`[po-npr] ${msg}\n`);
}

function die(msg: string): never {
  process.stderr.write(`[po-npr] ERROR: ${msg}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

function currentBranch(): string {
  const { stdout, exitCode } = run("git rev-parse --abbrev-ref HEAD");
  if (exitCode !== 0) die("Could not determine current branch.");
  return stdout;
}

function hasRemote(remote: string): boolean {
  const { exitCode } = run(`git remote get-url ${remote}`);
  return exitCode === 0;
}

function conflictedFiles(): string[] {
  const { stdout } = run("git diff --name-only --diff-filter=U");
  return stdout ? stdout.split("\n").filter(Boolean) : [];
}

function isWorkingTreeClean(): boolean {
  const { stdout } = run("git status --porcelain");
  return stdout === "";
}

// ---------------------------------------------------------------------------
// Core workflow
// ---------------------------------------------------------------------------

/**
 * Resolve all currently conflicted files using the chosen strategy and
 * stage them for commit.
 */
function resolveConflicts(strategy: ConflictStrategy): void {
  const files = conflictedFiles();
  if (files.length === 0) {
    log("No conflicted files found.");
    return;
  }

  log(
    `Resolving ${files.length} conflicted file(s) using strategy: ${strategy}`
  );

  for (const file of files) {
    const checkoutSide = strategy === "ours" ? "--ours" : "--theirs";
    const { exitCode, stdout } = run(
      `git checkout ${checkoutSide} -- "${file}"`
    );
    if (exitCode !== 0) {
      die(`Failed to resolve conflict in '${file}': ${stdout}`);
    }
    const add = run(`git add -- "${file}"`);
    if (add.exitCode !== 0) {
      die(`Failed to stage resolved file '${file}': ${add.stdout}`);
    }
    log(`  resolved: ${file}`);
  }
}

/**
 * Main entry-point: fetch → merge → resolve conflicts → commit → push.
 */
function main(): void {
  const remote = process.env.GIT_REMOTE ?? "origin";
  const strategy: ConflictStrategy =
    (process.env.CONFLICT_STRATEGY as ConflictStrategy) ?? "ours";
  const commitMsg =
    process.env.COMMIT_MESSAGE ?? "chore: auto-resolve conflicts [skip ci]";

  if (!["ours", "theirs"].includes(strategy)) {
    die(
      `Invalid CONFLICT_STRATEGY '${strategy}'. Must be 'ours' or 'theirs'.`
    );
  }

  if (!hasRemote(remote)) {
    die(`Remote '${remote}' not found. Set GIT_REMOTE env var if needed.`);
  }

  const branch = currentBranch();
  if (branch === "HEAD") {
    die("Detached HEAD state – checkout a branch before running.");
  }

  log(`Branch: ${branch}`);
  log(`Remote: ${remote}`);
  log(`Conflict strategy: ${strategy}`);

  // 1. Fetch latest state from remote
  log("Fetching remote…");
  const fetch = run(`git fetch ${remote}`);
  if (fetch.exitCode !== 0) {
    die(`git fetch failed: ${fetch.stdout}`);
  }

  // 2. Check if remote tracking branch exists
  const trackingRef = `${remote}/${branch}`;
  const { exitCode: refCheck } = run(`git rev-parse --verify ${trackingRef}`);
  if (refCheck !== 0) {
    // No remote tracking branch yet – just push
    log(`No remote tracking branch found for '${trackingRef}'. Pushing…`);
    const push = run(`git push ${remote} ${branch}`);
    if (push.exitCode !== 0) {
      die(`git push failed: ${push.stdout}`);
    }
    log("Push successful – no remote branch existed.");
    return;
  }

  // 3. Attempt merge (prefer fast-forward, fall back to merge commit)
  log("Merging remote changes…");
  const merge = run(
    `git merge ${trackingRef} --no-edit -X ${strategy} -m "${commitMsg}"`
  );

  if (merge.exitCode === 0) {
    log("Merge succeeded cleanly.");
  } else {
    // Merge left conflicts in the index – resolve them manually
    log(`Merge had conflicts. Auto-resolving with strategy '${strategy}'…`);
    resolveConflicts(strategy);

    if (!isWorkingTreeClean()) {
      // Commit the resolved state
      const commit = run(`git commit -m "${commitMsg}"`);
      if (commit.exitCode !== 0) {
        die(`git commit failed: ${commit.stdout}`);
      }
      log("Committed auto-resolved changes.");
    }
  }

  // 4. Push to remote (no pull request)
  log("Pushing to remote…");
  const push = run(`git push ${remote} ${branch}`);
  if (push.exitCode !== 0) {
    die(`git push failed: ${push.stdout}`);
  }

  log("Done – changes pushed successfully. No pull request created.");
}

main();
