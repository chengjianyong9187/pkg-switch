// ts
import { describe, expect, it } from "vitest";
import { renderYarnrc } from "../../src/managers/yarnrc-renderer.js";

describe("renderYarnrc", () => {
  it("应输出 Yarn Berry 需要的 registry、认证和 scope 配置", () => {
    const output = renderYarnrc({
      npm: {
        registry: "https://nexus.example.com/repository/npm-group/",
        alwaysAuth: true,
        authToken: "plain-text-token"
      },
      yarn: {
        nodeLinker: "node-modules"
      },
      scopes: {
        "@company": {
          registry: "https://nexus.example.com/repository/npm-group/",
          alwaysAuth: true,
          authToken: "scope-token"
        }
      }
    });

    expect(output).toContain("nodeLinker: node-modules");
    expect(output).toContain("npmRegistryServer: https://nexus.example.com/repository/npm-group/");
    expect(output).toContain("npmAlwaysAuth: true");
    expect(output).toContain("npmAuthToken: plain-text-token");
    expect(output).toContain("npmScopes:");
    expect(output).toContain("company:");
    expect(output).toContain("npmAuthToken: scope-token");
    expect(output).not.toContain("@company:");
    expect(output).not.toContain("undefined");
    expect(output.endsWith("\n")).toBe(true);
  });
});
