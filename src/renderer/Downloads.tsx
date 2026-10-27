import { useEffect, useState } from 'react';
import type { DownloadState, DownloadCommand } from '../shared/power';
export default function Downloads() {
  const [items, setItems] = useState<DownloadState[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    const refresh = () => {
      void window.drift
        .getDownloads()
        .then((next) => {
          if (live) setItems(next);
        })
        .catch(() => {
          if (live) setError('Downloads could not be loaded.');
        });
    };
    const unsubscribe = window.drift.onState(refresh);
    refresh();
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);
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
  const size = (bytes: number) =>
    bytes < 1024
      ? `${bytes} B`
      : bytes < 1024 * 1024
        ? `${(bytes / 1024).toFixed(1)} KB`
        : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
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
        <section key={item.id} className="download-row" aria-label={item.name}>
          <h2>{item.name}</h2>
          <p role="status">
            {item.paused ? 'Paused' : item.status} · {size(item.received)}
            {item.total > 0 ? ` of ${size(item.total)}` : ''}
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
