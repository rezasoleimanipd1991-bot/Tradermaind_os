import type { Account, Trade } from '../db/database';
import { getNetPnl, isClosed } from '../lib/tradeHelpers';

export interface AccountDrawdown {
  accountId: string;
  accountName: string;
  currency: string;
  maxDrawdownAbs: number;
  maxDrawdownPct: number | null;
}

/**
 * Computes peak-to-trough drawdown on each account's own equity curve.
 * `selectedTrades` controls which closed trades may establish the reported
 * maximum; allTrades still supplies the prior equity/high-water-mark history.
 */
export function computeAccountDrawdowns(
  allTrades: Trade[],
  accounts: Account[],
  selectedTrades: Trade[] = allTrades,
): AccountDrawdown[] {
  const selectedIds = new Set(selectedTrades.filter(isClosed).map(trade => trade.id));

  return accounts.flatMap(account => {
    const accountTrades = allTrades
      .filter(trade => trade.accountId === account.id && isClosed(trade))
      .sort((a, b) => (a.closedAt ?? a.openedAt) - (b.closedAt ?? b.openedAt));

    if (!accountTrades.some(trade => selectedIds.has(trade.id))) return [];

    const hasStartingBalance = account.initialBalance !== null
      && account.initialBalance !== undefined
      && Number.isFinite(account.initialBalance)
      && account.initialBalance > 0;
    let equity = hasStartingBalance ? account.initialBalance! : 0;
    let peak = equity;
    let maxDrawdownAbs = 0;
    let maxDrawdownPct = 0;

    for (const trade of accountTrades) {
      const pnl = getNetPnl(trade);
      if (pnl === null || !Number.isFinite(pnl)) continue;

      equity += pnl;
      peak = Math.max(peak, equity);

      if (!selectedIds.has(trade.id)) continue;

      const drawdownAbs = Math.max(0, peak - equity);
      maxDrawdownAbs = Math.max(maxDrawdownAbs, drawdownAbs);
      if (hasStartingBalance && peak > 0) {
        maxDrawdownPct = Math.max(maxDrawdownPct, (drawdownAbs / peak) * 100);
      }
    }

    return [{
      accountId: account.id,
      accountName: account.name,
      currency: account.currency,
      maxDrawdownAbs,
      maxDrawdownPct: hasStartingBalance ? maxDrawdownPct : null,
    }];
  });
}

export function getWorstAccountDrawdown(
  allTrades: Trade[],
  accounts: Account[],
  selectedTrades: Trade[] = allTrades,
): AccountDrawdown | null {
  return computeAccountDrawdowns(allTrades, accounts, selectedTrades)
    .filter(item => item.maxDrawdownPct !== null)
    .sort((a, b) => (b.maxDrawdownPct ?? 0) - (a.maxDrawdownPct ?? 0))[0] ?? null;
}
