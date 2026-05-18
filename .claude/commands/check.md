Run type check and report errors.

Steps:
1. Run: npx tsc --noEmit 2>&1
2. If errors: show only errors from files I edited (filter out pre-existing timeline-panel.tsx errors)
3. If clean: confirm "No type errors"
Do not read any files unless fixing an error.
