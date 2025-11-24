#!/usr/bin/env node

import { execSync } from "child_process";
import { readFileSync } from "fs";

/**
 * Pre-commit hook to validate commit messages.
 *
 * Valid commit messages must start with one of:
 * - "chore: " - for maintenance commits
 * - "#{issue-number} " - where issue number is extracted from branch name
 * - "[skip ci]" - to skip CI/CD pipeline
 * - Git-generated messages: "Merge ", "Revert ", "fixup! ", "squash! "
 */

const commitMsgFile = process.argv[2];

if (!commitMsgFile) {
  console.error("❌ Error: No commit message file provided");
  process.exit(1);
}

// Read the commit message
const commitMessage = readFileSync(commitMsgFile, "utf-8").trim();

// Extract the current branch name
let branchName;
try {
  branchName = execSync("git rev-parse --abbrev-ref HEAD", {
    encoding: "utf-8",
  }).trim();
} catch (error) {
  console.error("❌ Error: Unable to get current branch name");
  process.exit(1);
}

// Extract issue number from branch name (e.g., "123" from "123-feature-name")
const issueMatch = branchName.match(/^(\d+)-/);
const issueNumber = issueMatch ? issueMatch[1] : null;

// Check if it's a Git-generated message
const isGitGenerated =
  commitMessage.startsWith("Merge ") ||
  commitMessage.startsWith("Revert ") ||
  commitMessage.startsWith("fixup! ") ||
  commitMessage.startsWith("squash! ");

// Check for skip CI
const isSkipCI = commitMessage.startsWith("[skip ci]");

// Check for chore commit
const isChore = commitMessage.startsWith("chore: ");

// Check for issue-based commit
const isIssue = issueNumber && commitMessage.startsWith(`#${issueNumber}: `);

// Validate
if (!isChore && !isIssue && !isGitGenerated && !isSkipCI) {
  console.error("\n❌ Invalid commit message format!\n");
  console.error("Valid commit message formats:");
  console.error('  ✓ "chore: <description>"');
  if (issueNumber) {
    console.error(
      `  ✓ "#${issueNumber} <description>" (issue from branch: ${branchName})`,
    );
  } else {
    console.error(
      '  ✓ "#<issue-number> <description>" (when branch starts with issue number)',
    );
  }
  console.error('  ✓ "[skip ci] <description>"');
  console.error("  ✓ Git-generated (Merge, Revert, fixup!, squash!)");
  console.error("\n📝 Your commit message:");
  console.error(`   "${commitMessage}"\n`);
  process.exit(1);
}

// Success
console.log("✅ Commit message is valid");
process.exit(0);
