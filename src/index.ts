// ts
import { fileURLToPath } from "node:url";
import { createCli, type CliRuntimeOptions } from "./cli.js";

export async function runCli(argv = process.argv.slice(2), options: CliRuntimeOptions = {}) {
  const cli = createCli({ ...options, argv });

  try {
    // CAC 会按 process.argv 形态丢弃前两个参数，因此这里补齐占位项。
    cli.parse(["node", "pkg-switch", ...argv], { run: false });
    await cli.runMatchedCommand();
  } catch (error) {
    // 统一收口入口异常，避免未捕获错误直接吞掉上下文。
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

const entryFile = fileURLToPath(import.meta.url);

if (process.argv[1] === entryFile) {
  void runCli();
}
