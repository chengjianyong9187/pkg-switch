// ts
export function maskSecret(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  if (value.length <= 6) {
    return "******";
  }

  // 保留首尾短片段，便于用户辨认当前 token，同时避免明文泄露。
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}
