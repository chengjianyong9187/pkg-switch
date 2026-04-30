// ts
import { fileURLToPath } from "node:url";
import { createCli } from "./cli.js";

export function runCli(argv = process.argv.slice(2)) {
  const cli = createCli();

  try {
    cli.parse(["pkg-switch", ...argv], { run: true });
  } catch (error) {
    // 统一收口入口异常，避免未捕获错误直接吞掉上下文。
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

const entryFile = fileURLToPath(import.meta.url);

if (process.argv[1] === entryFile) {
  runCli();
}
