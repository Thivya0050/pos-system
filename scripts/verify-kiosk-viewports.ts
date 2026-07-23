/**
 * Re-verify kiosk fixes at exact panel resolutions (DPR 1).
 * Requires production server: npm run start
 */

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE_URL = process.env.CAPTURE_BASE_URL ?? "http://localhost:3000";
const OUT_DIR = path.join(process.cwd(), "docs", "kiosk-verify");

const VIEWPORTS = [
  { id: "device1-win11-portrait-1080x1920", width: 1080, height: 1920 },
  { id: "device2-android-landscape-1920x1080", width: 1920, height: 1080 },
  { id: "device3-android-portrait-1080x1920", width: 1080, height: 1920 },
] as const;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results: unknown[] = [];

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/self-checkout`, {
      waitUntil: "networkidle",
      timeout: 60_000,
    });
    await page.waitForSelector(".kiosk-root", { timeout: 30_000 });
    await page.waitForTimeout(1500);

    const metrics = (await page.evaluate(`(() => {
      const id = ${JSON.stringify(vp.id)};
      const pay = document.querySelector(".kiosk-btn--primary");
      const staff = document.querySelector(".kiosk-staff-call-btn");
      const root = document.querySelector(".kiosk-root");
      const cart = document.querySelector(".kiosk-cart-pane");
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      function box(el) {
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return {
          top: Math.round(b.top),
          bottom: Math.round(b.bottom),
          left: Math.round(b.left),
          right: Math.round(b.right),
          width: Math.round(b.width),
          height: Math.round(b.height),
        };
      }

      const P = box(pay);
      const S = box(staff);
      const C = box(cart);
      let overlap = false;
      let overlapAreaPx = 0;
      if (P && S) {
        overlap = !(P.right <= S.left || P.left >= S.right || P.bottom <= S.top || P.top >= S.bottom);
        if (overlap) {
          overlapAreaPx = Math.round(
            Math.max(0, Math.min(P.right, S.right) - Math.max(P.left, S.left)) *
              Math.max(0, Math.min(P.bottom, S.bottom) - Math.max(P.top, S.top))
          );
        }
      }

      const cs = root ? getComputedStyle(root) : null;
      const rootHeightPx = cs ? parseFloat(cs.height) : null;

      // Inspect cascade: base .kiosk-root height + any @supports override
      const heightDecls = [];
      let hasSupportsDvh = false;
      for (const sheet of Array.from(document.styleSheets)) {
        let rules;
        try { rules = sheet.cssRules; } catch { continue; }
        for (const rule of Array.from(rules || [])) {
          if (rule.type === CSSRule.SUPPORTS_RULE) {
            const supports = rule;
            if (String(supports.conditionText || "").includes("100dvh") ||
                String(supports.conditionText || "").includes("dvh")) {
              for (const inner of Array.from(supports.cssRules || [])) {
                if (inner.type !== CSSRule.STYLE_RULE) continue;
                if (!inner.selectorText || !inner.selectorText.split(",").some((s) => s.trim() === ".kiosk-root")) continue;
                const h = inner.style.getPropertyValue("height");
                if (h) {
                  hasSupportsDvh = true;
                  heightDecls.push("supports:" + h.trim());
                }
              }
            }
            continue;
          }
          if (rule.type !== CSSRule.STYLE_RULE) continue;
          if (!rule.selectorText || !rule.selectorText.split(",").some((s) => s.trim() === ".kiosk-root")) continue;
          const h = rule.style.getPropertyValue("height");
          if (h) heightDecls.push(h.trim());
        }
      }

      const orientation = vw > vh ? "landscape" : "portrait";
      const portraitMQ = matchMedia("(orientation: portrait)").matches;

      return {
        id,
        orientation,
        portraitMediaMatches: portraitMQ,
        bodyOverflowX: document.body.scrollWidth > document.body.clientWidth + 1,
        documentMatchesViewport:
          document.documentElement.clientWidth === vw &&
          document.documentElement.clientHeight === vh,
        rootHeightPx,
        rootMatchesViewportHeight: rootHeightPx !== null && Math.abs(rootHeightPx - vh) <= 1,
        heightDeclsOnKioskRoot: heightDecls,
        hasSupportsDvhOverride: hasSupportsDvh,
        pay: P,
        staff: S,
        cart: C,
        staffOverlapsPay: overlap,
        overlapAreaPx,
      };
    })()`)) as Record<string, unknown>;

    const shotPath = path.join(OUT_DIR, `${vp.id}-fixed.png`);
    await page.screenshot({ path: shotPath, fullPage: false });
    results.push({
      ...metrics,
      viewport: { width: vp.width, height: vp.height, dpr: 1 },
      screenshot: shotPath,
    });
    console.log(`\n=== ${vp.id} ===`);
    console.log(JSON.stringify(results[results.length - 1], null, 2));
    await context.close();
  }

  writeFileSync(path.join(OUT_DIR, "metrics-fixed.json"), JSON.stringify(results, null, 2));

  const landscape = results.find(
    (r) => (r as { id?: string }).id === "device2-android-landscape-1920x1080"
  ) as
    | {
        staffOverlapsPay: boolean;
        overlapAreaPx: number;
        heightDeclsOnKioskRoot: string[];
        hasSupportsDvhOverride?: boolean;
        rootMatchesViewportHeight: boolean;
        staff: { right: number };
        cart: { left: number };
      }
    | undefined;

  const allNoOverlap = results.every(
    (r) => !(r as { staffOverlapsPay?: boolean }).staffOverlapsPay
  );
  const heightFallbackOk =
    Array.isArray(landscape?.heightDeclsOnKioskRoot) &&
    landscape.heightDeclsOnKioskRoot.includes("100vh") &&
    Boolean(landscape.hasSupportsDvhOverride);

  console.log("\n=== CHECKS ===");
  console.log(
    "Landscape staff/Pay overlap:",
    landscape?.staffOverlapsPay ? `FAIL (${landscape.overlapAreaPx}px²)` : "PASS (0)"
  );
  if (landscape?.staff && landscape?.cart) {
    console.log(
      `Landscape staff clears cart: staff.right=${landscape.staff.right} cart.left=${landscape.cart.left} (gap ${landscape.cart.left - landscape.staff.right}px)`
    );
  }
  console.log(
    "CSS height fallback (100vh base + @supports 100dvh):",
    heightFallbackOk
      ? "PASS"
      : `FAIL ${JSON.stringify({ decls: landscape?.heightDeclsOnKioskRoot, hasSupportsDvh: landscape?.hasSupportsDvhOverride })}`
  );
  console.log(
    "Root height matches viewport (with dvh supported here):",
    landscape?.rootMatchesViewportHeight ? "PASS" : "FAIL"
  );

  if (!allNoOverlap || !heightFallbackOk) {
    process.exitCode = 1;
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
