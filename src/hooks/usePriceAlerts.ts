import { useCallback, useEffect, useState } from "react";
import { notify } from "../lib/notify";
import { loadJSON, saveJSON } from "../lib/storage";
import type { AlertCondition, PriceAlert, Quote } from "../types";

const ALERTS_KEY = "5ix-price-alerts";

function makeId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function usePriceAlerts(quotes: Record<string, Quote>) {
  const [alerts, setAlerts] = useState<PriceAlert[]>(() => loadJSON<PriceAlert[]>(ALERTS_KEY, []));

  useEffect(() => {
    saveJSON(ALERTS_KEY, alerts);
  }, [alerts]);

  useEffect(() => {
    setAlerts((prev) => {
      let changed = false;
      const next = prev.map((alert) => {
        if (alert.triggered) return alert;
        const price = quotes[alert.key]?.last;
        if (price == null) return alert;
        const crossed = alert.condition === "ABOVE" ? price >= alert.price : price <= alert.price;
        if (!crossed) return alert;
        changed = true;
        notify(`Price alert: ${alert.label}`, `${alert.condition === "ABOVE" ? "Above" : "Below"} ${alert.price} (now ${price})`);
        return { ...alert, triggered: true };
      });
      return changed ? next : prev;
    });
  }, [quotes]);

  const addAlert = useCallback((key: string, label: string, condition: AlertCondition, price: number) => {
    setAlerts((prev) => [...prev, { id: makeId(), key, label, condition, price, triggered: false }]);
  }, []);

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { alerts, addAlert, removeAlert };
}
