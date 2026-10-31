import { useEffect, useState } from 'react';
import type {
  BrowserImportResult,
  BrowserImportSource,
} from '../shared/browser-import';

export default function BrowserImport({
  privateWindow,
}: {
  privateWindow: boolean;
}) {
  const [sources, setSources] = useState<BrowserImportSource[]>([]);
  const [id, setId] = useState('');
  const [bookmarks, setBookmarks] = useState(true);
  const [preferences, setPreferences] = useState(true);
  const [extensions, setExtensions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BrowserImportResult | null>(null);
  const scan = async () => {
    setLoading(true);
    setError('');
    try {
      const found = await window.drift.detectBrowsers();
      setSources(found);
      setId((current) =>
        found.some((source) => source.id === current)
          ? current
          : (found[0]?.id ?? ''),
      );
      setExtensions([]);
    } catch {
      setError(
        'Browser profiles could not be detected. Try refreshing the list.',
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (!privateWindow) void scan();
  }, [privateWindow]);
  if (privateWindow)
    return (
      <p className="panel-note">
        Open a regular Drift window to import browser data.
      </p>
    );
  const source = sources.find((source) => source.id === id);
  const run = async () => {
    if (!source) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      setResult(
        await window.drift.importBrowser({
          id,
          bookmarks: bookmarks && source.bookmarks,
          preferences: preferences && source.preferences,
          extensions,
        }),
      );
    } catch {
      setError(
        'The import could not start. Refresh the profile list and try again.',
      );
    } finally {
      setBusy(false);
    }
  };
  const labels: Record<string, string> = {
    theme: 'Theme',
    startup: 'Startup behaviour',
    searchEngine: 'Search engine',
  };
  return (
    <div
      className="settings-card settings-fields browser-import"
      aria-busy={busy || loading}
    >
      <h2>Bring your browser data into Drift</h2>
      <p className="panel-note">
        Choose a detected profile and what to import. Bookmarks merge with your
        existing collection; duplicate addresses are skipped. Selected
        preferences replace only their matching Drift settings.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {loading && <p role="status">Looking for browser profiles…</p>}
      {!loading && !sources.length && (
        <p role="status">
          No supported browser profiles were found. Open your other browser
          once, then refresh this list.
        </p>
      )}
      {!!sources.length && (
        <>
          <label className="preference-row">
            <span>Browser profile</span>
            <select
              aria-label="Browser profile"
              value={id}
              disabled={busy || loading}
              onChange={(event) => {
                setId(event.target.value);
                setExtensions([]);
                setResult(null);
              }}
            >
              {[...new Set(sources.map((source) => source.browser))].map(
                (browser) => (
                  <optgroup key={browser} label={browser}>
                    {sources
                      .filter((source) => source.browser === browser)
                      .map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.browser} · {source.profile}
                        </option>
                      ))}
                  </optgroup>
                ),
              )}
            </select>
          </label>
          <label className="toggle-preference">
            <input
              type="checkbox"
              checked={bookmarks && !!source?.bookmarks}
              disabled={busy || !source?.bookmarks}
              onChange={(event) => setBookmarks(event.target.checked)}
            />
            <span>
              Bookmarks
              <small>
                Folders are preserved within Drift’s bookmark limits.
              </small>
            </span>
          </label>
          <label className="toggle-preference">
            <input
              type="checkbox"
              checked={preferences && !!source?.preferences}
              disabled={busy || !source?.preferences}
              onChange={(event) => setPreferences(event.target.checked)}
            />
            <span>
              Supported preferences
              <small>
                Search engine, light/dark theme and startup behaviour, where
                available. Browser-specific appearance and shortcuts stay in the
                source browser.
              </small>
            </span>
          </label>
          <h3>Extensions</h3>
          <p className="panel-note">
            Selected Chrome Web Store extensions are downloaded again into
            Drift. Internet access is required, and each installation asks for
            permission. Extension settings and sign-ins are not copied; some
            Chrome APIs are unavailable in Drift.
          </p>
          {source?.extensions.length ? (
            source.extensions.map((extension) => (
              <div key={extension.id}>
                <label className="toggle-preference">
                  <input
                    type="checkbox"
                    checked={extensions.includes(extension.id)}
                    disabled={busy || !extension.compatible}
                    onChange={(event) =>
                      setExtensions((current) =>
                        event.target.checked
                          ? [...current, extension.id]
                          : current.filter((id) => id !== extension.id),
                      )
                    }
                  />
                  <span>
                    {extension.name}
                    <small>
                      {extension.compatible
                        ? `Detected version ${extension.version}; the store may provide a newer version.`
                        : 'This extension is not available for import from the Chrome Web Store.'}
                    </small>
                  </span>
                </label>
                {extension.permissions.length > 0 && (
                  <details>
                    <summary>Permissions for {extension.name}</summary>
                    <p className="panel-note">
                      {extension.permissions.join(', ')}
                    </p>
                  </details>
                )}
              </div>
            ))
          ) : (
            <p className="panel-note">
              No Chrome extensions were found in this profile. Firefox and Zen
              add-ons cannot be loaded as Chrome extensions.
            </p>
          )}
        </>
      )}
      <p className="panel-note">
        Supported profiles: Chrome, Edge, Brave, Vivaldi, Chromium, Opera, Opera
        GX, Firefox and Zen. Passwords, cookies and browsing history stay in the
        source browser.
      </p>
      <div className="button-row">
        <button
          className="text-button"
          disabled={
            busy ||
            loading ||
            !source ||
            (!(bookmarks && source.bookmarks) &&
              !(preferences && source.preferences) &&
              !extensions.length)
          }
          onClick={() => void run()}
        >
          {busy ? 'Importing…' : 'Import selected data'}
        </button>
        <button
          className="text-button"
          disabled={busy || loading}
          onClick={() => void scan()}
        >
          Refresh browser list
        </button>
      </div>
      {result && (
        <div role="status">
          <p>
            {result.bookmarksAdded} bookmarks added; {result.bookmarksSkipped}{' '}
            duplicates or items over the limit skipped. {result.extensionsAdded}{' '}
            extensions installed.
          </p>
          <p>
            {result.preferences.length
              ? `Preferences imported: ${result.preferences.map((key) => labels[key] ?? key).join(', ')}.`
              : 'No Drift preferences were changed.'}
          </p>
          {result.warnings.length > 0 && (
            <ul>
              {result.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
