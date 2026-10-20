import { test, expect } from "@playwright/test";
async function start(page: any) {
  await page.goto("/");
  await page.getByLabel("あなたの名前").fill("はる");
  await page
    .getByRole("button", { name: "人生をはじめる", exact: true })
    .click();
  await expect(page.getByText("おかえりなさい、はるさん。")).toBeVisible();
}
test("人生開始から勤務・給与・学習・開業・設備投資・退職・保存復元", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "仕事を探す" })
    .click();
  await page
    .getByTestId("job-cafe")
    .getByRole("button", { name: "応募する", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "カフェスタッフ", exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "7日進める", exact: true }).click();
  await page.getByRole("button", { name: "30日進める", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "ダッシュボード" })
    .click();
  await expect(page.getByTestId("cash")).not.toHaveText("¥26,000");
  await page
    .getByRole("button", { name: "デジタルを学ぶ", exact: false })
    .click();
  await page.getByRole("button", { name: "7日進める", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "事業を営む" })
    .click();
  await page
    .getByRole("button", { name: "この事業をはじめる", exact: false })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "小さな制作室" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "7日進める", exact: true }).click();
  await page
    .getByRole("button", { name: "設備を拡張する", exact: false })
    .click();
  await expect(page.getByText("設備 Lv.2", { exact: false })).toBeVisible();
  await page.getByLabel("販売価格", { exact: true }).fill("3000");
  await page.getByRole("button", { name: "価格を変更" }).click();
  await expect(
    page.getByText("現在の単価 ¥3,000", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "仕事を探す" })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "仕事・シフト管理", exact: true })
    .click();
  await page.getByRole("button", { name: "この仕事を辞める" }).click();
  await page
    .getByRole("button", { name: "退職して未払給与を精算する" })
    .click();
  await expect(page.getByTestId("contract-cafe")).toHaveCount(0);
  await page.getByRole("button", { name: "セーブ・設定", exact: true }).click();
  await page.getByRole("button", { name: "今すぐ保存" }).click();
  await page.reload();
  await page.getByRole("button", { name: /スロット 1 · はる/ }).click();
  await expect(page.getByText("おかえりなさい、はるさん。")).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "事業を営む" })
    .click();
  await expect(page.getByText("設備 Lv.2", { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});
test("スマホでメニューと時間進行・レイアウト", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await start(page);
  await page.getByRole("button", { name: "1日進める", exact: true }).click();
  await expect(page.getByText("DAY 2", { exact: true })).toBeVisible();
  for (const name of [
    "仕事を探す",
    "事業を営む",
    "資産と収支",
    "学びとスキル",
    "暮らし",
    "仕事・シフト管理",
    "カレンダー",
    "人間関係",
    "行動メニュー",
    "日次・月次レポート",
    "ダッシュボード",
  ]) {
    await page.getByRole("button", { name: "メニュー", exact: true }).click();
    await page
      .getByRole("navigation")
      .getByRole("button", { name, exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});
test("JSON入出力と不正ファイルの拒否", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "セーブ・設定", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSONを書き出す" }).click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const buffer = Buffer.concat(chunks);
  await page.getByLabel("読み込み先").selectOption("2");
  await page
    .getByLabel("JSONを取り込む")
    .setInputFiles({ name: "save.json", mimeType: "application/json", buffer });
  await expect(
    page.getByText("現在はスロット 2", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("JSONを取り込む").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"schemaVersion":99}'),
  });
  await expect(page.getByRole("alert")).toContainText("セーブ形式が不正");
});
test("別スロットで新しい人生を開始し元の人生に戻る", async ({ page }) => {
  await start(page);
  await expect(page.locator(".save-status")).toContainText("自動保存済み");
  await page.getByRole("button", { name: "別の人生をはじめる" }).click();
  await page.getByLabel("あなたの名前").fill("新しい人生");
  await page
    .getByRole("combobox", { name: "セーブスロット", exact: true })
    .selectOption("2");
  await page
    .getByRole("button", { name: "人生をはじめる", exact: true })
    .click();
  await expect(
    page.getByText("おかえりなさい、新しい人生さん。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "セーブ・設定", exact: true }).click();
  await page
    .getByRole("button", { name: "読み込む", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "読み込みを確定" }).click();
  await expect(page.getByText("おかえりなさい、はるさん。")).toBeVisible();
});
test("事業の休業・再開・廃業と低資金からの継続", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("はじめの暮らし").selectOption("comfortable");
  await page
    .getByRole("button", { name: "人生をはじめる", exact: true })
    .click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "事業を営む" })
    .click();
  await page
    .getByRole("button", { name: "この事業をはじめる", exact: false })
    .first()
    .click();
  await page.getByRole("button", { name: "休業する" }).click();
  await page.getByRole("button", { name: "7日進める", exact: true }).click();
  await expect(page.getByText("0 件を販売", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "再開する" }).click();
  await page.getByRole("button", { name: "7日進める", exact: true }).click();
  await expect(page.getByText("0 件を販売", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "この事業を廃業する" }).click();
  await page.getByRole("button", { name: "設備を手放し、廃業する" }).click();
  await expect(page.getByText("得意なことを、仕事に。")).toBeVisible();
  await page.getByRole("button", { name: "30日進める", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "仕事を探す" })
    .click();
  // NPCが募集枠を競うため、その日に応募可能な初心者求人を選ぶ。
  const card = page
    .locator(".job-card")
    .filter({
      has: page.getByText("現在の能力・経験は採用基準を満たします", {
        exact: true,
      }),
    })
    .first();
  const title = await card.getByRole("heading").innerText();
  await card.getByRole("button", { name: "応募する", exact: true }).click();
  await page.getByRole("button", { name: "30日進める", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: title, exact: true }).first(),
  ).toBeVisible();
});
