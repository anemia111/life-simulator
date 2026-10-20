import { test, expect, type Page } from "@playwright/test";
async function begin(page: Page) {
  await page.goto("/");
  await page.getByLabel("あなたの名前").fill("街を生きる");
  await page.getByLabel("はじめの暮らし").selectOption("comfortable");
  await page
    .getByRole("button", { name: "人生をはじめる", exact: true })
    .click();
}
async function go(page: Page, name: string) {
  const menu = page.getByRole("button", { name: "メニュー", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
test("PCで世界経済・企業・NPC・市場・求人・ニュースを操作し保存する", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await begin(page);
  await go(page, "仕事を探す");
  await page
    .getByRole("button", { name: "応募する", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "30日進める", exact: true }).click();
  await page.getByRole("button", { name: "7日進める", exact: true }).click();
  await go(page, "世界・都市経済");
  await expect(
    page.getByRole("heading", { name: "街は、今日も動いている。" }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "2026-05-01", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "../phase4-desktop.png", fullPage: true });
  await page.getByRole("tab", { name: "競合企業", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "競争する経済主体" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /青葉.*商会/ })
    .first()
    .click();
  await expect(
    page.getByText("信用限度 / 累計借入", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "NPC・暮らし" }).click();
  await expect(
    page.getByRole("heading", { name: "それぞれの人生" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /安定志向/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "直近の24時間" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "労働市場", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "企業が必要としている仕事" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "市場シェア" }).click();
  await expect(page.getByText(/一日の市場規模/)).toHaveCount(3);
  await page.getByRole("tab", { name: "企業ニュース" }).click();
  await expect(
    page.getByRole("heading", { name: "青葉ビジネス・生活通信" }),
  ).toBeVisible();
  await expect(page.locator(".world-news-list li")).not.toHaveCount(0);
  await go(page, "都市マップ");
  await page.getByLabel("マップ情報表示").selectOption("population");
  await page
    .getByRole("button", { name: "中央商業地区を開く", exact: true })
    .click();
  await expect(page.getByText("夜人口", { exact: true })).toBeVisible();
  const menu = page.getByRole("button", { name: "メニュー", exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: "セーブ・設定", exact: true }).click();
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "JSONを書き出す", exact: true })
    .click();
  const stream = await (await pending).createReadStream();
  const chunks = [];
  for await (const c of stream!) chunks.push(c);
  const state = JSON.parse(Buffer.concat(chunks).toString());
  expect(state.schemaVersion).toBe(5);
  expect(state.simulation.firms.length).toBeGreaterThanOrEqual(20);
  expect(
    state.simulation.residents.some((r: any) => r.earned > 0),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});
test("320pxスマホで世界情報を切り替えNPCと会い、横スクロールを局所化する", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await begin(page);
  await go(page, "世界・都市経済");
  await expect(
    page.getByRole("heading", { name: "街は、今日も動いている。" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(321);
  await page.getByRole("tab", { name: "NPC・暮らし" }).click();
  const meet = page.getByRole("button", {
    name: "地域で会って知り合う（1時間）",
    exact: true,
  });
  await meet.scrollIntoViewIfNeeded();
  await meet.click();
  await expect(
    page.getByRole("button", { name: "1時間交流する", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "../phase4-mobile.png", fullPage: true });
  await page.getByRole("tab", { name: "企業ニュース" }).click();
  await expect(
    page.getByRole("heading", { name: "青葉ビジネス・生活通信" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(321);
});
