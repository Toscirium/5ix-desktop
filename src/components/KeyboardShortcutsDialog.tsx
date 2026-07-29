import { createPortal } from "react-dom";
import { useEscapeToClose } from "../hooks/useEscapeToClose";

interface KeyboardShortcutsDialogProps {
  onClose: () => void;
}

const SHORTCUTS: { keys: string; description: string }[] = [
  { keys: "/", description: "Focus symbol search" },
  { keys: "↑ / ↓", description: "Move selection in watchlist" },
  { keys: "1–9", description: "Switch watchlist tab" },
  { keys: "T", description: "Toggle light / dark theme" },
  { keys: "R", description: "Refresh positions, account summary, open orders" },
  { keys: "Esc", description: "Close dialog" },
];

export function KeyboardShortcutsDialog({ onClose }: KeyboardShortcutsDialogProps) {
  useEscapeToClose(onClose);

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">Keyboard Shortcuts</div>
        <div className="modal-body">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="modal-row">
              <span>{s.description}</span>
              <span className="shortcut-keys">{s.keys}</span>
            </div>
          ))}
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
