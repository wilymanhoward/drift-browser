import { useEffect, useState } from 'react';
import type { PrivacyCommand, ShieldsState } from '../shared/privacy';
export default function Shields() {
  const [state, setState] = useState<ShieldsState | null>(null);
  const [error, setError] = useState('');
  const refresh = () => window.drift.getShields().then(setState);
  useEffect(() => {
    void refresh().catch(() => setError('Shields could not be loaded.'));
  }, []);
  const update = async (command: PrivacyCommand) => {
    try {
      await window.drift.privacy(command);
      await refresh();
    } catch {
      setError('The privacy change could not be applied.');
    }
  };
  if (!state) return <p role="status">{error || 'Loading Shields…'}</p>;
  return (
    <div className="settings-form">
      {error && <p role="alert">{error}</p>}
      <h2>{state.site || 'Drift internal page'}</h2>
      <p>
        <strong>{state.blocked}</strong> requests blocked on this page.
      </p>
      <label>
        <input
          type="checkbox"
          checked={state.enabled}
          onChange={(event) =>
            void update({ type: 'site', enabled: event.target.checked })
          }
        />
        Block ads and trackers for this site
      </label>
      <p>
        Known fingerprinting scripts are blocked by filter lists. The user agent
        is normalized. This is basic mitigation, not complete fingerprint
        resistance.
      </p>
      {state.filterError && <p role="alert">{state.filterError}</p>}
      <p className="command-hint">
        EasyList and EasyPrivacy. Last filter snapshot:{' '}
        {new Date(state.updatedAt).toLocaleDateString()}.
      </p>
      {state.pendingHTTP && (
        <section className="connection-warning">
          <h2>HTTPS connection failed</h2>
          <p>{state.pendingHTTP}</p>
          <p>
            HTTP sends page data without encryption. Continue only if you trust
            this site.
          </p>
          <button
            className="text-button"
            onClick={() => void update({ type: 'allow-http' })}
          >
            Allow HTTP for this site and continue
          </button>
        </section>
      )}
      <label>
        <input
          type="checkbox"
          checked={state.settings.httpsOnly}
          onChange={(event) =>
            void update({
              type: 'options',
              httpsOnly: event.target.checked,
              clearOnExit: state.settings.clearOnExit,
              dns: state.settings.dns,
            })
          }
        />
        Upgrade HTTP connections to HTTPS
      </label>
      <label>
        <input
          type="checkbox"
          checked={state.settings.clearOnExit}
          onChange={(event) =>
            void update({
              type: 'options',
              httpsOnly: state.settings.httpsOnly,
              clearOnExit: event.target.checked,
              dns: state.settings.dns,
            })
          }
        />
        Clear cookies, cache, and history on exit
      </label>
      <label>
        Secure DNS
        <select
          aria-label="Secure DNS"
          value={state.settings.dns}
          onChange={(event) =>
            void update({
              type: 'options',
              httpsOnly: state.settings.httpsOnly,
              clearOnExit: state.settings.clearOnExit,
              dns: event.target.value as 'system' | 'cloudflare' | 'quad9',
            })
          }
        >
          <option value="system">System resolver</option>
          <option value="cloudflare">Cloudflare</option>
          <option value="quad9">Quad9</option>
        </select>
      </label>
      <p>
        Third-party cookie requests are blocked. Embedded sites may still read
        cookies from earlier visits in this Electron build. Secure DNS applies
        to the whole app. Permission access requires a prompt; a stored block
        can be reset below.
      </p>
      {['media', 'geolocation', 'notifications'].map((permission) => (
        <label key={permission}>
          <input
            type="checkbox"
            checked={
              state.settings.deniedPermissions[state.origin]?.includes(
                permission,
              ) || false
            }
            onChange={(event) =>
              void update({
                type: 'permission',
                permission,
                denied: event.target.checked,
              })
            }
          />
          Always block {permission} for this site
        </label>
      ))}
      <button
        className="text-button"
        onClick={() => void window.drift.action('private-window')}
      >
        Open private window
      </button>
    </div>
  );
}
