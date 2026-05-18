Deploy to Vercel preview and report the URL.

Steps:
1. Run: npx tsc --noEmit 2>&1 | grep -v timeline-panel
2. If type errors: stop and report them
3. If clean: run: vercel --yes 2>&1 | grep -E "(ready|error|URL|url)"
4. Report the preview URL
