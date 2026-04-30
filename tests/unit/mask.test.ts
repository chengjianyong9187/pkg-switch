// ts
import { describe, expect, it } from "vitest";
import { maskSecret } from "../../src/shared/mask.js";

describe("maskSecret", () => {
  it("应对空值返回空字符串", () => {
    expect(maskSecret(null)).toBe("");
    expect(maskSecret(undefined)).toBe("");
    expect(maskSecret("")).toBe("");
  });

  it("应完整遮蔽短敏感值", () => {
    expect(maskSecret("abc123")).toBe("******");
  });

  it("应保留长敏感值的首尾片段", () => {
    expect(maskSecret("plain-text-token")).toBe("pla***ken");
  });
});
