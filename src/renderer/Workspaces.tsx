import { useState } from 'react';
import type { BrowserState } from '../shared/browser';
import type { WorkspaceCommand } from '../shared/power';
export default function Workspaces({ state }: { state: BrowserState }) {
  const [draft, setDraft] = useState({
    id: '',
    name: '',
    icon: '◉',
    accent: '#007aff',
  });
  const [error, setError] = useState('');
  const run = async (command: WorkspaceCommand) => {
    try {
      await window.drift.workspace(command);
      setError('');
      return true;
    } catch {
      setError(
        'The workspace could not be changed. Keep at least one workspace; up to nine are supported.',
      );
      return false;
    }
  };
  return (
    <div className="settings-form">
      <p className="panel-note">
        Each workspace keeps its own tabs and essentials. Cookies and logins are
        shared within this window. Removing a workspace moves its tabs to
        another workspace.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {state.workspaces.map((workspace, i) => (
        <div className="workspace-row" key={workspace.id}>
          <button
            className="workspace-select"
            aria-pressed={workspace.id === state.activeWorkspaceId}
            onClick={() => void run({ type: 'select', id: workspace.id })}
          >
            <span style={{ borderColor: workspace.accent }}>
              {workspace.icon}
            </span>
            {workspace.name}
            <small>{state.settings.shortcuts[`workspace-${i + 1}`]}</small>
          </button>
          <button className="text-button" onClick={() => setDraft(workspace)}>
            Edit {workspace.name}
          </button>
          <button
            className="text-button"
            disabled={state.workspaces.length === 1}
            onClick={() => void run({ type: 'remove', id: workspace.id })}
          >
            Remove {workspace.name}
          </button>
        </div>
      ))}
      <form
        className="settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          void run({
            type: 'save',
            ...(draft.id ? { id: draft.id } : {}),
            name: draft.name,
            icon: draft.icon,
            accent: draft.accent,
          }).then((ok) => {
            if (ok)
              setDraft({ id: '', name: '', icon: '◉', accent: '#007aff' });
          });
        }}
      >
        <h2>{draft.id ? 'Edit workspace' : 'New workspace'}</h2>
        <label>
          Name
          <input
            aria-label="Workspace name"
            required
            maxLength={40}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </label>
        <label>
          Icon or emoji
          <input
            aria-label="Workspace icon"
            required
            maxLength={8}
            value={draft.icon}
            onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
          />
        </label>
        <label>
          Accent
          <input
            aria-label="Workspace accent"
            type="color"
            value={draft.accent}
            onChange={(e) => setDraft({ ...draft, accent: e.target.value })}
          />
        </label>
        <div className="dialog-actions">
          <button className="primary" type="submit">
            {draft.id ? 'Save workspace' : 'Create workspace'}
          </button>
          {draft.id && (
            <button
              type="button"
              className="text-button"
              onClick={() =>
                setDraft({ id: '', name: '', icon: '◉', accent: '#007aff' })
              }
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
