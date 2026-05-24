/**
 * MSW (Mock Service Worker) v2 — shared mock server for Vitest unit + integration tests.
 *
 * Handlers per integration provider live in `tests/mocks/handlers/`. They are
 * registered here as the empty default; each test suite imports and adds its
 * own handlers via `server.use(...handlers)`.
 *
 * Wired to Vitest via `vitest.config.ts` setupFiles.
 *
 * Refs:
 *   - https://mswjs.io/docs/integrations/node
 *   - plans/260524-1330-sprint-2-adapter-hubspot-zoho/research/researcher-03-adapter-pattern.md §5
 */

import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";

export const server = setupServer();

// Lifecycle hooks — start listening before any test, reset between tests,
// close after the run. Tests that don't import this file are unaffected.
beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
