import { test, expect } from "@playwright/test";
async function begin(page: any) {
  await page.goto("/");
  await page.getByLabel("あなたの名前").fill("まちで暮らす人");
  await page.getByLabel("はじめの暮らし").selectOption("comfortable");
  await page
    .getByRole("button", { name: "人生をはじめる", exact: true })
    .click();
}
async function go(page: any, name: string) {
  const menu = page.getByRole("button", { name: "メニュー", exact: true });
  if (await menu.isVisible()) await menu.click();
  if (name === "セーブ・設定")
    await page.getByRole("button", { name, exact: true }).click();
  else
    await page
      .getByRole("navigation")
      .getByRole("button", { name, exact: true })
      .click();
}
async function exportState(page: any) {
  await go(page, "セーブ・設定");
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "JSONを書き出す", exact: true })
    .click();
  const stream = await (await pending).createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream!) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString());
}
test("マップで引越し→求人応募→小売の物件入居→販売→保存復元", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await begin(page);
  await go(page, "都市マップ");
  await page
    .getByRole("button", { name: "川辺住宅地区を開く", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "川辺住宅地区 シェアハウスを選択",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "この住居へ引っ越す", exact: false })
    .click();
  await expect(
    page.getByText("現在の住居です。", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "地図に戻る", exact: true }).click();
  await page.getByRole("button", { name: "都市全体へ", exact: true }).click();
  await page
    .getByRole("button", { name: "若葉学生街を開く", exact: true })
    .click();
  await page
    .getByRole("button", { name: "喫茶 こもれびを選択", exact: true })
    .click();
  await page
    .getByRole("button", { name: "この勤務先に応募する", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "現在の勤務先", exact: true }),
  ).toBeDisabled();
  await go(page, "事業を営む");
  await page.getByLabel("事業名", { exact: true }).fill("まちの文具店");
  await page.getByLabel("事業の種類").selectOption("retail");
  await page.getByLabel("初期事業資金（円）").fill("50000");
  await page.getByRole("button", { name: "事業を開設する" }).click();
  await page.getByRole("tab", { name: "商品・サービス", exact: true }).click();
  await page.getByLabel("仕入数量", { exact: true }).fill("20");
  await page.getByRole("button", { name: "現金で仕入れる" }).click();
  await page
    .getByRole("button", { name: "余暇の予定を事業運営にする" })
    .click();
  await page.getByRole("button", { name: "マップで事業拠点を探す" }).click();
  await page
    .getByRole("button", { name: "若葉学生街を開く", exact: true })
    .click();
  await page
    .getByRole("button", { name: "若葉学生街 路面店舗を選択", exact: true })
    .click();
  await expect(
    page.getByText("基準条件での需要", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "この物件を借りる", exact: false })
    .click();
  await expect(
    page.getByRole("heading", { name: "現在の賃貸契約", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "7日進める", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.screenshot({ path: "../phase3-desktop.png", fullPage: true });
  const state = await exportState(page);
  expect(state.schemaVersion).toBe(4);
  expect(state.spatial.homePropertyId).toBe("residential-share");
  expect(
    state.spatial.leases.some(
      (l: any) =>
        l.propertyId === "campus-shop" && l.tenantId === state.ventures[0].id,
    ),
  ).toBe(true);
  expect(state.ventures[0].book.revenue).toBeGreaterThan(0);
  expect(state.employments[0].workedHours).toBeGreaterThan(0);
  await page.getByRole("button", { name: "今すぐ保存" }).click();
  await expect(page.locator(".save-status")).toContainText("自動保存済み");
  await page.reload();
  await page
    .getByRole("button", { name: /スロット 1 · まちで暮らす人/ })
    .click();
  await go(page, "都市マップ");
  await expect(
    page.getByRole("button", {
      name: "若葉学生街 路面店舗 まちの文具店",
      exact: false,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("スマホで都市→地区→施設、詳細パネルと日常施設の登録・利用", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await begin(page);
  await go(page, "都市マップ");
  await page.getByRole("button", { name: "ワールド", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "青葉市", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "この都市を見る", exact: false })
    .click();
  await page
    .getByRole("button", { name: "若葉学生街を開く", exact: true })
    .click();
  await page
    .getByRole("button", { name: "若葉学生街 図書室を選択", exact: true })
    .press("Enter");
  await expect(page.getByRole("region", { name: "物件の詳細" })).toBeVisible();
  await page
    .getByRole("button", { name: "日常の施設に登録", exact: false })
    .click();
  await page
    .getByRole("button", { name: "この施設を利用する", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "日常の施設から解除", exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "../phase3-mobile.png", fullPage: false });
  await page.getByRole("button", { name: "地図に戻る", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "若葉学生街 図書室 日常の施設",
      exact: false,
    }),
  ).toBeVisible();
  const state = await exportState(page);
  expect(state.spatial.favorites).toContain("campus-library");
  expect(state.person.skills.digital).toBe(0.5);
  expect(
    state.manualActions.some(
      (a: any) => a.actionId === "map-visit" && a.hours === 2,
    ),
  ).toBe(true);
});
test("資金不足・競合物件の入居状態・用途表示を実際の地図で確認", async ({
  page,
}) => {
  await begin(page);
  await go(page, "事業を営む");
  await page.getByLabel("事業の種類").selectOption("retail");
  await page.getByRole("button", { name: "事業を開設する" }).click();
  await go(page, "都市マップ");
  await page
    .getByRole("button", { name: "中央商業地区を開く", exact: true })
    .click();
  await page
    .getByRole("button", { name: "中央商業地区 路面店舗を選択", exact: true })
    .click();
  await page
    .getByRole("button", { name: "この物件を借りる", exact: false })
    .click();
  await expect(page.getByRole("alert")).toContainText("入居資金が不足");
  await page.getByRole("button", { name: "地図に戻る", exact: true }).click();
  await page
    .getByRole("button", { name: "中央商業地区 生活雑貨店を選択", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "この立地の競争", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "この物件を借りる", exact: false }),
  ).toHaveCount(0);
});
