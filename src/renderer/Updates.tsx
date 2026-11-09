import { useEffect, useState } from 'react';
import type { UpdateStatus } from '../shared/browser';

export default function Updates() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [error, setError] = useState('');
  const run = (command: 'status' | 'check' | 'install') =>
    window.drift
      .update(command)
      .then((value) => {
        setStatus(value);
        setError('');
      })
      .catch(() => setError('Drift could not check for updates.'));
  useEffect(() => {
    void run('status');
  }, []);
  const busy = status?.state === 'checking' || status?.state === 'downloading';
  // Follows a check or download until it settles.
  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => void run('status'), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  const hint = !status
    ? 'Checking version…'
    : {
        unsupported:
          'Updates install automatically in the Windows installer build. The portable build is updated by downloading a new release.',
        idle: 'Drift checks for updates automatically.',
        checking: 'Checking for updates…',
        latest: 'Drift is up to date.',
        downloading: `Downloading Drift ${status.version ?? ''} (${status.percent ?? 0}%)…`,
        ready: `Drift ${status.version ?? ''} is ready. Restart to finish updating.`,
        error:
          'The last update check failed. Check your connection and try again.',
      }[status.state];
  const ready = status?.state === 'ready';
  return (
    <>
      <div className="preference-row">
        <span>
          <span className="preference-label">
            Version {status?.current ?? ''}
          </span>
          <small role="status">{hint}</small>
        </span>
        <button
          className="text-button"
          disabled={!status || status.state === 'unsupported' || busy}
          onClick={() => void run(ready ? 'install' : 'check')}
        >
          {ready ? 'Restart to update' : 'Check for updates'}
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
