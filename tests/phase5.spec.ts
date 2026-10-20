import { test, expect, type Page } from "@playwright/test";
import { newGame, dispatch, advanceDays } from "../src/engine";
import { ensureBond, startDating } from "../src/engine/social/relationships";
import { profile } from "../src/engine/social/selectors";
import { receive } from "../src/engine/finance";
async function begin(page: Page) {
  await page.goto("/");
  await page.getByLabel("あなたの名前").fill("人生を紡ぐ");
  await page.getByLabel("はじめの暮らし").selectOption("comfortable");
  await page
    .getByRole("button", { name: "人生をはじめる", exact: true })
    .click();
}
async function go(page: Page, name: string) {
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
async function download(page: Page) {
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
test("PCで目標達成・人生年表・双方向交流・共同積立を実操作し保存する", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await begin(page);
  await go(page, "人生・目標");
  await page.getByLabel("目標の種類").selectOption("career");
  await page.getByLabel("目標値", { exact: true }).fill("20000");
  await page
    .getByRole("button", { name: "この目標を選ぶ", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "仕事の経験を重ねる", exact: true }),
  ).toBeVisible();
  await go(page, "仕事を探す");
  await page
    .getByTestId("job-cafe")
    .getByRole("button", { name: "応募する", exact: true })
    .click();
  await page.getByRole("button", { name: "30日進める", exact: true }).click();
  await go(page, "人生・目標");
  await expect(
    page.locator(".journey-goal").getByText("達成", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "../phase5-goals-desktop.png",
    fullPage: true,
  });
  await page.getByRole("tab", { name: "人生年表", exact: true }).click();
  await expect(
    page
      .locator(".journey-timeline")
      .getByText("仕事の経験を重ねるを達成した", { exact: true }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "交流・交際", exact: true }).click();
  await page.getByRole("button", { name: /会いに行く/ }).click();
  await expect(page.getByText(/相手の親密度/)).toBeVisible();
  await page
    .getByRole("button", { name: "相談して支え合う · 1時間", exact: true })
    .click();
  await page.getByRole("tab", { name: "家族・共同資金", exact: true }).click();
  await page.getByLabel("共同資金の金額").fill("10000");
  await page
    .getByRole("button", { name: "この金額を積み立てる", exact: true })
    .click();
  await expect(page.getByTestId("household-cash")).toHaveText("¥10,000");
  await page
    .getByRole("button", { name: "自分の持分から返還する", exact: true })
    .click();
  await expect(page.getByTestId("household-cash")).toHaveText("¥0");
  const state = await download(page);
  expect(state.schemaVersion).toBe(6);
  expect(
    state.social.goals.some(
      (g: any) => g.actorId === "player" && g.status === "achieved",
    ),
  ).toBe(true);
  expect(
    state.social.bonds.some(
      (b: any) => (b.a === "player" || b.b === "player") && b.interactions >= 2,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("結婚できる人生セーブを読み込み、結婚・引越し済み住居で子育て・共同会計を進める", async ({
  page,
}) => {
  let s = newGame("家族のブラウザ検証", "comfortable");
  s.person.birthDate = "2000-04-01";
  s.social.policy = { npcRelationships: false, npcFamily: false };
  const id = s.npcs[0].id;
  profile(s, id).romance = "open";
  const b = ensureBond(s, "player", id);
  Object.assign(b, {
    affinityA: 95,
    affinityB: 95,
    trustA: 95,
    trustB: 95,
    attraction: 90,
  });
  startDating(s, "player", id);
  s = dispatch(s, { type: "apply", jobId: "cafe" });
  s = advanceDays(s, 100);
  receive(s, 150000, "ブラウザ試験の開始資産");
  s = dispatch(s, {
    type: "execute",
    actionId: "map-move",
    target: { id: "campus-family" },
  });
  await begin(page);
  await go(page, "セーブ・設定");
  await page
    .getByLabel("JSONを取り込む")
    .setInputFiles({
      name: "family-ready.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(s)),
    });
  await go(page, "人生・目標");
  await page.getByRole("tab", { name: "交流・交際", exact: true }).click();
  await page
    .getByRole("button", {
      name: "結婚・共同生活 · 2時間 / ¥5,000",
      exact: true,
    })
    .click();
  await expect(page.getByText("配偶者", { exact: true })).toBeVisible();
  await page.getByRole("tab", { name: "家族・共同資金", exact: true }).click();
  await page.getByLabel("共同資金の金額").fill("70000");
  await page
    .getByRole("button", { name: "この金額を積み立てる", exact: true })
    .click();
  await page.getByLabel("迎える子どもの名前").fill("青葉 ひなた");
  await page
    .getByRole("button", { name: "家族で子どもを迎える · 2時間", exact: true })
    .click();
  await expect(page.getByText("青葉 ひなた", { exact: true })).toBeVisible();
  await expect(page.getByTestId("household-cash")).toHaveText("¥55,000");
  await page.getByRole("button", { name: "7日進める", exact: true }).click();
  await page.screenshot({
    path: "../phase5-family-desktop.png",
    fullPage: true,
  });
  const saved = await download(page);
  expect(saved.social.stats.adoptions).toBe(1);
  expect(
    saved.social.households.some(
      (h: any) => h.adults.length === 2 && h.children.length === 1,
    ),
  ).toBe(true);
  expect(
    saved.simulation.residents.every(
      (r: any) =>
        Object.values(r.hours).reduce((a: any, b: any) => a + b, 0) === 24,
    ),
  ).toBe(true);
});
test("320pxで人生の4画面を切り替え目標設定とNPC年表を操作する", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await begin(page);
  await go(page, "人生・目標");
  await page.getByLabel("目標値", { exact: true }).fill("20000");
  await page
    .getByRole("button", { name: "この目標を選ぶ", exact: true })
    .click();
  for (const name of ["人生年表", "交流・交際", "家族・共同資金", "目標"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(321);
  }
  await page.getByLabel("人生を見る人物").selectOption("resident-2");
  await expect(page.getByText("価値観と選択", { exact: true })).toBeVisible();
  await page.screenshot({ path: "../phase5-mobile.png", fullPage: true });
});
