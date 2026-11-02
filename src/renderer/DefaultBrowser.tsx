import { useEffect, useState } from 'react';
import type { DefaultBrowserStatus } from '../shared/default-browser';

export default function DefaultBrowser() {
  const [status, setStatus] = useState<DefaultBrowserStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void window.drift
        .defaultBrowser('status')
        .then((value) => {
          if (mounted) {
            setStatus(value);
            setError('');
          }
        })
        .catch(() => {
          if (mounted) setError('Default browser status could not be checked.');
        });
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => {
      mounted = false;
      window.removeEventListener('focus', refresh);
    };
  }, []);
  const open = async () => {
    setBusy(true);
    try {
      await window.drift.defaultBrowser('open-settings');
      setError('');
    } catch {
      setError(
        'Windows Default apps could not be opened. Try opening it from Windows Settings.',
      );
    } finally {
      setBusy(false);
    }
  };
  const hint = !status
    ? 'Checking default browser…'
    : !status.supported
      ? 'Available on Windows.'
      : !status.installed
        ? 'Install Drift with the Windows installer to enable this option.'
        : status.isDefault
          ? 'Drift opens your HTTP and HTTPS links.'
          : 'Choose Drift, then Set default in Windows Settings.';
  return (
    <>
      <div className="preference-row">
        <span>
          <span className="preference-label">Default browser</span>
          <small role="status">{hint}</small>
        </span>
        <button
          className="text-button"
          disabled={busy || !status?.installed || status.isDefault}
          onClick={() => void open()}
        >
          {busy
            ? 'Opening…'
            : status?.isDefault
              ? 'Already default'
              : 'Make default'}
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
