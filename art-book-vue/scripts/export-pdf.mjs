import { chromium } from "playwright";
import { createServer } from "vite";

const host = "127.0.0.1";
const port = 4178;
const outputPath = new URL("../book-export.pdf", import.meta.url).pathname;
const pageSizes = {
  trade: { width: "6in", height: "9in" },
  square: { width: "8in", height: "8in" },
  a5: { width: "148mm", height: "210mm" },
};
const pageSize = pageSizes[process.env.ART_BOOK_PAGE_SIZE ?? "trade"] ?? pageSizes.trade;

const server = await createServer({
  server: {
    host,
    port,
  },
});

await server.listen();

const browser = await chromium.launch();
const page = await browser.newPage();

try {
  await page.goto(`http://${host}:${port}`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__ART_BOOK_PAGED_READY__ === true, null, {
    timeout: 30000,
  });

  await page.pdf({
    path: outputPath,
    width: pageSize.width,
    height: pageSize.height,
    printBackground: true,
    preferCSSPageSize: false,
  });

  console.log(`Exported ${outputPath}`);
} finally {
  await browser.close();
  await server.close();
}
