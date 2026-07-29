import type { ActivityEntry } from "../types";

interface ActivityLogPanelProps {
  activityLog: ActivityEntry[];
  onClear: () => void;
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString();
}

export function ActivityLogPanel({ activityLog, onClear }: ActivityLogPanelProps) {
  return (
    <div className="panel activity-log-panel">
      <div className="panel-header">
        <span>Activity Log</span>
        <button className="btn-icon" onClick={onClear} disabled={activityLog.length === 0} title="Clear">
          Clear
        </button>
      </div>
      <div className="activity-log-list">
        {activityLog.length === 0 && <div className="empty-row">No activity yet</div>}
        {activityLog.map((entry) => (
          <div key={entry.id} className={`activity-log-row activity-${entry.level}`}>
            <span className="activity-time">{formatTime(entry.time)}</span>
            <span className="activity-message">{entry.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
