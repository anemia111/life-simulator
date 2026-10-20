import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/v1-save.json", import.meta.url), "utf8"),
);
async function start(page: any) {
  await page.goto("/");
  await page.getByLabel("あなたの名前").fill("フェーズワン");
  await page.getByLabel("はじめの暮らし").selectOption("comfortable");
  await page
    .getByRole("button", { name: "人生をはじめる", exact: true })
    .click();
}
async function go(page: any, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
test("不採用から勤務・掛け持ち・シフト衝突・学習・1年間・保存復元", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await go(page, "仕事を探す");
  await page
    .getByTestId("job-convenience")
    .getByRole("button", { name: "応募する", exact: true })
    .click();
  await expect(
    page.getByRole("cell", { name: "不採用", exact: true }),
  ).toBeVisible();
  await page
    .getByTestId("job-cafe")
    .getByRole("button", { name: "応募する", exact: true })
    .click();
  await page.getByRole("button", { name: "7日進める", exact: true }).click();
  await page.getByRole("button", { name: "7日進める", exact: true }).click();
  await page
    .getByTestId("job-convenience")
    .getByRole("button", { name: "応募する", exact: true })
    .click();
  await go(page, "仕事・シフト管理");
  await expect(page.getByTestId("contract-cafe")).toBeVisible();
  await expect(page.getByTestId("contract-convenience")).toBeVisible();
  await page.getByLabel("コンビニ夕方スタッフの開始時刻").selectOption("14");
  await page
    .getByTestId("contract-convenience")
    .getByRole("button", { name: "シフトを保存" })
    .click();
  await expect(page.getByRole("alert")).toContainText("重複");
  await page.getByLabel("コンビニ夕方スタッフの開始時刻").selectOption("18");
  await page
    .getByTestId("contract-convenience")
    .getByRole("button", { name: "シフトを保存" })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await go(page, "行動メニュー");
  await page
    .getByLabel("平日の自動行動", { exact: true })
    .selectOption("digital");
  await page.getByLabel("休日の自動行動", { exact: true }).selectOption("rest");
  await page.getByLabel("休日の行動時間", { exact: true }).selectOption("4");
  await page.getByRole("button", { name: "生活スケジュールを保存" }).click();
  for (let n = 0; n < 11; n++)
    await page.getByRole("button", { name: "30日進める", exact: true }).click();
  for (let n = 0; n < 3; n++)
    await page.getByRole("button", { name: "7日進める", exact: true }).click();
  await expect(page.getByText("DAY 366", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await go(page, "資産と収支");
  await expect(
    page.getByText("元帳と残高が一致", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "月次レポートの月" })
    .selectOption("2027-03");
  await expect(
    page.getByText("給与発生（実働）", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".save-status")).toContainText("自動保存済み");
  await page.reload();
  await page.getByRole("button", { name: /スロット 1 · フェーズワン/ }).click();
  await expect(page.getByText("DAY 366", { exact: true })).toBeVisible();
  await go(page, "仕事・シフト管理");
  await expect(page.getByTestId("contract-convenience")).toBeVisible();
  expect(errors).toEqual([]);
});
test("交流・生活水準・口座振替・ローン・買い物が実際の状態を変える", async ({
  page,
}) => {
  await start(page);
  await go(page, "仕事を探す");
  await page
    .getByTestId("job-cafe")
    .getByRole("button", { name: "応募する", exact: true })
    .click();
  await page.getByRole("button", { name: "7日進める", exact: true }).click();
  await go(page, "人間関係");
  await expect(
    page.getByRole("heading", { name: "木村 さとし" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "交流する（1h）" }).click();
  await expect(page.getByText("交流 1回", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "自動交流の相手に選ぶ" }).click();
  await go(page, "暮らし");
  await page.getByRole("button", { name: /節約 食費/ }).click();
  await page
    .getByRole("button", { name: "日用品を買って気分転換", exact: false })
    .click();
  await go(page, "資産と収支");
  await page.getByLabel("取引金額", { exact: true }).fill("10000");
  await page.getByRole("button", { name: "銀行へ預ける", exact: true }).click();
  await page
    .getByRole("button", { name: "生活資金を借りる", exact: true })
    .click();
  await expect(
    page.getByText("借入残高 ¥10,000", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("取引金額", { exact: true }).fill("5000");
  await page.getByRole("button", { name: "ローンを返す", exact: true }).click();
  await expect(
    page.getByText("借入残高 ¥5,000", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("元帳と残高が一致", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
test("カレンダー・欠勤・日次と月次の報告", async ({ page }) => {
  await start(page);
  await go(page, "仕事を探す");
  await page
    .getByTestId("job-cafe")
    .getByRole("button", { name: "応募する", exact: true })
    .click();
  await go(page, "仕事・シフト管理");
  await page
    .getByRole("button", { name: "次回の勤務を欠勤する", exact: true })
    .click();
  await page.getByRole("button", { name: "1日進める", exact: true }).click();
  await expect(page.getByText("1日", { exact: true })).toBeVisible();
  await go(page, "カレンダー");
  await expect(page.getByLabel("24時間の時間配分")).toBeVisible();
  await page.getByRole("button", { name: /^10 / }).click();
  await expect(
    page.getByRole("heading", { name: "2026-04-10 の予定" }),
  ).toBeVisible();
  await go(page, "日次・月次レポート");
  await expect(page.getByText("実働", { exact: true })).toBeVisible();
  await expect(page.getByText("月次一覧", { exact: true })).toBeVisible();
  await expect(
    page.getByText("喫茶 こもれび：欠勤（無給）", { exact: true }),
  ).toBeVisible();
});
test("公開v0.1セーブのJSONを取り込み勤務と事業を継続", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "セーブ・設定", exact: true }).click();
  await page.getByLabel("JSONを取り込む").setInputFiles({
    name: "v1-save.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await expect(page.getByRole("alert")).toHaveCount(0);
  await go(page, "ダッシュボード");
  await expect(
    page.getByText("おかえりなさい、旧版の人生さん。"),
  ).toBeVisible();
  await expect(page.getByTestId("cash")).toHaveText("¥129,400");
  await go(page, "仕事・シフト管理");
  await expect(page.getByTestId("contract-cafe")).toBeVisible();
  await go(page, "事業を営む");
  await expect(
    page.getByRole("heading", { name: "小さな制作室", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "7日進める", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".save-status")).toContainText("自動保存済み");
  await page.reload();
  await page.getByRole("button", { name: /スロット 1 · 旧版の人生/ }).click();
  await expect(page.getByText("DAY 45", { exact: true })).toBeVisible();
});
