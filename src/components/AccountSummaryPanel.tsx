import type { AccountValue, Pnl } from "../types";

interface AccountSummaryPanelProps {
  accountSummary: AccountValue[];
  pnl: Pnl | null;
  connected: boolean;
  selectedAccount: string | null;
  onRefresh: () => void;
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

function pnlClass(n: number | null | undefined) {
  if (n == null) return "";
  return n >= 0 ? "text-up" : "text-down";
}

export function AccountSummaryPanel({ accountSummary, pnl, connected, selectedAccount, onRefresh }: AccountSummaryPanelProps) {
  const accountCount = new Set(accountSummary.map((v) => v.account)).size;
  const visible = accountCount > 1 && selectedAccount ? accountSummary.filter((v) => v.account === selectedAccount) : accountSummary;

  return (
    <div className="panel account-panel">
      <div className="panel-header">
        <span>Account Summary</span>
        <button className="btn-icon" onClick={onRefresh} disabled={!connected} title="Refresh">
          ⟳
        </button>
      </div>
      {connected && pnl && (
        <div className="pnl-strip">
          <div className="pnl-item">
            <span className="account-tag">Daily P&amp;L</span>
            <span className={pnlClass(pnl.dailyPnl)}>{fmtMoney(pnl.dailyPnl)}</span>
          </div>
          <div className="pnl-item">
            <span className="account-tag">Unrealized</span>
            <span className={pnlClass(pnl.unrealizedPnl)}>{fmtMoney(pnl.unrealizedPnl)}</span>
          </div>
          <div className="pnl-item">
            <span className="account-tag">Realized</span>
            <span className={pnlClass(pnl.realizedPnl)}>{fmtMoney(pnl.realizedPnl)}</span>
          </div>
        </div>
      )}
      <div className="account-grid">
        {visible.length === 0 && <div className="empty-row">{connected ? "No data" : "Connect to view account summary"}</div>}
        {visible.map((v, i) => (
          <div key={`${v.account}-${v.tag}-${i}`} className="account-row">
            <span className="account-tag">{v.tag}</span>
            <span className="account-value">
              {v.value} {v.currency}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
