/**
 * PharmaPOS screenshot & cashier-flow GIF capture script.
 *
 * Prerequisites:
 *   1. Dev server running: npm run dev  (http://localhost:3000)
 *   2. Chromium installed: npx playwright install chromium
 *
 * Optional (GIF conversion):
 *   ffmpeg must be on PATH. If missing, raw .webm is kept and GIF step is skipped.
 *
 * Usage:
 *   npm run capture:screenshots
 */

import { execSync } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import ffmpegStatic from "ffmpeg-static";

const BASE_URL = process.env.CAPTURE_BASE_URL ?? "http://localhost:3000";
const VIEWPORT = { width: 1440, height: 900 };
const SCREENSHOTS_DIR = path.join(process.cwd(), "docs", "screenshots");
const VIDEOS_DIR = path.join(SCREENSHOTS_DIR, ".raw-videos");

const LOGIN = {
  email: "admin@pharmapos.com",
  password: "admin123",
};

type PageCapture = {
  name: string;
  path: string;
  ready: () => Promise<void>;
};

async function waitForSpinnerGone(page: Page) {
  const spinner = page.locator("svg.animate-spin");
  if (await spinner.count()) {
    await spinner.first().waitFor({ state: "detached", timeout: 45_000 }).catch(() => {});
  }
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle" });
  await page.locator('input[type="email"]').fill(LOGIN.email);
  await page.locator('input[type="password"]').fill(LOGIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await waitForSpinnerGone(page);
}

async function capturePage(page: Page, fileName: string) {
  const filePath = path.join(SCREENSHOTS_DIR, `${fileName}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`  ✓ ${fileName}.png`);
}

async function runStaticScreenshots(page: Page) {
  const pages: PageCapture[] = [
    {
      name: "dashboard",
      path: "/dashboard",
      ready: async () => {
        await page.getByRole("link", { name: "Go to Cashier" }).first().waitFor({ timeout: 30_000 });
        await waitForSpinnerGone(page);
      },
    },
    {
      name: "cashier",
      path: "/cashier",
      ready: async () => {
        await page.locator(".search-bar-input").first().waitFor({ timeout: 30_000 });
        await waitForSpinnerGone(page);
      },
    },
    {
      name: "members",
      path: "/members",
      ready: async () => {
        await page.getByRole("heading", { name: "Members", level: 2 }).waitFor();
        await waitForSpinnerGone(page);
      },
    },
    {
      name: "products",
      path: "/products",
      ready: async () => {
        await page.getByRole("heading", { name: "Products", level: 2 }).waitFor();
        await waitForSpinnerGone(page);
      },
    },
    {
      name: "promotions",
      path: "/promotions",
      ready: async () => {
        await page.getByRole("heading", { name: "Promotions", level: 2 }).waitFor();
        await waitForSpinnerGone(page);
      },
    },
    {
      name: "orders",
      path: "/orders",
      ready: async () => {
        await page.getByRole("heading", { name: "Orders", level: 2 }).waitFor();
        await waitForSpinnerGone(page);
      },
    },
    {
      name: "reports",
      path: "/reports",
      ready: async () => {
        await page.getByRole("heading", { name: "Reports", level: 2 }).waitFor();
        await waitForSpinnerGone(page);
      },
    },
    {
      name: "branches",
      path: "/branches",
      ready: async () => {
        await page.getByRole("heading", { name: "Branches", level: 2 }).waitFor();
        await waitForSpinnerGone(page);
      },
    },
    {
      name: "settings",
      path: "/settings",
      ready: async () => {
        await page.getByRole("heading", { name: "Settings", level: 2 }).waitFor();
        await waitForSpinnerGone(page);
      },
    },
  ];

  console.log("\nCapturing page screenshots…");
  for (const entry of pages) {
    await page.goto(`${BASE_URL}${entry.path}`, { waitUntil: "networkidle" });
    await entry.ready();
    await page.waitForTimeout(600);
    await capturePage(page, entry.name);
  }
}

async function runCashierFlow(page: Page) {
  console.log("\nRecording cashier flow…");
  await page.goto(`${BASE_URL}/cashier`, { waitUntil: "networkidle" });
  await page.locator(".search-bar-input").first().waitFor({ timeout: 30_000 });
  await waitForSpinnerGone(page);

  const productSearch = page.getByPlaceholder("Search products by name or barcode...");
  await productSearch.fill("");
  await page.waitForTimeout(500);

  const productCard = page.locator(".grid button").first();
  if (await productCard.isVisible()) {
    await productCard.click();
    await page.waitForTimeout(400);
    await productCard.click().catch(() => {});
    await page.waitForTimeout(400);
  } else {
    console.warn("  ! No product cards found — continuing with empty cart flow");
  }

  const voucherInput = page.getByPlaceholder("Enter voucher code");
  await voucherInput.fill("WELCOME10");
  await page.getByRole("button", { name: "Apply" }).click();
  await page.waitForTimeout(800);

  const chargeButton = page.getByRole("button", { name: /Charge RM/ });
  if (await chargeButton.isEnabled()) {
    await chargeButton.click();
    await page.waitForTimeout(500);

    await page.locator(".payment-method-btn").filter({ hasText: "Cash" }).click();
    await page.waitForTimeout(400);

    const cashInput = page.locator("#cash-received");
    if (await cashInput.isVisible()) {
      const totalText = await page
        .getByRole("button", { name: /Confirm — RM/ })
        .textContent();
      const match = totalText?.match(/RM([\d.]+)/);
      const amount = match ? Math.ceil(parseFloat(match[1]) + 10) : 100;
      await cashInput.fill(String(amount));
    }

    await page.getByRole("button", { name: /Confirm — RM/ }).click();
    await page.getByRole("heading", { name: "Receipt" }).waitFor({ timeout: 30_000 });
    await page.waitForTimeout(800);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, "receipt.png"),
      fullPage: false,
    });
    console.log("  ✓ receipt.png");
  } else {
    console.warn("  ! Charge button disabled — skipping payment/receipt capture");
  }
}

function getFfmpegPath(): string | null {
  const candidates = [ffmpegStatic, "ffmpeg"].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try {
      execSync(`"${candidate}" -version`, { stdio: "ignore" });
      return candidate;
    } catch {
      // try next candidate
    }
  }
  return null;
}

function convertVideoToGif(ffmpeg: string) {
  const webmFiles = readdirSync(VIDEOS_DIR).filter((f) => f.endsWith(".webm"));
  if (!webmFiles.length) {
    console.warn("  ! No recorded video found for GIF conversion");
    return;
  }

  const input = path.join(VIDEOS_DIR, webmFiles[0]);
  const output = path.join(SCREENSHOTS_DIR, "cashier-flow.gif");

  // Optimized palette GIF — target under ~5MB via fps + width limits.
  // Manual fallback:
  //   ffmpeg -y -i input.webm -vf "fps=8,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[max=128];[s1][palette]paletteuse" cashier-flow.gif
  try {
    execSync(
      `"${ffmpeg}" -y -i "${input}" -filter_complex "fps=8,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer" "${output}"`,
      { stdio: "inherit" }
    );
    console.log("  ✓ cashier-flow.gif");
  } catch (err) {
    console.warn("  ! ffmpeg GIF conversion failed:", err);
    console.warn(`    Raw video kept at: ${input}`);
  }
}

async function main() {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  mkdirSync(VIDEOS_DIR, { recursive: true });

  console.log(`PharmaPOS capture → ${SCREENSHOTS_DIR}`);
  console.log(`Base URL: ${BASE_URL}`);

  const browser = await chromium.launch({ headless: true });

  const staticContext = await browser.newContext({ viewport: VIEWPORT });
  const staticPage = await staticContext.newPage();
  await login(staticPage);
  await runStaticScreenshots(staticPage);
  await staticContext.close();

  const videoContext = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: VIDEOS_DIR, size: VIEWPORT },
  });
  const videoPage = await videoContext.newPage();
  await login(videoPage);
  await runCashierFlow(videoPage);
  const video = videoPage.video();
  await videoContext.close();

  if (video) {
    const webmPath = path.join(VIDEOS_DIR, "cashier-flow.webm");
    await video.saveAs(webmPath);
    console.log(`  ✓ Raw video: ${webmPath}`);
  }

  await browser.close();

  const ffmpeg = getFfmpegPath();
  if (ffmpeg) {
    console.log("\nConverting video to GIF…");
    convertVideoToGif(ffmpeg);
  } else {
    console.warn(
      "\nffmpeg not found — skipping GIF conversion.\n" +
        "Install ffmpeg, then run:\n" +
        '  ffmpeg -y -i docs/screenshots/.raw-videos/cashier-flow.webm -filter_complex "fps=8,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer" docs/screenshots/cashier-flow.gif'
    );
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
