import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  X,
  Search,
  Bookmark as BookmarkIcon,
  Clock,
  ArrowUpRight,
  Folder,
  Trash2,
  Pencil,
} from 'lucide-react';
import type {
  Bookmark,
  HistoryEntry,
  BrowserAction,
  BrowserState,
  LibraryData,
  OverlayEvent,
} from '../shared/browser';
import { isWebURL, NEW_TAB_URL, resolveInput } from '../shared/navigation';
import { fuzzyScore, searchEntries } from '../shared/search';
import type { SearchEntry } from '../shared/search';
import Shields from './Shields';
import Settings from './Settings';
import { searchTemplate } from '../shared/settings';

function Modal({
  label,
  close,
  children,
}: {
  label: string;
  close: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="chrome-dialog"
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="dialog-content">
        <div className="dialog-heading">
          <h1>{label}</h1>
          <button aria-label="Close dialog" onClick={close}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export default function Overlay({
  event,
  state,
}: {
  event: OverlayEvent;
  state: BrowserState;
}) {
  const [library, setLibrary] = useState<LibraryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void window.drift
      .getLibrary()
      .then((data) => {
        if (live) setLibrary(data);
      })
      .catch(() => {
        if (live) setError('The library could not be loaded.');
      });
    return () => {
      live = false;
    };
  }, [event]);
  const close = () => {
    void window.drift
      .closeOverlay()
      .catch(() => setError('The dialog could not be closed.'));
  };
  return (
    <>
      {event.snapshot && (
        <div className="page-preview">
          <img
            className="page-snapshot"
            src={event.snapshot}
            alt=""
            style={{
              left: event.bounds.x,
              top: event.bounds.y,
              width: event.bounds.width,
              height: event.bounds.height,
            }}
          />
        </div>
      )}
      <Modal
        label={
          event.kind === 'command'
            ? event.newTab
              ? 'New tab'
              : 'Search and navigate'
            : event.kind === 'history'
              ? 'History'
              : event.kind === 'shields'
                ? 'Shields'
                : event.kind === 'settings'
                  ? 'Settings'
                  : 'Bookmarks'
        }
        close={close}
      >
        {(error || library?.error || state.storageError) && (
          <p role="alert" className="error">
            {error || library?.error || state.storageError}
          </p>
        )}
        {event.kind === 'settings' ? (
          <Settings state={state} />
        ) : event.kind === 'shields' ? (
          <Shields />
        ) : !library ? (
          <p role="status">Loading saved pages…</p>
        ) : event.kind === 'command' ? (
          <CommandBar event={event} state={state} library={library} />
        ) : (
          <LibraryPanel
            kind={event.kind}
            state={state}
            library={library}
            refresh={async () => setLibrary(await window.drift.getLibrary())}
          />
        )}
      </Modal>
    </>
  );
}
function CommandBar({
  event,
  state,
  library,
}: {
  event: OverlayEvent;
  state: BrowserState;
  library: LibraryData;
}) {
  const [query, setQuery] = useState(event.query);
  const [selected, setSelected] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setQuery(event.query);
    setSelected(-1);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.select();
    });
  }, [event]);
  const commands: {
    id: string;
    title: string;
    action: BrowserAction | 'pin';
  }[] = [
    { id: 'new', title: 'Open a new tab', action: 'new-tab' },
    { id: 'history', title: 'Show browsing history', action: 'show-history' },
    { id: 'bookmarks', title: 'Show bookmarks', action: 'show-bookmarks' },
    {
      id: 'pin',
      title: state.sidebar.pinned ? 'Unpin sidebar' : 'Pin sidebar open',
      action: 'pin',
    },
    { id: 'reload', title: 'Reload current tab', action: 'reload' },
    ...(state.canReopen
      ? [
          {
            id: 'reopen',
            title: 'Reopen closed tab',
            action: 'reopen-tab' as const,
          },
        ]
      : []),
  ];
  const entries: SearchEntry[] = [
    ...state.tabs.map((tab) => ({
      id: tab.id,
      kind: 'tab' as const,
      title: tab.title || 'New tab',
      url: tab.url,
    })),
    ...library.bookmarks.map((item) => ({
      ...item,
      kind: 'bookmark' as const,
    })),
    ...library.history.map((item) => ({
      ...item,
      id: item.url,
      kind: 'history' as const,
    })),
    ...commands.map((command) => ({
      id: command.id,
      title: command.title,
      kind: 'command' as const,
      url: '',
    })),
  ];
  const results = searchEntries(entries, query);
  const run = async (entry?: SearchEntry) => {
    setError(null);
    try {
      if (entry?.kind === 'command') {
        const command = commands.find((item) => item.id === entry.id)!;
        await window.drift.closeOverlay();
        if (command.action === 'pin')
          await window.drift.sidebar({ pinned: !state.sidebar.pinned });
        else await window.drift.action(command.action);
      } else if (entry?.kind === 'tab') {
        await window.drift.tab({ type: 'select', id: entry.id });
        await window.drift.closeOverlay();
      } else {
        resolveInput(entry?.url ?? query, searchTemplate(state.settings));
        await window.drift.navigate(entry?.url ?? query);
      }
    } catch {
      setError('Enter a valid address or search term.');
    }
  };
  return (
    <>
      <form
        className="command-input"
        onSubmit={(event) => {
          event.preventDefault();
          void run(selected >= 0 ? results[selected] : undefined);
        }}
      >
        <Search size={20} />
        <input
          ref={input}
          role="combobox"
          aria-label="Web address"
          aria-expanded={results.length > 0}
          aria-controls="command-results"
          aria-activedescendant={
            selected >= 0 ? `result-${selected}` : undefined
          }
          value={query}
          placeholder="Search or enter an address"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelected(-1);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setSelected((current) =>
                Math.max(
                  -1,
                  Math.min(
                    results.length - 1,
                    current + (event.key === 'ArrowDown' ? 1 : -1),
                  ),
                ),
              );
            }
          }}
        />
        <button type="submit" aria-label="Navigate or search">
          <ArrowUpRight size={18} />
        </button>
      </form>
      <p className="command-hint">
        Enter to browse or search {state.settings.searchEngine}. Use ↓ to choose
        a match.
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div
        id="command-results"
        role="listbox"
        aria-label="Matching tabs and saved pages"
      >
        {results.map((entry, index) => (
          <button
            id={`result-${index}`}
            key={`${entry.kind}-${entry.id}`}
            role="option"
            aria-selected={index === selected}
            className="command-result"
            onClick={() => void run(entry)}
          >
            <span className="result-copy">
              <strong>{entry.title}</strong>
              {entry.url && (
                <small>
                  {entry.url === NEW_TAB_URL ? 'Drift new tab' : entry.url}
                </small>
              )}
            </span>
            <span className="result-kind">{entry.kind}</span>
          </button>
        ))}
        {results.length === 0 && (
          <p className="empty-state">
            No saved matches. Press Enter to browse or search.
          </p>
        )}
      </div>
    </>
  );
}
function LibraryPanel({
  kind,
  state,
  library,
  refresh,
}: {
  kind: 'history' | 'bookmarks';
  state: BrowserState;
  library: LibraryData;
  refresh: () => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<{
    id?: string;
    url: string;
    title: string;
    folder: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const entries = useMemo(
    () =>
      kind === 'history'
        ? library.history.filter(
            (item) => fuzzyScore(query, `${item.title} ${item.url}`) >= 0,
          )
        : library.bookmarks.filter(
            (item) =>
              fuzzyScore(query, `${item.folder} ${item.title} ${item.url}`) >=
              0,
          ),
    [kind, library, query],
  );
  const mutate = async (task: () => Promise<void>) => {
    setError(null);
    try {
      await task();
      await refresh();
    } catch {
      setError(
        'The change could not be saved. Check the address and storage status.',
      );
    }
  };
  return (
    <>
      <div className="library-tools">
        <input
          autoFocus
          aria-label={
            kind === 'history' ? 'Search history' : 'Search bookmarks'
          }
          placeholder={
            kind === 'history' ? 'Search history' : 'Search bookmarks'
          }
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {kind === 'history' ? (
          <button
            className="text-button"
            disabled={!library.history.length}
            onClick={() => void mutate(() => window.drift.clearHistory())}
          >
            Clear history
          </button>
        ) : (
          <button
            className="text-button"
            disabled={!isWebURL(state.url)}
            onClick={() => {
              const existing = library.bookmarks.find(
                (item) => item.url === state.url,
              );
              setDraft(
                existing ?? {
                  url: state.url,
                  title: state.title || state.url,
                  folder: 'Bookmarks',
                },
              );
            }}
          >
            Bookmark this page
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {draft && (
        <form
          className="bookmark-editor"
          onSubmit={(event) => {
            event.preventDefault();
            void mutate(async () => {
              await window.drift.bookmark({
                type: 'save',
                ...(draft.id ? { id: draft.id } : {}),
                url: draft.url,
                title: draft.title,
                folder: draft.folder,
              });
              setDraft(null);
            });
          }}
        >
          <label>
            Address
            <input
              aria-label="Bookmark address"
              value={draft.url}
              onChange={(event) =>
                setDraft({ ...draft, url: event.target.value })
              }
              required
              maxLength={8192}
            />
          </label>
          <label>
            Title
            <input
              aria-label="Bookmark title"
              value={draft.title}
              onChange={(event) =>
                setDraft({ ...draft, title: event.target.value })
              }
              required
              maxLength={1024}
            />
          </label>
          <label>
            Folder
            <input
              aria-label="Bookmark folder"
              value={draft.folder}
              onChange={(event) =>
                setDraft({ ...draft, folder: event.target.value })
              }
              maxLength={80}
            />
          </label>
          <div>
            <button type="submit" className="text-button primary">
              Save bookmark
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      <div className="library-list">
        {entries.length === 0 && (
          <p className="empty-state">
            {query
              ? 'No matching pages.'
              : kind === 'history'
                ? 'Pages you visit will appear here.'
                : 'Save a page to begin your bookmarks.'}
          </p>
        )}
        {kind === 'bookmarks'
          ? [
              ...new Set((entries as Bookmark[]).map((item) => item.folder)),
            ].map((folder) => (
              <section key={folder}>
                <h2>
                  <Folder size={14} />
                  {folder}
                </h2>
                {(entries as Bookmark[])
                  .filter((item) => item.folder === folder)
                  .map((item) => (
                    <div className="library-row" key={item.id}>
                      <button
                        className="saved-page"
                        onClick={() =>
                          void window.drift
                            .navigate(item.url)
                            .catch(() =>
                              setError('This bookmark could not be opened.'),
                            )
                        }
                      >
                        <BookmarkIcon size={16} />
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.url}</small>
                        </span>
                      </button>
                      <button
                        aria-label={`Edit ${item.title}`}
                        title="Edit bookmark"
                        onClick={() => setDraft(item)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        aria-label={`Remove ${item.title}`}
                        title="Remove bookmark"
                        onClick={() =>
                          void mutate(() =>
                            window.drift.bookmark({
                              type: 'remove',
                              id: item.id,
                            }),
                          )
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
              </section>
            ))
          : (entries as HistoryEntry[]).map((item) => (
              <div className="library-row" key={item.url}>
                <button
                  className="saved-page"
                  onClick={() =>
                    void window.drift
                      .navigate(item.url)
                      .catch(() =>
                        setError('This history entry could not be opened.'),
                      )
                  }
                >
                  <Clock size={16} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.url}</small>
                  </span>
                </button>
                <time>{new Date(item.lastVisited).toLocaleDateString()}</time>
              </div>
            ))}
      </div>
    </>
  );
}
