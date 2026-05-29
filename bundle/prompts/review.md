# Code Review

Review the staged changes (or the current diff) and report findings grouped by severity:

- **High** — correctness bugs, security issues, data loss risks. Must fix before merge.
- **Medium** — design smells, missing tests, unclear naming. Should fix.
- **Low** — style nits, minor simplifications. Optional.

For each finding, cite the file and line, explain the problem, and suggest a concrete fix. End with a one-line verdict: approve / approve-with-nits / request-changes.
