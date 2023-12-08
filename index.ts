import initLogger from "./utils/logger";
import { writeFileSync, readFileSync } from "node:fs";
import parseConfig from "./utils/config";
import { Browser, Page, executablePath } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import Papa from "papaparse";

type ProductType = {
  name: string;
  price: string;
};

let logger = initLogger("trace");

async function getMaxPages(page: Page) {
  let pageSelector = "a.pagination-widget__page-link_last" as const;
  await page.waitForSelector(pageSelector);
  let maxPages = await page.$(pageSelector).then((handle) =>
    handle!.evaluate((el) => {
      let url = new URL(el.href);
      return +url.searchParams.get("p")!;
    }),
  );
  logger.info(`Got max pages: ${maxPages}`);
  return maxPages;
}

async function setupPage(page: Page) {
  await page.setRequestInterception(true);
  page.setDefaultTimeout(0);
  page.setDefaultNavigationTimeout(0);
  let include = [
    "qrator",
    "product",
    "calculator",
    "input-select",
    "button",
    "ajax",
    "tooltip",
    "deffer",
  ];

  page.on("request", (req) => {
    let url = req.url();
    let resourceType = req.resourceType();

    if (include.some((pattern) => url.includes(pattern))) {
      return req.continue();
    }

    if (resourceType === "document") {
      return req.continue();
    }

    return req.abort();
  });

  const preloadFile = readFileSync("./stealth.min.js", "utf8");
  await page.evaluateOnNewDocument(preloadFile);
}

async function getProducts(page: Page) {
  let productPriceSelector = "div.product-buy__price" as const;
  let productNameSelector = "a.catalog-product__name" as const;
  let productContainerSelector = "div.catalog-product" as const;

  let productsList: ProductType[] = [];

  await page.waitForSelector(productContainerSelector);
  await page.waitForSelector(productPriceSelector);

  let productContainers = await page.$$(productContainerSelector);

  for (let container of productContainers) {
    let nameTag = container
      .$(productNameSelector)
      .then((element) => element?.evaluate((el) => el.firstChild?.textContent));

    let priceTag = container
      .$(productPriceSelector)
      .then((element) => element?.evaluate((el) => el.firstChild?.textContent));

    let [name, price] = await Promise.all([nameTag, priceTag]);

    if (!name) {
      logger.warn("Skipping product, name selector failed");
      continue;
    }
    if (!price) {
      logger.warn("Skipping product, price selector failed");
      continue;
    }

    productsList.push({ name, price });
  }

  return productsList;
}

function setPageParam(url: URL, page: number) {
  let params = url.searchParams;
  params.set("p", "" + page);
}

async function main() {
  let config = parseConfig();
  logger.level = config.logLevel;
  puppeteer.use(StealthPlugin());
  let url = new URL(config.url);

  const browser: Browser = await puppeteer.launch({
    headless: config.headless,
    devtools: true,
    executablePath: executablePath(),
    timeout: 0,
    args: ["--no-sandbox"],
  });

  logger.info("Launched browser");

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(0);
  logger.trace("Created page");

  await setupPage(page);
  logger.trace("Page is set up");

  page.goto(config.url.toString());

  let maxPages = config.endPage ?? (await getMaxPages(page));

  await new Promise((res) => setTimeout(res, 1000));

  let allProducts: { name: string; price: string }[] = [];

  for (let i = 0; i < (config.endPage ?? maxPages); i++) {
    let currentPage = i + 1;
    if (config.startPage > currentPage) continue;
    setPageParam(url, currentPage);

    await page.goto(url.toString());

    logger.info("Getting products for page " + currentPage);
    let products = await getProducts(page);

    allProducts = [...allProducts, ...products];
  }

  logger.info("Genertaing output");
  let csv = Papa.unparse(allProducts);
  logger.info(`Saving output to ${config.output}`);
  writeFileSync(config.output, csv);
  await browser.close();
  logger.info("Finished");
}

main();
