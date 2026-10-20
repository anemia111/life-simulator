import { test, expect, type Page } from "@playwright/test";
import { newGame, dispatch } from "../src/engine";
import { receive } from "../src/engine/finance";
import { book } from "../src/engine/enterprise/accounting";
async function begin(page: Page) {
  await page.goto("/");
  await page.getByLabel("あなたの名前").fill("世界へ投資");
  await page.getByLabel("はじめの暮らし").selectOption("comfortable");
  await page
    .getByRole("button", { name: "人生をはじめる", exact: true })
    .click();
}
async function go(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "メニュー", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name, exact: true }).click();
}
async function save(page: Page) {
  await go(page, "セーブ・設定");
  const wait = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "JSONを書き出す", exact: true })
    .click();
  const stream = await (await wait).createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString());
}
test("証券入金・買付・約定・取消・投信購入を実操作し元帳付きで保存", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await begin(page);
  await go(page, "証券・投資");
  await page.getByRole("button", { name: "資産・注文", exact: true }).click();
  await page.getByLabel("振替金額").fill("50000");
  await page
    .getByRole("button", { name: "証券口座へ入金", exact: true })
    .click();
  await page.getByRole("button", { name: "銘柄を探す", exact: true }).click();
  await page.getByRole("button", { name: "注文を出す", exact: true }).click();
  await page.getByRole("button", { name: "1日進める", exact: true }).click();
  await page.getByRole("button", { name: "資産・注文", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "保有証券", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("約定済", { exact: false }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "銘柄を探す", exact: true }).click();
  await page.getByLabel("注文方法").selectOption("limit");
  await page.getByLabel("指値価格").fill("1");
  await page.getByRole("button", { name: "注文を出す", exact: true }).click();
  await page.getByRole("button", { name: "資産・注文", exact: true }).click();
  await page.getByRole("button", { name: "取消", exact: true }).click();
  await page
    .getByRole("button", { name: "指数・ファンド", exact: true })
    .click();
  await page.getByRole("button", { name: /積立/ }).first().click();
  await page.getByText("組入銘柄と実保有数を見る", { exact: true }).click();
  await expect(page.locator("details tbody tr")).toHaveCount(225);
  await page.getByLabel("ファンド口数").fill("10");
  await page.getByRole("button", { name: "購入する", exact: true }).click();
  await page.screenshot({
    path: "../phase6-market-desktop.png",
    fullPage: true,
  });
  const s = await save(page);
  const a = s.securities.accounts.find((a: any) => a.id === "player");
  expect(s.schemaVersion).toBe(7);
  expect(a.deposits).toBe(50000);
  expect(a.positions.filter((p: any) => p.quantity > 0)).toHaveLength(2);
  expect(
    s.securities.orders.some(
      (o: any) => o.accountId === "player" && o.status === "cancelled",
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("会社IPOを申請し公募資金と個人売出代金を分離", async ({ page }) => {
  let s = newGame("上場する人生", "comfortable");
  receive(s, 300000, "試験の開始資産");
  s = dispatch(s, {
    type: "enterprise",
    input: {
      operation: "create-company",
      name: "青葉公開研究所",
      amount: 150000,
      value: 100,
    },
  });
  const c = s.companies[0];
  c.founded = "2025-01-01";
  book(s, c, "試験の既存事業利益", { cash: 20000, revenue: 20000 });
  await begin(page);
  await go(page, "セーブ・設定");
  await page.getByLabel("JSONを取り込む").setInputFiles({
    name: "ipo-ready.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(s)),
  });
  await go(page, "証券・投資");
  await page.getByRole("button", { name: "IPO・株主", exact: true }).click();
  await page.getByLabel("対象会社").selectOption(c.id);
  await page.getByLabel("公募の新株数").fill("20");
  await page.getByLabel("売り出す自分の株数").fill("5");
  await page.getByLabel("募集価格 / 株").fill("1700");
  await page
    .getByRole("button", { name: "上場を申請する", exact: true })
    .click();
  await page.getByRole("button", { name: "7日進める", exact: true }).click();
  await page.getByRole("button", { name: "1日進める", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "株主構成と議決", exact: true }),
  ).toBeVisible();
  const saved = await save(page);
  expect(saved.securities.offerings[0].status).toBe("listed");
  expect(saved.securities.offerings[0].raised).toBeGreaterThan(0);
  expect(
    saved.securities.accounts.find((a: any) => a.id === "player").book.cash,
  ).toBeGreaterThan(0);
  expect(saved.companies[0].shares).toBe(120);
});
test("320pxスマホで225社検索・ファンド・資産の表示が収まる", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await begin(page);
  await go(page, "証券・投資");
  await page.getByLabel("銘柄検索").fill("LS1001");
  await expect(page.locator(".market-list tbody tr")).toHaveCount(1);
  for (const name of [
    "資産・注文",
    "指数・ファンド",
    "IPO・株主",
    "市場ニュース",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "銘柄を探す", exact: true }).click();
  await expect(page.locator(".market-detail h2")).not.toHaveText(/投信|ETF/);
  await page.screenshot({
    path: "../phase6-market-mobile.png",
    fullPage: true,
  });
});
