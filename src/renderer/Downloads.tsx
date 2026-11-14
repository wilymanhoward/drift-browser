import { useEffect, useState } from 'react';
import type { DownloadState, DownloadCommand } from '../shared/power';
// The downloads list, refreshed whenever the browser state changes.
export function useDownloads() {
  const [items, setItems] = useState<DownloadState[]>([]);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    const refresh = () => {
      void window.drift
        .getDownloads()
        .then((next) => {
          if (live) setItems(next);
        })
        .catch(() => {
          if (live) setFailed(true);
        });
    };
    const unsubscribe = window.drift.onState(refresh);
    refresh();
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);
  return { items, failed };
}
export const size = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KB`
      : bytes < 1024 * 1024 * 1024
        ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
        : `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
const timeLeft = (seconds: number) =>
  seconds < 60
    ? `${Math.max(1, Math.round(seconds))} s left`
    : seconds < 3600
      ? `${Math.round(seconds / 60)} min left`
      : `${Math.floor(seconds / 3600)} h ${Math.round((seconds % 3600) / 60)} min left`;
export default function Downloads() {
  const { items, failed } = useDownloads();
  const [actionError, setError] = useState('');
  const error = actionError || (failed ? 'Downloads could not be loaded.' : '');
  const run = async (command: DownloadCommand) => {
    try {
      await window.drift.download(command);
      setError('');
    } catch {
      setError(
        'The download action could not be completed. The file may have moved or the transfer may have ended.',
      );
    }
  };
  return (
    <div className="download-list">
      <p className="panel-note">
        Files use the system save dialog. Download history lasts for this
        window; files are never opened automatically.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!items.length && <p role="status">No downloads in this window.</p>}
      {items.map((item) => (
        <section
          key={item.id}
          className="download-row"
          aria-label={item.name}
          draggable={item.status === 'completed'}
          title={
            item.status === 'completed'
              ? 'Drag into another app or onto a page'
              : undefined
          }
          onDragStart={(event) => {
            if (item.status !== 'completed') return;
            event.preventDefault();
            void run({ id: item.id, type: 'drag' });
          }}
        >
          <h2>{item.name}</h2>
          <p role="status">
            {item.paused ? 'Paused' : item.status} · {size(item.received)}
            {item.total > 0 ? ` of ${size(item.total)}` : ''}
            {!item.done && !item.paused && item.speed > 0
              ? ` · ${size(item.speed)}/s${
                  item.total > item.received
                    ? ` · ${timeLeft((item.total - item.received) / item.speed)}`
                    : ''
                }`
              : ''}
          </p>
          {!item.done && (
            <progress
              aria-label={`Progress ${item.name}`}
              value={item.total > 0 ? item.received : undefined}
              max={item.total || 1}
            />
          )}
          <div className="dialog-actions">
            {!item.done && (
              <>
                <button
                  className="text-button"
                  disabled={item.status === 'interrupted' && !item.resumable}
                  onClick={() =>
                    void run({
                      id: item.id,
                      type:
                        item.paused || item.status === 'interrupted'
                          ? 'resume'
                          : 'pause',
                    })
                  }
                >
                  {item.paused || item.status === 'interrupted'
                    ? 'Resume'
                    : 'Pause'}
                </button>
                <button
                  className="text-button"
                  onClick={() => void run({ id: item.id, type: 'cancel' })}
                >
                  Cancel download
                </button>
              </>
            )}
            {item.status === 'completed' && /\.pdf$/i.test(item.name) && (
              <button
                className="text-button"
                onClick={() => void run({ id: item.id, type: 'open' })}
              >
                Open
              </button>
            )}
            {item.status === 'completed' && (
              <button
                className="text-button"
                onClick={() => void run({ id: item.id, type: 'reveal' })}
              >
                Show in folder
              </button>
            )}
            {item.done && (
              <button
                className="text-button"
                onClick={() => void run({ id: item.id, type: 'remove' })}
              >
                Remove from list
              </button>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
