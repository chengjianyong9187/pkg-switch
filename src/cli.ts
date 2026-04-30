// ts
import { cac } from "cac";

export function createCli() {
  // 先完成最小命令骨架，后续任务再补充真实业务动作。
  const cli = cac("pkg-switch");

  cli.command("current", "显示当前激活 profile").action(() => {
    // 当前阶段仅保证命令已注册且可执行。
  });

  cli.command("switch <name>", "切换到指定 profile").action((name: string) => {
    // 对占位参数做最小保护，避免空字符串等异常输入静默通过。
    if (!name || !name.trim()) {
      throw new Error("profile name is required");
    }
  });

  return cli;
}
