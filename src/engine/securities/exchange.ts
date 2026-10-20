import type { GameState } from "../types";
import type { SecuritiesAccount, ExchangeOrder } from "./types";
import { book } from "../enterprise/accounting";
import { weekday, nextDate } from "../time";
import {
  account,
  instrument,
  position,
  integer,
  fee,
  activeOrder,
  availableCash,
  availableShares,
  acquire,
  dispose,
  marketNews,
} from "./ledger";
export const nextSession = (date: string) => {
  while ([0, 6].includes(weekday(date))) date = nextDate(date);
  return date;
};
export const reserveAmount = (price: number, quantity: number) =>
  integer((price + fee(price)) * quantity, 0, Number.MAX_SAFE_INTEGER);
export function placeOrder(
  s: GameState,
  accountId: string,
  id: string,
  side: "buy" | "sell",
  type: "market" | "limit",
  quantity: number,
  price?: number,
  automatic = false,
) {
  const a = account(s, accountId),
    i = instrument(s, id);
  integer(quantity, 1, 1000000000);
  if (!["buy", "sell"].includes(side) || !["market", "limit"].includes(type))
    throw Error("注文種別が不正です");
  if (i.status !== "listed" || i.kind === "mutual")
    throw Error("取引所で売買できる銘柄を選んでください");
  const limit =
    type === "limit"
      ? integer(price, 1, 1000000000)
      : Math.max(
          1,
          side === "buy"
            ? Math.ceil(i.price * 1.05)
            : Math.floor(i.price * 0.95),
        );
  const reservedCash = side === "buy" ? reserveAmount(limit, quantity) : 0,
    reservedShares = side === "sell" ? quantity : 0;
  if (availableCash(s, a) < reservedCash)
    throw Error("注文に予約する証券資金が足りません");
  if (availableShares(s, a, id) < reservedShares)
    throw Error("売却可能な保有株が足りません");
  const sequence = ++s.sequence,
    o: ExchangeOrder = {
      id: "order-" + sequence,
      accountId,
      instrumentId: id,
      side,
      type,
      quantity,
      remaining: quantity,
      limit,
      reservedCash,
      reservedShares,
      status: "open",
      created: s.date,
      sequence,
      expires: nextSession(s.date),
      automatic,
    };
  s.securities.orders.push(o);
  return o;
}
export function cancelOrder(s: GameState, id: string, owner = "player") {
  const o = s.securities.orders.find((o) => o.id === id);
  if (!o || o.accountId !== owner || !activeOrder(o))
    throw Error("取消できる注文を選んでください");
  o.status = "cancelled";
  o.reservedCash = 0;
  o.reservedShares = 0;
}
export function settleTrade(
  s: GameState,
  buy: ExchangeOrder,
  sell: ExchangeOrder,
  quantity: number,
  price: number,
) {
  const buyer = account(s, buy.accountId),
    seller = account(s, sell.accountId),
    i = instrument(s, buy.instrumentId),
    value = integer(price * quantity, 1, Number.MAX_SAFE_INTEGER),
    commission = fee(value);
  acquire(s, buyer, i.id, quantity, price, commission);
  dispose(s, seller, i.id, quantity, price, commission);
  book(s, s.securities.broker, "売買手数料の受取", {
    cash: commission * 2,
    revenue: commission * 2,
  });
  for (const o of [buy, sell]) {
    o.remaining -= quantity;
    o.status = o.remaining ? "partial" : "filled";
    o.reservedCash = o.side === "buy" ? reserveAmount(o.limit, o.remaining) : 0;
    o.reservedShares = o.side === "sell" ? o.remaining : 0;
  }
  i.price = price;
  i.volume += quantity;
  s.securities.trades.push({
    id: ++s.sequence,
    date: s.date,
    instrumentId: i.id,
    buyerId: buyer.id,
    sellerId: seller.id,
    quantity,
    price,
    buyerFee: commission,
    sellerFee: commission,
    kind: "exchange",
  });
}
export function matchOrders(
  s: GameState,
  id: string,
  maxVolume = Number.MAX_SAFE_INTEGER,
) {
  const i = instrument(s, id);
  if (i.status !== "listed" || [0, 6].includes(weekday(s.date))) return 0;
  const buys = s.securities.orders
      .filter(
        (o) => o.instrumentId === id && o.side === "buy" && activeOrder(o),
      )
      .sort((a, b) => b.limit - a.limit || a.sequence - b.sequence),
    sells = s.securities.orders
      .filter(
        (o) => o.instrumentId === id && o.side === "sell" && activeOrder(o),
      )
      .sort((a, b) => a.limit - b.limit || a.sequence - b.sequence);
  let traded = 0;
  for (const buy of buys) {
    for (const sell of sells) {
      if (!buy.remaining || traded >= maxVolume) break;
      if (
        !sell.remaining ||
        buy.accountId === sell.accountId ||
        sell.limit > buy.limit
      )
        continue;
      const quantity = Math.min(
        buy.remaining,
        sell.remaining,
        maxVolume - traded,
      );
      const price =
        buy.type === "market" && sell.type === "market"
          ? Math.max(sell.limit, Math.min(buy.limit, i.price))
          : buy.type === "market"
            ? sell.limit
            : sell.type === "market"
              ? buy.limit
              : buy.sequence < sell.sequence
                ? buy.limit
                : sell.limit;
      settleTrade(s, buy, sell, quantity, price);
      traded += quantity;
    }
  }
  return traded;
}
export function expireDayOrders(s: GameState) {
  for (const o of s.securities.orders)
    if (
      activeOrder(o) &&
      (o.automatic || o.type === "market") &&
      o.expires <= s.date
    ) {
      o.status = "expired";
      o.reservedCash = 0;
      o.reservedShares = 0;
    }
  s.securities.orders = [
    ...s.securities.orders.filter(activeOrder),
    ...s.securities.orders
      .filter((o) => !activeOrder(o) && !o.automatic)
      .slice(-200),
  ];
  s.securities.trades = s.securities.trades.slice(-200);
}
