import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const markup = /* html */ `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Story Card Preview</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 2rem; }
      .story-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem; }
      .story-card__chips { display: flex; gap: 0.5rem; }
      .story-card__chip { background: #eef2ff; padding: 0.2rem 0.6rem; border-radius: 999px; }
      .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
    </style>
  </head>
  <body>
    <article class="story-card" role="article" aria-labelledby="story-latency-title" aria-keyshortcuts="g G Enter Esc t ?" tabindex="0">
      <p class="sr-only">At Thu, 08 Nov 2025 05:00:00 GMT, Connector latency > 600ms. Confidence 82%.</p>
      <h3 id="story-latency-title">Tool replies are delayed</h3>
      <p class="story-card__subtitle">Connector edge exceeded latency budget</p>
      <span class="story-card__confidence" aria-label="Confidence 82 percent">82% confidence</span>
      <div class="story-card__chips">
        <span class="story-card__chip" role="status" aria-label="1 logs references">Logs: 1</span>
        <span class="story-card__chip" role="status" aria-label="1 traces references">Traces: 1</span>
        <span class="story-card__chip" role="status" aria-label="1 metrics references">Metrics: 1</span>
      </div>
      <button type="button" class="story-card__action" aria-pressed="false" aria-keyshortcuts="Enter">Run reprobe</button>
    </article>
  </body>
</html>`;

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(markup);
  const results = await new AxeBuilder({ page }).analyze();
  await browser.close();

  if (results.violations.length > 0) {
    console.error("Axe violations detected:");
    for (const violation of results.violations) {
      console.error(`- ${violation.id}: ${violation.help}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("✅ Axe found no accessibility violations for story card stub");
};

void run().catch((error) => {
  console.error("Axe check failed", error);
  process.exitCode = 1;
});
