import { test, expect } from "@playwright/test";
async function begin(page: any) {
  await page.goto("/");
  await page.getByLabel("あなたの名前").fill("起業する人");
  await page.getByLabel("はじめの暮らし").selectOption("comfortable");
  await page
    .getByRole("button", { name: "人生をはじめる", exact: true })
    .click();
}
async function nav(page: any, name: string) {
  if (
    await page
      .getByRole("button", { name: "メニュー", exact: true })
      .isVisible()
  )
    await page.getByRole("button", { name: "メニュー", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
async function json(page: any) {
  await page.getByRole("button", { name: "セーブ・設定", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream!) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString());
}
test("仕事・小売・再投資・法人移管・二社設立・保存復元を実際に操作", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await begin(page);
  await nav(page, "仕事を探す");
  await page
    .getByTestId("job-cafe")
    .getByRole("button", { name: "応募する", exact: true })
    .click();
  await page.getByRole("button", { name: "30日進める", exact: true }).click();
  await nav(page, "事業を営む");
  await page.getByLabel("事業名", { exact: true }).fill("暮らしの文具店");
  await page.getByLabel("事業の種類").selectOption("retail");
  await page.getByRole("button", { name: "事業を開設する" }).click();
  await expect(
    page.getByRole("heading", { name: "暮らしの文具店", exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "商品・サービス", exact: true }).click();
  await page.getByLabel("仕入数量", { exact: true }).fill("20");
  await page.getByRole("button", { name: "現金で仕入れる" }).click();
  await page
    .getByRole("button", { name: "余暇の予定を事業運営にする" })
    .click();
  await page.getByRole("button", { name: "7日進める", exact: true }).click();
  await page.getByRole("tab", { name: "設備・運営", exact: true }).click();
  await page.getByRole("button", { name: /設備を追加/ }).click();
  await expect(page.getByText("設備 Lv.2 / 拠点 1 / 販売経路 1")).toBeVisible();
  await nav(page, "会社・所有権");
  await page.getByLabel("会社の商号").fill("第一ラボ株式会社");
  await page.getByLabel("資本金（円）", { exact: true }).fill("20000");
  await page
    .getByRole("button", { name: "会社を設立する", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "第一ラボ株式会社", exact: true }),
  ).toBeVisible();
  await page.getByLabel("会社の商号").fill("第二ラボ株式会社");
  await page.getByLabel("資本金（円）", { exact: true }).fill("10000");
  await page
    .getByRole("button", { name: "会社を設立する", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "第二ラボ株式会社", exact: true }),
  ).toBeVisible();
  await nav(page, "事業を営む");
  await page.getByRole("tab", { name: "事業別財務", exact: true }).click();
  await page
    .getByLabel("移管先の会社")
    .selectOption({ label: "第一ラボ株式会社" });
  await page.getByRole("button", { name: "個人事業を法人へ移管" }).click();
  await expect(page.locator(".enterprise-heading .tag").first()).toContainText(
    "第一ラボ株式会社",
  );
  await nav(page, "会社・所有権");
  await page.getByRole("button", { name: /第一ラボ株式会社 経営中/ }).click();
  await expect(page.getByText("暮らしの文具店", { exact: true })).toBeVisible();
  await page.screenshot({ path: "../phase2-desktop.png", fullPage: true });
  const saved = await json(page);
  expect(saved.schemaVersion).toBe(7);
  expect(saved.companies).toHaveLength(2);
  expect(saved.ventures[0].book.revenue).toBeGreaterThan(0);
  expect(saved.ventures[0].level).toBe(2);
  expect(saved.ventures[0].ownerId).toBe(saved.companies[0].id);
  expect(saved.employments[0].workedHours).toBeGreaterThan(0);
  await page.getByRole("button", { name: "今すぐ保存" }).click();
  await expect(page.locator(".save-status")).toContainText("自動保存済み");
  await page.reload();
  await page.getByRole("button", { name: /スロット 1 · 起業する人/ }).click();
  await nav(page, "会社・所有権");
  await expect(
    page.getByRole("button", { name: /第一ラボ株式会社 経営中/ }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("スマートフォンの新事業タブ・会社画面と仕入不足エラー", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await begin(page);
  await nav(page, "事業を営む");
  await page.getByLabel("事業の種類").selectOption("retail");
  await page.getByRole("button", { name: "事業を開設する" }).click();
  for (const tab of [
    "顧客・売上",
    "商品・サービス",
    "設備・運営",
    "従業員",
    "事業別財務",
  ]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("tab", { name: "商品・サービス", exact: true }).click();
  await page.getByLabel("仕入数量", { exact: true }).fill("1000000");
  await page.getByRole("button", { name: "現金で仕入れる" }).click();
  await expect(page.getByRole("alert")).toContainText("仕入資金が不足");
  await nav(page, "会社・所有権");
  await page.getByLabel("資本金（円）", { exact: true }).fill("10000");
  await page
    .getByRole("button", { name: "会社を設立する", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "青葉ラボ株式会社", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "../phase2-mobile.png", fullPage: true });
});
