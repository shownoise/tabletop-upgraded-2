Add a new participant role to the system.

Arguments: $ARGUMENTS (role id and label, e.g. "risk_manager / Risk Manager")

Steps:
1. Read lib/types.ts — only the Role type and ROLE_META object
2. Add role to Role union type
3. Add entry to ROLE_META with: label, team, description, authorities[], notResponsibleFor
4. Read lib/document-generator.ts — add a role-specific document for the new role
5. Run: npx tsc --noEmit to verify no type errors
Do NOT read any other files.
