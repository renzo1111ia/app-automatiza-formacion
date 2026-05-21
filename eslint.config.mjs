import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // dashboard-af: zonas que NO son código de producción.
    // Si quieres lintearlas, mueve a src/lib/ o crea un override específico.
    "src/scratch/**",          // código de debug, también excluido de tsconfig
    "src/scripts/**",          // utilidades manuales (one-off migrations, etc.)
    "scripts/**",              // seed-demo y similares
    ".claude/**",              // scripts del plugin Claude Code
    "docs/**",                 // documentación, no es código
    "supabase/**",             // migrations + seed.sql
    "worker.js",               // worker legacy, refactor en Sprint 0 tarea 1-01
    "*.config.{js,mjs,cjs,ts}",
    ".tmp-*",                  // archivos temporales locales
  ]),
]);

export default eslintConfig;
