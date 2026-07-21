import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const now = (): string => new Date().toISOString();

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeUrl(raw: string, sourceRoot: string): string | null {
  try {
    const url = new URL(raw, sourceRoot);
    if (url.origin !== "https://developer.apple.com") return null;
    const rootPath = new URL(sourceRoot).pathname.replace(/\/$/, "");
    const path = url.pathname.replace(/\/$/, "");
    if (path !== rootPath && !path.startsWith(`${rootPath}/`)) return null;
    url.pathname = path || rootPath;
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function slugFromUrl(url: string): string {
  const path = new URL(url).pathname.replace(/\/$/, "");
  return path.split("/").pop() || "index";
}

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "general";
}

export function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function truncateWords(value: string, maximum = 19): string {
  return value.trim().split(/\s+/).filter(Boolean).slice(0, maximum).join(" ");
}

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(path: string, value: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value.endsWith("\n") ? value : `${value}\n`, "utf8");
}
