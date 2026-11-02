import { useLayoutEffect, useRef, useState } from 'react';
import {
  Plus,
  PanelsTopLeft,
  Lock,
  Clock,
  Bookmark,
  Download,
  Puzzle,
  Search,
  Printer,
  Settings,
  X,
  Minus,
  Maximize,
  PanelLeft,
  Columns2,
} from 'lucide-react';
import type { BrowserAction, BrowserState } from '../shared/browser';

export default function BrowserMenu({
  state,
  close,
}: {
  state: BrowserState;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [position, setPosition] = useState({ left: 8, top: 48, width: 310 });
  const [error, setError] = useState('');
  useLayoutEffect(() => {
    const update = () => {
      const anchor = document
        .querySelector('.browser-menu-trigger')
        ?.getBoundingClientRect();
      const width = Math.min(310, innerWidth - 16);
      const left =
        state.settings.toolbarLayout === 'sidebar' &&
        state.sidebarPosition === 'left'
          ? (anchor?.right ?? 40) + 6
          : (anchor?.right ?? innerWidth - 8) - width;
      const top =
        state.settings.toolbarLayout === 'sidebar'
          ? (anchor?.top ?? 48)
          : (anchor?.bottom ?? 40) + 6;
      setPosition({
        left: Math.max(8, Math.min(left, innerWidth - width - 8)),
        top: Math.max(8, Math.min(top, innerHeight - 80)),
        width,
      });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [
    state.sidebarPosition,
    state.settings.toolbarLayout,
    state.sidebar.expanded,
    state.sidebar.width,
  ]);
  useLayoutEffect(() => {
    const element = dialog.current!;
    element.showModal();
    element.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    return () => element.close();
  }, []);
  const run = async (action: BrowserAction, keepOpen = false) => {
    try {
      if (!keepOpen) await window.drift.closeOverlay();
      await window.drift.action(action);
    } catch {
      setError('This browser action could not be completed.');
    }
  };
  const rows: [BrowserAction, string, typeof Plus, string?][] = [
    ['new-tab', 'New tab', Plus, 'new-tab'],
    ['new-window', 'New window', PanelsTopLeft],
    ['private-window', 'New private window', Lock],
    ['show-history', 'History', Clock, 'show-history'],
    ['show-bookmarks', 'Bookmarks', Bookmark, 'show-bookmarks'],
    ['show-downloads', 'Downloads', Download, 'show-downloads'],
    ['show-extensions', 'Extensions', Puzzle],
    ['find', 'Find in page', Search, 'find'],
    ['print', 'Print…', Printer, 'print'],
    ['show-workspaces', 'Workspaces', PanelLeft],
    ['split', 'Split view', Columns2, 'split'],
  ];
  const sidebar = async (mode: 'pinned' | 'auto' | 'compact') => {
    try {
      await window.drift.closeOverlay();
      if (mode === 'compact') {
        if (!state.compact) await window.drift.action('compact');
        return;
      }
      if (state.compact) await window.drift.action('compact');
      if (
        state.settings.lockCollapsed ||
        (!state.settings.hoverExpand && mode === 'auto')
      )
        await window.drift.settings({
          ...state.settings,
          lockCollapsed: false,
          hoverExpand: mode === 'auto' ? true : state.settings.hoverExpand,
        });
      await window.drift.sidebar({
        pinned: mode === 'pinned',
        expanded: mode === 'pinned',
      });
    } catch {
      setError('The sidebar could not be changed.');
    }
  };
  return (
    <dialog
      ref={dialog}
      className="browser-menu"
      aria-label="Browser menu"
      style={{ ...position, maxHeight: `calc(100vh - ${position.top + 8}px)` }}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      onKeyDown={(event) => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key))
          return;
        event.preventDefault();
        const items = [
          ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
            '[role="menuitem"]:not(:disabled), [role="menuitemradio"]:not(:disabled)',
          ),
        ];
        const index = items.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) %
                items.length;
        items[next]?.focus();
      }}
    >
      <div role="menu" aria-label="Browser commands">
        {rows.map(([action, label, Icon, shortcut], index) => (
          <div key={action} role="presentation">
            {[3, 7].includes(index) && (
              <div role="separator" className="menu-separator" />
            )}
            <button
              role="menuitem"
              className="menu-item"
              aria-label={label}
              disabled={
                (action === 'show-extensions' && !state.extensions) ||
                (action === 'split' &&
                  !state.split &&
                  state.tabs.filter(
                    (tab) => tab.workspaceId === state.activeWorkspaceId,
                  ).length < 2)
              }
              onClick={() => void run(action)}
            >
              <Icon size={16} />
              <span>{label}</span>
              {shortcut && <kbd>{state.settings.shortcuts[shortcut]}</kbd>}
            </button>
          </div>
        ))}
        <div role="separator" className="menu-separator" />
        <div className="menu-controls" role="group" aria-label="Zoom">
          <span>Zoom</span>
          <button
            role="menuitem"
            aria-label="Zoom out"
            onClick={() => void run('zoom-out', true)}
          >
            <Minus size={15} />
          </button>
          <button
            role="menuitem"
            aria-label="Reset zoom"
            onClick={() => void run('zoom-reset', true)}
          >
            {state.zoomPercent}%
          </button>
          <button
            role="menuitem"
            aria-label="Zoom in"
            onClick={() => void run('zoom-in', true)}
          >
            <Plus size={15} />
          </button>
          <button
            role="menuitem"
            aria-label="Fullscreen"
            onClick={() => void run('fullscreen')}
          >
            <Maximize size={15} />
          </button>
        </div>
        <div className="menu-controls" role="group" aria-label="Sidebar mode">
          <span>Sidebar</span>
          {(['pinned', 'auto', 'compact'] as const).map((mode) => (
            <button
              key={mode}
              role="menuitemradio"
              aria-checked={
                mode === 'compact'
                  ? state.compact
                  : !state.compact &&
                    (mode === 'pinned'
                      ? state.sidebar.pinned
                      : !state.sidebar.pinned)
              }
              onClick={() => void sidebar(mode)}
            >
              {mode === 'pinned'
                ? 'Pinned'
                : mode === 'auto'
                  ? 'Auto-hide'
                  : 'Compact'}
            </button>
          ))}
        </div>
        <div role="separator" className="menu-separator" />
        <button
          role="menuitem"
          className="menu-item"
          onClick={() => void run('show-settings')}
          aria-label="Settings"
        >
          <Settings size={16} />
          <span>Settings</span>
          <kbd>{state.settings.shortcuts['show-settings']}</kbd>
        </button>
        <button
          role="menuitem"
          className="menu-item"
          onClick={() => void run('close')}
        >
          <X size={16} />
          <span>Close window</span>
        </button>
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </dialog>
  );
}
