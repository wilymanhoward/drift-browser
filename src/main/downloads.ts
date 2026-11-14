import { shell } from 'electron';
import type { Session, DownloadItem, WebContents } from 'electron';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import type { DownloadState, DownloadCommand } from '../shared/power';

export class Downloads {
  private entries: {
    item: DownloadItem;
    state: DownloadState;
    path: string;
  }[] = [];
  constructor(
    private session: Session,
    private owns: (page: WebContents) => boolean,
    private changed: () => void,
    private onStart: (page: WebContents) => void = () => {},
    private onDone: (page: WebContents, done: DownloadState) => void = () => {},
  ) {
    session.on('will-download', this.started);
  }
  private started = (
    _event: Electron.Event,
    item: DownloadItem,
    page: WebContents,
  ) => {
    if (!page || !this.owns(page)) return;
    const entry = {
      item,
      path: '',
      state: {
        id: randomUUID(),
        name: item.getFilename().slice(0, 1024),
        received: 0,
        total: item.getTotalBytes(),
        speed: 0,
        status: 'progressing' as DownloadState['status'],
        paused: false,
        resumable: false,
        done: false,
      },
    };
    this.entries = this.entries
      .filter((e) => !e.state.done)
      .concat(this.entries.filter((e) => e.state.done).slice(0, 99));
    this.entries.unshift(entry);
    this.onStart(page);
    const update = () => {
      entry.state.received = item.getReceivedBytes();
      entry.state.total = item.getTotalBytes();
      entry.state.speed = entry.state.done
        ? 0
        : item.getCurrentBytesPerSecond();
      entry.state.paused = item.isPaused();
      entry.state.resumable = item.canResume();
      this.changed();
    };
    item.on('updated', (_event, status) => {
      entry.state.status = status;
      update();
    });
    item.once('done', (_event, status) => {
      entry.state.status = status;
      entry.state.done = true;
      entry.path = item.getSavePath();
      update();
      if (status === 'completed') this.onDone(page, { ...entry.state });
    });
    this.changed();
  };
  get state() {
    return this.entries.map((e) => ({ ...e.state }));
  }
  // The saved file of a finished download, if it is still where it was saved.
  file(id: string) {
    const entry = this.entries.find((e) => e.state.id === id);
    if (
      entry?.state.status !== 'completed' ||
      !entry.path ||
      !existsSync(entry.path)
    )
      throw new Error('Downloaded file is unavailable');
    return entry.path;
  }
  command(command: DownloadCommand) {
    const entry = this.entries.find((e) => e.state.id === command.id);
    if (!entry) throw new Error('Unknown download');
    if (command.type === 'reveal')
      shell.showItemInFolder(this.file(entry.state.id));
    else if (command.type === 'drag' || command.type === 'open')
      throw new Error('Handled by the window');
    else if (command.type === 'remove') {
      if (!entry.state.done)
        throw new Error('Cancel the download before removing it');
      this.entries = this.entries.filter((e) => e !== entry);
    } else {
      if (entry.state.done) throw new Error('This download has ended');
      if (command.type === 'pause') entry.item.pause();
      else if (
        command.type === 'resume' &&
        (entry.state.paused || entry.state.resumable)
      )
        entry.item.resume();
      else if (command.type === 'cancel') entry.item.cancel();
      else throw new Error('Cannot resume this download');
      entry.state.paused = !entry.state.done && entry.item.isPaused();
    }
    this.changed();
  }
  dispose() {
    this.session.removeListener('will-download', this.started);
    for (const entry of this.entries)
      if (!entry.state.done) entry.item.cancel();
  }
}
