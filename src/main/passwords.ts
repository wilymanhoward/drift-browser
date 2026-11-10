import { ipcMain, safeStorage } from 'electron';
import type {
  BrowserWindow,
  IpcMainEvent,
  IpcMainInvokeEvent,
  Session,
  WebContents,
} from 'electron';
import type Store from 'electron-store';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { loginOrigin, parseVault } from '../shared/passwords';
import { PasswordPopup } from './password-popup';
import type { FieldRect } from './password-popup';
import type {
  PasswordCommand,
  PasswordList,
  SavedLogin,
} from '../shared/passwords';

type Context = (
  page: WebContents,
) =>
  | { win: BrowserWindow; theme: () => { css: string; dark: boolean } }
  | undefined;

// The whole vault is one OS-encrypted blob (DPAPI on Windows, Keychain on
// macOS); nothing about saved logins is written in plain text.
class Passwords {
  private logins: SavedLogin[] = [];
  private never: string[] = [];
  private error: string | null = null;
  private store: Store<{ vault: unknown; never: unknown }> | null = null;
  private loading: Promise<void> | null = null;
  private prompting = new Set<string>();
  private sessions = new Set<Session>();
  private popups = new WeakMap<BrowserWindow, PasswordPopup>();

  load() {
    this.loading ??= this.read();
    return this.loading;
  }
  private async read() {
    try {
      if (!safeStorage.isEncryptionAvailable())
        throw new Error('Encryption unavailable');
      const { default: ElectronStore } = await import('electron-store');
      const store = new ElectronStore<{ vault: unknown; never: unknown }>({
        name: 'passwords',
      });
      const vault = store.get('vault');
      if (typeof vault === 'string')
        this.logins = parseVault(
          safeStorage.decryptString(Buffer.from(vault, 'base64')),
        );
      else if (vault !== undefined) throw new Error('Invalid vault');
      const never = store.get('never');
      if (Array.isArray(never))
        this.never = never.filter((o) => typeof o === 'string');
      this.store = store;
    } catch (error) {
      console.error('Password storage unavailable:', error);
      // Store stays null so an unreadable vault is never overwritten.
      this.error =
        'Saved passwords could not be read on this device, so new passwords will not be saved. The original file is preserved.';
    }
  }
  private save() {
    if (!this.store) return;
    this.store.set(
      'vault',
      safeStorage.encryptString(JSON.stringify(this.logins)).toString('base64'),
    );
    this.store.set('never', this.never);
  }
  list(): PasswordList {
    return {
      logins: this.logins
        .map(({ id, origin, username }) => ({ id, origin, username }))
        .sort((a, b) => a.origin.localeCompare(b.origin)),
      never: [...this.never].sort(),
      error: this.error,
    };
  }
  async command(command: PasswordCommand) {
    await this.load();
    if (command.type === 'delete')
      this.logins = this.logins.filter((l) => l.id !== command.id);
    if (command.type === 'allow')
      this.never = this.never.filter((o) => o !== command.origin);
    if (command.type !== 'list') this.save();
    return this.list();
  }

  enable(session: Session, windowFor: Context) {
    if (this.sessions.size === 0) this.listen(windowFor);
    if (this.sessions.has(session)) return;
    this.sessions.add(session);
    session.registerPreloadScript({
      type: 'frame',
      filePath: path.join(__dirname, '../preload/passwords.cjs'),
    });
  }
  // The origin always comes from the frame the main process sees, never from
  // the page, so a site can only read or write its own logins.
  private origin(event: IpcMainEvent | IpcMainInvokeEvent) {
    const frame = event.senderFrame;
    if (!frame || frame.parent || !this.sessions.has(event.sender.session))
      return null;
    return loginOrigin(frame.url);
  }
  private popup(win: BrowserWindow) {
    let popup = this.popups.get(win);
    if (!popup) this.popups.set(win, (popup = new PasswordPopup(win)));
    return popup;
  }
  private listen(windowFor: Context) {
    ipcMain.handle('drift:password-suggest', async (event, field: unknown) => {
      await this.load();
      const origin = this.origin(event);
      const matches = this.logins.filter((l) => l.origin === origin);
      const context = windowFor(event.sender);
      const rect = field as Partial<FieldRect> | null;
      if (
        !origin ||
        !matches.length ||
        !context ||
        !rect ||
        ![rect.left, rect.top, rect.bottom].every(Number.isFinite)
      )
        return null;
      const index = await this.popup(context.win).ask(
        {
          mode: 'fill',
          site: new URL(origin).host,
          usernames: matches.map((l) => l.username),
        },
        event.sender,
        context.theme(),
        rect as FieldRect,
      );
      if (!event.sender.isDestroyed()) event.sender.focus();
      const login = index === null ? undefined : matches[index];
      return login
        ? { username: login.username, password: login.password }
        : null;
    });
    ipcMain.on(
      'drift:password-submit',
      (event, username: unknown, password: unknown) => {
        void (async () => {
          await this.load();
          const origin = this.origin(event);
          if (
            !this.store ||
            !origin ||
            typeof username !== 'string' ||
            typeof password !== 'string' ||
            !password ||
            username.length > 1024 ||
            password.length > 1024 ||
            this.never.includes(origin)
          )
            return;
          const key = `${origin}\n${username}`;
          const find = () =>
            this.logins.find(
              (l) => l.origin === origin && l.username === username,
            );
          const existing = find();
          if (existing?.password === password || this.prompting.has(key))
            return;
          this.prompting.add(key);
          try {
            const context = windowFor(event.sender);
            const response = context
              ? await this.popup(context.win).ask(
                  {
                    mode: 'save',
                    site: new URL(origin).host,
                    username,
                    update: Boolean(existing),
                  },
                  event.sender,
                  context.theme(),
                )
              : null;
            if (response === 0) {
              const current = find();
              if (current) current.password = password;
              else
                this.logins.push({
                  id: randomUUID(),
                  origin,
                  username,
                  password,
                });
            } else if (response === 2 && !this.never.includes(origin))
              this.never.push(origin);
            if (response === 0 || response === 2) this.save();
          } finally {
            this.prompting.delete(key);
          }
        })().catch((error) => console.error('Saving password failed:', error));
      },
    );
  }
}
export const passwords = new Passwords();
