import { useEffect, useState } from 'react';
import type { PasswordCommand, PasswordList } from '../shared/passwords';
export default function Passwords() {
  const [list, setList] = useState<PasswordList | null>(null);
  const [error, setError] = useState('');
  const run = async (command: PasswordCommand) => {
    setError('');
    try {
      setList(await window.drift.passwords(command));
    } catch {
      setError('Saved passwords could not be changed.');
    }
  };
  useEffect(() => {
    void run({ type: 'list' });
  }, []);
  if (!list) return <p role="status">{error || 'Loading passwords…'}</p>;
  const host = (origin: string) => new URL(origin).host;
  return (
    <div className="download-list">
      <p className="panel-note">
        Drift offers to save a password when you sign in, and fills it when you
        click an empty sign-in field. Passwords are encrypted with your Windows
        account and never leave this device. Private windows don’t save or fill
        passwords.
      </p>
      {(error || list.error) && (
        <p className="error" role="alert">
          {error || list.error}
        </p>
      )}
      {!list.logins.length && <p role="status">No saved passwords yet.</p>}
      {list.logins.map((login) => (
        <section
          key={login.id}
          className="download-row"
          aria-label={`${host(login.origin)} ${login.username}`}
        >
          <h2>{host(login.origin)}</h2>
          <p>{login.username || 'No username'}</p>
          <div className="dialog-actions">
            <button
              className="text-button"
              onClick={() => void run({ type: 'delete', id: login.id })}
            >
              Delete
            </button>
          </div>
        </section>
      ))}
      {list.never.length > 0 && <h2>Never saved</h2>}
      {list.never.map((origin) => (
        <section key={origin} className="download-row" aria-label={origin}>
          <h2>{host(origin)}</h2>
          <div className="dialog-actions">
            <button
              className="text-button"
              onClick={() => void run({ type: 'allow', origin })}
            >
              Allow saving again
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
