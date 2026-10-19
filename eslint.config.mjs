import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: ["test-results/**", "playwright-report/**", ".next/**"],
  },
  {
    rules: {
      // This app doesn't opt into the React Compiler — these rules assume
      // compiler-managed memoization and flag long-standing, intentional
      // patterns (setState-on-mount in effects, Math.random/Date.now in
      // render-adjacent code, ref access in callbacks) that aren't bugs
      // here. Keep as warnings; rules-of-hooks/exhaustive-deps stay errors.
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/use-memo": "warn",
      // Dutch copy throughout uses raw apostrophes/quotes in JSX text —
      // cosmetic HTML-entity escaping, not a functional bug.
      "react/no-unescaped-entities": "warn",
      // Pre-existing `any` usage is widespread (auth role casts, KV client
      // typing, etc.) — downgrading to warn avoids a repo-wide type-safety
      // refactor that's out of scope for standing up the lint gate itself.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
    },
  },
]

export default config
