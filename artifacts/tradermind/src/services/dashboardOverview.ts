/**
 * dashboardOverview.ts — محاسبات خالص «نمای کلی» داشبورد (فاز ۳)
 *
 * مبنای P/L: سود/زیان خالص (getNetPnl) — همان مبنایی که نمودار و کارت‌های فعلی داشبورد
 * نمایش می‌دهند. هیچ عدد فرضی تولید نمی‌شود؛ وقتی داده کافی نیست مقدار null برمی‌گردد
 * و UI «—» نشان می‌دهد.
 */
import type { Trade } from '../db/database';
import { getNetPnl, isClosed, isWin, isLoss, isBreakEven } from '../lib/tradeHelpers';
import { getTradingDateKey } from '../lib/tradingTime';

export interface EquityPoint {
  /** کلید روز معاملاتی YYYY-MM-DD */
  date: string;
  /** سرمایه‌ی تجمعی تا پایان آن معامله (P/L خالص) */
  equity: number;
  pnl: number;
  symbol: string;
}

export interface Distribution { wins: number; losses: number; breakeven: number; total: number }

export interface Ranked { key: string; label: string; pnl: number; count: number }

export interface OverviewKpis {
  totalTrades: number;
  closedTrades: number;
  /** 0..100 */
  winRate: number | null;
  profitFactor: number | null;
  /** درصد افت از اوج سرمایه (۰ یا مثبت)؛ null اگر اوج مثبتی وجود نداشته باشد */
  maxDrawdownPct: number | null;
  maxDrawdownAbs: number;
  /** میانگین R هر معامله (بر پایه‌ی rMultiple ثبت‌شده) */
  expectancyR: number | null;
  totalPnl: number;
}

export interface Overview {
  kpis: OverviewKpis;
  equity: EquityPoint[];
  pnlSeries: EquityPoint[];
  distribution: Distribution;
  bestStrategy: Ranked | null;
  bestSymbol: Ranked | null;
  worstSymbol: Ranked | null;
}

const closedTs = (t: Trade) => t.closedAt ?? t.openedAt;

function rank(trades: Trade[], keyOf: (t: Trade) => string | null, labelOf: (k: string) => string): Ranked[] {
  const m = new Map<string, { pnl: number; count: number }>();
  for (const t of trades) {
    const k = keyOf(t);
    const p = getNetPnl(t);
    if (!k || p === null) continue;
    const cur = m.get(k) ?? { pnl: 0, count: 0 };
    cur.pnl += p;
    cur.count += 1;
    m.set(k, cur);
  }
  return [...m.entries()].map(([key, v]) => ({ key, label: labelOf(key), pnl: v.pnl, count: v.count }));
}

export function computeOverview(trades: Trade[], strategyName: (id: string) => string = (id) => id): Overview {
  const closed = trades.filter(isClosed).sort((a, b) => closedTs(a) - closedTs(b));
  const withPnl = closed.filter((t) => getNetPnl(t) !== null);

  let eq = 0;
  let peak = 0;
  let maxDDAbs = 0;
  let ddAtPeak = 0;
  let winSum = 0;
  let lossSum = 0;
  const equity: EquityPoint[] = [];
  for (const t of withPnl) {
    const pnl = getNetPnl(t) as number;
    eq += pnl;
    if (pnl > 0) winSum += pnl;
    if (pnl < 0) lossSum += -pnl;
    if (eq > peak) peak = eq;
    const dd = peak - eq;
    if (dd > maxDDAbs) { maxDDAbs = dd; ddAtPeak = peak; }
    equity.push({ date: getTradingDateKey(closedTs(t)), equity: +eq.toFixed(2), pnl: +pnl.toFixed(2), symbol: t.symbol });
  }

  const wins = closed.filter(isWin).length;
  const losses = closed.filter(isLoss).length;
  const breakeven = closed.filter(isBreakEven).length;
  const rs = closed.filter((t) => t.rMultiple !== null && t.rMultiple !== undefined).map((t) => t.rMultiple as number);

  const bySymbol = rank(withPnl, (t) => t.symbol || null, (k) => k).sort((a, b) => b.pnl - a.pnl);
  const byStrategy = rank(withPnl, (t) => t.strategyId, strategyName).sort((a, b) => b.pnl - a.pnl);

  return {
    kpis: {
      totalTrades: trades.length,
      closedTrades: closed.length,
      winRate: closed.length ? (wins / closed.length) * 100 : null,
      profitFactor: lossSum > 0 ? winSum / lossSum : null,
      maxDrawdownPct: ddAtPeak > 0 ? (maxDDAbs / ddAtPeak) * 100 : null,
      maxDrawdownAbs: maxDDAbs,
      expectancyR: rs.length ? rs.reduce((s, v) => s + v, 0) / rs.length : null,
      totalPnl: eq,
    },
    equity,
    pnlSeries: equity,
    distribution: { wins, losses, breakeven, total: closed.length },
    bestStrategy: byStrategy.length && byStrategy[0].pnl > 0 ? byStrategy[0] : null,
    bestSymbol: bySymbol.length && bySymbol[0].pnl > 0 ? bySymbol[0] : null,
    worstSymbol: bySymbol.length && bySymbol[bySymbol.length - 1].pnl < 0 ? bySymbol[bySymbol.length - 1] : null,
  };
}
