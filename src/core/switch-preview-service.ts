// ts
import { readFile } from "node:fs/promises";
import { maskSecret } from "../shared/mask.js";
import type { WriteTarget } from "../shared/types.js";
import { createAppPaths } from "../storage/app-paths.js";
import { readJsonFile } from "../storage/config-repo.js";
import { createSwitchTargetFiles, type SwitchTargetFile } from "./switch-service.js";
import type { PkgSwitchConfig } from "../shared/types.js";

export interface PreviewSwitchProfileInput {
  homeDir: string;
  profileName: string;
  includeDiff?: boolean;
}

export interface PreviewSwitchTarget {
  target: WriteTarget;
  filePath: string;
  maskedContent: string;
  diff?: string;
}

export interface PreviewSwitchProfileResult {
  profileName: string;
  targets: PreviewSwitchTarget[];
}

function hasErrorCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

async function readTextFileIfExists(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (hasErrorCode(error, "ENOENT")) {
      return "";
    }

    throw error;
  }
}

function isSensitiveKey(key: string): boolean {
  return /(?:token|_auth|password|passwd|username|email)/i.test(key);
}

function maskConfigLine(line: string): string {
  const equalsIndex = line.indexOf("=");
  const colonIndex = line.indexOf(": ");
  const separatorIndex =
    equalsIndex >= 0 && (colonIndex < 0 || equalsIndex < colonIndex) ? equalsIndex : colonIndex >= 0 ? colonIndex : -1;

  if (separatorIndex < 0) {
    return line;
  }

  const separator = separatorIndex === colonIndex ? ": " : "=";
  const key = line.slice(0, separatorIndex).trim();
  const value = line.slice(separatorIndex + separator.length);

  if (!isSensitiveKey(key)) {
    return line;
  }

  return `${line.slice(0, separatorIndex)}${separator}${maskSecret(value.trim())}`;
}

export function maskRenderedContent(content: string): string {
  return content
    .split("\n")
    .map((line) => maskConfigLine(line))
    .join("\n");
}

function toLines(content: string): string[] {
  const lines = content.split(/\r?\n/);

  if (lines.at(-1) === "") {
    lines.pop();
  }

  return lines;
}

export function createMaskedLineDiff(currentContent: string, targetContent: string, filePath: string): string {
  const currentLines = toLines(maskRenderedContent(currentContent));
  const targetLines = toLines(maskRenderedContent(targetContent));
  const lines = [`--- current ${filePath}`, `+++ target ${filePath}`];
  const maxLength = Math.max(currentLines.length, targetLines.length);

  for (let index = 0; index < maxLength; index += 1) {
    const currentLine = currentLines[index];
    const targetLine = targetLines[index];

    if (currentLine === targetLine) {
      if (currentLine !== undefined) {
        lines.push(` ${currentLine}`);
      }
      continue;
    }

    if (currentLine !== undefined) {
      lines.push(`-${currentLine}`);
    }

    if (targetLine !== undefined) {
      lines.push(`+${targetLine}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

async function toPreviewTarget(targetFile: SwitchTargetFile, includeDiff: boolean): Promise<PreviewSwitchTarget> {
  const currentContent = includeDiff ? await readTextFileIfExists(targetFile.filePath) : "";

  return {
    target: targetFile.target,
    filePath: targetFile.filePath,
    maskedContent: maskRenderedContent(targetFile.content),
    diff: includeDiff ? createMaskedLineDiff(currentContent, targetFile.content, targetFile.filePath) : undefined
  };
}

export async function previewSwitchProfile(input: PreviewSwitchProfileInput): Promise<PreviewSwitchProfileResult> {
  const appPaths = createAppPaths(input.homeDir);
  const config = await readJsonFile<PkgSwitchConfig>(appPaths.configFile);
  const targetFiles = createSwitchTargetFiles(input.homeDir, config, input.profileName);

  return {
    profileName: input.profileName,
    targets: await Promise.all(targetFiles.map((targetFile) => toPreviewTarget(targetFile, input.includeDiff ?? false)))
  };
}
