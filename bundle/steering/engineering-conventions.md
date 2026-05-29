# Engineering Conventions

These defaults apply across projects unless a project's own docs say otherwise.

- Prefer small, reversible changes. Solve the problem that was asked, not adjacent ones.
- Match the existing style and libraries of the codebase before introducing new ones.
- Write or update tests alongside behavior changes; run the build before declaring done.
- Use secure-by-default patterns: validate input, parameterize queries, never log secrets.
- Keep functions focused; name things for what they do, not how they do it.
