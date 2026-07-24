import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  project: "proj_whrmfwrwxewbtfwfiwut",
  dirs: ["./src/trigger"],
  maxDuration: 900,
  runtime: "node-22",
  machine: "large-1x",
  ttl: "1h",
  execArgv: ["--max-old-space-size=6144"],
  retries: {
      //If you want to retry a task in dev mode (when using the CLI)
      enabledInDev: false,
      //the default retry settings. Used if you don't specify on a task.
      default: {
        maxAttempts: 3,
        minTimeoutInMs: 1000,
        maxTimeoutInMs: 10000,
        factor: 2,
        randomize: true,
      },
    },
 });