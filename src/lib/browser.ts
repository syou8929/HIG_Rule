import { access } from "node:fs/promises";
import { chromium, type Browser, type Page } from "playwright-core";

const CHROME_CANDIDATES = [
  process.env.HIG_CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
].filter((value): value is string => Boolean(value));

async function findChrome(): Promise<string> {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next supported executable location.
    }
  }
  throw new Error("No Chrome executable found. Set HIG_CHROME_PATH to a Chromium-compatible browser.");
}

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    executablePath: await findChrome(),
    headless: true,
    args: ["--disable-background-networking", "--disable-sync"],
  });
}

export async function openRenderedPage(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.locator("main h1").waitFor({ state: "visible", timeout: 30_000 });
}
