import { runCli } from "./run";

runCli(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    console.error(`aunboard: ${(err as Error).message}`);
    process.exitCode = 1;
  },
);
