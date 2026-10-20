export interface SectorModel {
  id: string;
  name: string;
  family: string;
  margin: number;
  elasticity: number;
  capital: number;
  rd: number;
  growth: number;
  price: number;
  cyclical: number;
}
const groups: [string, string, string[]][] = [
  [
    "technology",
    "技術",
    [
      "AI",
      "半導体",
      "ソフトウェア",
      "クラウド",
      "インターネット",
      "通信",
      "電子機器",
    ],
  ],
  [
    "transport",
    "交通",
    ["自動車", "自動車部品", "航空宇宙", "航空会社", "鉄道", "海運", "物流"],
  ],
  ["finance", "金融", ["銀行", "証券", "保険", "資産運用"]],
  ["property", "都市", ["不動産", "建設"]],
  [
    "resources",
    "資源",
    ["電力", "石油・天然ガス", "再生可能エネルギー", "鉱業", "鉄鋼", "化学"],
  ],
  ["industry", "産業", ["機械", "重工業"]],
  ["health", "医療", ["製薬", "バイオ", "医療機器"]],
  [
    "consumer",
    "生活",
    [
      "食品",
      "飲料",
      "小売",
      "EC",
      "外食",
      "ホテル",
      "旅行",
      "娯楽",
      "ゲーム",
      "メディア",
      "広告",
      "日用品",
      "アパレル",
      "農業関連",
    ],
  ],
];
const parameters: Record<
  string,
  [number, number, number, number, number, number]
> = {
  technology: [0.28, 1.2, 1.5, 0.12, 0.05, 1.3],
  transport: [0.13, 1.8, 3, 0.04, 0.025, 1.6],
  finance: [0.24, 0.6, 2, 0.015, 0.02, 1.1],
  property: [0.17, 1.4, 4, 0.01, 0.018, 1.4],
  resources: [0.16, 0.5, 3.5, 0.025, 0.015, 1.5],
  industry: [0.18, 1.5, 2.5, 0.05, 0.025, 1.3],
  health: [0.25, 0.7, 2, 0.16, 0.04, 0.5],
  consumer: [0.12, 2, 1, 0.02, 0.02, 0.9],
};
export const sectorModels = new Map<string, SectorModel>();
let count = 0;
for (const [family, , names] of groups)
  for (const name of names) {
    const p = parameters[family],
      i = count++;
    const id = "sector-" + String(i + 1).padStart(2, "0");
    sectorModels.set(id, {
      id,
      name,
      family,
      margin: p[0] + ((i % 3) - 1) * 0.015,
      elasticity: p[1],
      capital: p[2],
      rd: p[3],
      growth: p[4],
      price: 300 + (i % 7) * 170,
      cyclical: p[5],
    });
  }
export const regions = [
  {
    id: "seiran",
    name: "晴嵐連邦",
    city: "リオセラ",
    prefix: [
      "セイラ",
      "ルメノ",
      "アスティ",
      "ネリオ",
      "フィルナ",
      "ベルゼ",
      "コルミ",
      "レイナ",
      "ソリム",
    ],
  },
  {
    id: "valdora",
    name: "ヴァルドラ共和国",
    city: "ヴェルナ",
    prefix: [
      "ヴァルネ",
      "オルゼン",
      "フィオラ",
      "エルディ",
      "ガルメ",
      "イストラ",
      "ノヴェル",
      "アルニ",
      "ロゼラ",
    ],
  },
  {
    id: "mirelia",
    name: "ミレリア連合",
    city: "ミレア",
    prefix: [
      "ミレア",
      "カリゼ",
      "イリナ",
      "パルメ",
      "ラフィ",
      "タルニ",
      "レミオ",
      "エミラ",
      "ニヴェ",
    ],
  },
  {
    id: "aurest",
    name: "アウレスト共同体",
    city: "セラウ",
    prefix: [
      "アウレ",
      "トレサ",
      "エヴェル",
      "ルガノ",
      "ケルナ",
      "メルゼ",
      "セリオ",
      "リグナ",
      "フェリ",
    ],
  },
  {
    id: "noriva",
    name: "ノリヴァ王国",
    city: "ノリセル",
    prefix: [
      "ノリヴ",
      "ウルメ",
      "リヴェル",
      "フレノ",
      "アルヴェ",
      "シェリ",
      "ティルナ",
      "モルゼ",
      "ヴェリア",
    ],
  },
];
export const exchanges = [
  {
    id: "aurora",
    name: "暁星証券取引所",
    currency: "円",
    session: "平日の日次清算（ゲーム内9:00〜15:00）",
  },
  {
    id: "meridian",
    name: "環海証券取引所",
    currency: "円",
    session: "平日の日次清算（共通決済通貨）",
  },
];
const tails = [
  "システムズ",
  "インダストリーズ",
  "グループ",
  "テクノロジーズ",
  "コーポレーション",
];
export function companyIdentity(sectorIndex: number, regionIndex: number) {
  const r = regions[regionIndex];
  return {
    name:
      r.prefix[sectorIndex % 9] +
      ["リス", "ベル", "ティア", "シア", "ニクス"][
        Math.floor(sectorIndex / 9)
      ] +
      " " +
      tails[(sectorIndex + regionIndex) % 5],
    ticker:
      "LS" + String(regionIndex + 1) + String(sectorIndex + 1).padStart(3, "0"),
  };
}
