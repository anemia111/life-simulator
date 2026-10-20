# 新しい業界を追加する

新しい業界は `src/engine/enterprise/` に置き、`registry.ts` で `registerIndustry` する。会社・個人事業の区別、設立資金、会計、時間配分、社員、日次進行、保存の実装は共通で再利用する。UIは登録情報から設立候補を列挙する。固有の手動操作・専用画面は業界に応じて追加する。

## インターフェース

`IndustryModule` (`types.ts`)：

- `id / name / description`：識別子・表示名・説明。ID重複は拒否。
- `skill / minimumSkill`：本人または有償スタッフが供給できる作業条件。
- `setup / basePrice / market / capacity`：設備原価、基準単価、基準市場規模、時間当たり能力。
- `initialize(state, venture)`（任意）：固有商品の妥当性検証と初期データ。
- `obligations(state, venture)`（任意）：休止・閉鎖中も必要な日次の義務。小売は返品・陳腐化。
- `tick(state, venture, productiveHours, demand)`：営業日の処理。実売・納品数を返す。売上は需要・技能・供給・資金・在庫から決める。

`productiveHours` は実働から管理負担を除き設備・拠点の効率を掛けた生産換算時間。実際の本人時間・スタッフ時間は `last.ownerHours/staffHours` に別記する。技能不足時の換算時間はゼロだが、既存顧客の保守・課金等は日次に実行する。

汎用状態には在庫 `inventory`、案件 `orders`、月額顧客 `subscribers`、スタッフ `employees` がある。固有の保存可能な数値・文字列・真偽値は `venture.data` に格納できる。複雑な新契約を導入する場合は型・保存スキーマ・移行も定義する。

## 最小実装例

```ts
import type { IndustryModule } from './types';
import { book } from './accounting';

export const lessons: IndustryModule = {
  id: 'lessons', name: '学習支援', description: '地域の需要に応じて授業を提供',
  skill: 'service', minimumSkill: 10,
  setup: 5000, basePrice: 2000, market: 100, capacity: 1,
  initialize(_s, v) { v.data.lessons = 0; },
  tick(s, v, hours, demand) {
    const units = Math.min(Math.floor(hours), demand);
    if (units) {
      book(s, v, '授業料の入金', {
        cash: units * v.price, revenue: units * v.price,
      });
      v.data.lessons = Number(v.data.lessons) + units;
    }
    return units;
  },
};
// registry.ts: registerIndustry(lessons)
```

この追加だけで個人/法人所有、資金移動、社員、管理費、設備・販路・拠点、本人の時間配分、帳簿、月次、保存が利用できる。`enterprise.test.ts` に同等の登録例の自動テストがある。現リリースの実装例は `freelance.ts`, `retail.ts`, `software.ts`。

## 記帳規則

`book` の引数は円整数の増減。常に `cash + inventory + equipment + receivables - debt = equity + revenue - expenses` を維持する。

| 取引 | 増減 |
|---|---|
| 仕入 | cash −原価 / inventory ＋原価 |
| 商品販売 | cash ＋売価 / revenue ＋売価 / inventory −原価 / expenses ＋原価 |
| 納品 | receivables ＋報酬 / revenue ＋報酬 |
| 売掛回収 | cash ＋報酬 / receivables −報酬 |
| 設備 | cash −価格 / equipment ＋価格 |
| 支出・未払 | cash −支払額 / debt ＋不足分 / expenses ＋発生額 |
| 所有者拠出 | cash ＋資金 / equity ＋資金 |

`spend(..., mandatory=false)` は払えなければfalse、必須支出のみtrueで未払を許す。仕入れ・任意投資を無料で実行しない。個人財布の変化は `Finance.post` を利用し、会社売上を直接個人へ入金しない。`verifyAccounts/verifyEnterprise` と `validateSave` で元帳・貸借・在庫・売掛を検証する。

## 互換モード

旧 `engine/industries/` の文章制作・焼き菓子は従来の単一事業データを使う。Phase 0/1のセーブ・売上・投資額・自動行動を維持するための互換モードで、新3業界の法人移管機能は対象外。新規業界は `enterprise/registry.ts` を使用する。
