import { createPortal } from "react-dom";
import { useEscapeToClose } from "../hooks/useEscapeToClose";
import type { Settings } from "../types";

interface SettingsDialogProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

export function SettingsDialog({ settings, onChange, onClose }: SettingsDialogProps) {
  useEscapeToClose(onClose);

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">Settings</div>
        <div className="modal-body settings-body">
          <label className="field">
            <span>Default order quantity</span>
            <input
              type="number"
              min={1}
              value={settings.defaultQuantity}
              onChange={(e) => onChange({ defaultQuantity: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Warn above order value ($)</span>
            <input
              type="number"
              min={0}
              step={1000}
              value={settings.largeNotionalThreshold}
              onChange={(e) => onChange({ largeNotionalThreshold: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span>Warn above order quantity (shares)</span>
            <input
              type="number"
              min={0}
              step={100}
              value={settings.largeQuantityThreshold}
              onChange={(e) => onChange({ largeQuantityThreshold: Number(e.target.value) })}
            />
          </label>
          <label className="field settings-checkbox-row">
            <span>Desktop notifications</span>
            <input
              type="checkbox"
              checked={settings.notificationsEnabled}
              onChange={(e) => onChange({ notificationsEnabled: e.target.checked })}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
