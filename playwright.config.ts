import { defineConfig, devices } from "@playwright/test";

/**
 * E2E contra un build de producción con una base SQLite propia cargada con
 * datos de demostración (ficticios). Si no hay build, se compila primero.
 */
const PUERTO = 3200;

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    trace: "retain-on-failure",
    locale: "es-AR",
  },
  projects: [
    { name: "escritorio", use: { ...devices["Desktop Chrome"] } },
    { name: "celular", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `npm run e2e:servidor -- -p ${PUERTO}`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      DATABASE_URL: "file:./e2e.db",
      EMAIL_PROVIDER: "console",
      SITE_URL: `http://localhost:${PUERTO}`,
      ADMIN_TOKEN: "",
    },
  },
});
