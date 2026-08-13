# Oude CLAUDE.md (voor P0-Werkafspraken)

Bewaard voor referentie. De hoofdafspraken zijn verplaatst naar het nieuwe
`CLAUDE.md` (Werkafspraken). De Dual-Graph Context Policy verwijst naar MCP-tools
(`graph_continue`, `graph_read`, `graph_add_memory`) die in deze omgeving niet
beschikbaar zijn; die policy is bewust niet meegenomen naar de nieuwe versie.

De Custom Commands en verwijzing naar `.claude/rules/` zijn **wel** overgenomen
in het nieuwe `CLAUDE.md`.

---

## Dual-Graph Context Policy

Dit project gebruikt een lokale dual-graph MCP-server voor efficiënte
context-ophaling.

### MANDATORY: Always follow this order

1. **Call `graph_continue` first** — before any file exploration, grep, or code
   reading.
2. **If `graph_continue` returns `needs_project=true`**: call `graph_scan` with
   the current project directory (`pwd`). Do NOT ask the user.
3. **If `graph_continue` returns `skip=true`**: project has fewer than 5 files.
   Do NOT do broad or recursive exploration. Read only specific files if their
   names are mentioned, or ask the user what to work on.
4. **Read `recommended_files`** using `graph_read` — one call per file.
5. **Check `confidence` and obey the caps strictly.**

### Token Usage

A `token-counter` MCP is available for tracking live token usage.

### Rules

- Do NOT use `rg`, `grep`, or bash file exploration before calling
  `graph_continue`.
- Do NOT do broad/recursive exploration at any confidence level.
- Do NOT dump full chat history.
- After edits, call `graph_register_edit` with the changed files.

### Context Store

Whenever you make a decision, identify a task, note a next step, fact, or
blocker during a conversation, call `graph_add_memory`.

### Session End

When the user signals they are done, proactively update `CONTEXT.md` in the
project root with Current Task / Key Decisions / Next Steps.

## Project Rules (load before exploring)

- `.claude/rules/codebase-map.md` — exact file locations for every task, search
  strategy, key invariants.
- `.claude/rules/patterns.md` — anti-patterns, type patterns,
  component/API conventions, state flow.

## Custom Commands

- `/add-scenario [type]` — add a new scenario type to the template generator
- `/add-role [id / label]` — add a new participant role
- `/check` — run TypeScript check and filter pre-existing errors
- `/deploy` — type-check then deploy to Vercel preview
