import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import type { Session, WebContents, WebFrameMain } from 'electron';
import { dialog } from 'electron';
import { PrivacyController, permissionLabel } from '../src/main/privacy';

vi.mock('electron', () => ({
  app: { userAgentFallback: 'Chrome/140.0.0.0' },
  dialog: { showMessageBox: vi.fn(async () => ({ response: 1 })) },
  webContents: { fromId: vi.fn() },
}));
vi.mock('../src/main/cosmetics', () => ({ enableCosmetics: vi.fn() }));
afterEach(() => vi.clearAllMocks());

async function fixture() {
  const session = {
    getUserAgent: () => 'Chrome/140.0.0.0',
    setUserAgent: vi.fn(),
    webRequest: {
      onBeforeRequest: vi.fn(),
      onBeforeSendHeaders: vi.fn(),
      onHeadersReceived: vi.fn(),
    },
    setPermissionCheckHandler: vi.fn<Session['setPermissionCheckHandler']>(),
    setPermissionRequestHandler:
      vi.fn<Session['setPermissionRequestHandler']>(),
  };
  const privacy = new PrivacyController(
    session as unknown as Session,
    () => null!,
    true,
    vi.fn(),
    vi.fn(),
  );
  await privacy.load();
  const check = session.setPermissionCheckHandler.mock.calls[0][0]!;
  const request = session.setPermissionRequestHandler.mock.calls[0][0]!;
  const page = (id: number, url: string, child?: string) => {
    const frame = (url: string) =>
      ({
        url,
        origin: new URL(url).origin,
        isDestroyed: () => false,
      }) as WebFrameMain;
    const main = frame(url);
    const sub = child ? frame(child) : null;
    Object.assign(main, { framesInSubtree: [main, ...(sub ? [sub] : [])] });
    return Object.assign(new EventEmitter(), {
      id,
      mainFrame: main,
      getURL: () => url,
      isDestroyed: () => false,
    }) as unknown as WebContents;
  };
  const grant = (page: WebContents, url = page.getURL()) =>
    new Promise<boolean>((resolve) =>
      request(page, 'geolocation', resolve, {
        requestingUrl: url,
        isMainFrame: url === page.getURL(),
      }),
    );
  const sendHeaders = session.webRequest.onBeforeSendHeaders.mock.calls[0][0];
  return { privacy, check, request, grant, page, sendHeaders };
}

it('revokes same-origin grants in every tab, including after removing a stored block', async () => {
  const { privacy, check, grant, page } = await fixture();
  const origin = 'https://permission.example';
  const a = page(1, origin + '/a');
  const b = page(2, origin + '/b');
  const other = page(3, 'https://other.example/');
  expect(await grant(a)).toBe(true);
  expect(await grant(b)).toBe(true);
  expect(await grant(other)).toBe(true);
  const details = { isMainFrame: true };
  expect(check(b, 'geolocation', origin, details)).toBe(true);
  privacy.command(
    { type: 'permission', permission: 'geolocation', denied: true },
    a.id,
    a.getURL(),
  );
  expect(check(a, 'geolocation', origin, details)).toBe(false);
  expect(check(b, 'geolocation', origin, details)).toBe(false);
  privacy.command(
    { type: 'permission', permission: 'geolocation', denied: false },
    a.id,
    a.getURL(),
  );
  expect(check(b, 'geolocation', origin, details)).toBe(false);
  expect(check(other, 'geolocation', 'https://other.example', details)).toBe(
    true,
  );
  privacy.dispose();
});

it('allows a cross-origin frame and rejects approval after that frame navigates', async () => {
  const { privacy, grant, page } = await fixture();
  const child = 'https://child.example/frame';
  const parent = page(1, 'https://parent.example/', child);
  expect(await grant(parent, child)).toBe(true);
  let approve!: (
    value: Awaited<ReturnType<typeof dialog.showMessageBox>>,
  ) => void;
  vi.mocked(dialog.showMessageBox).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        approve = resolve;
      }),
  );
  const pending = grant(parent, child);
  parent.emit('did-start-navigation', {
    isSameDocument: false,
    isMainFrame: false,
    frame: parent.mainFrame.framesInSubtree[1],
  });
  approve({ response: 1, checkboxChecked: false });
  expect(await pending).toBe(false);
  await vi.waitFor(() =>
    expect(parent.listenerCount('did-start-navigation')).toBe(0),
  );
  privacy.dispose();
});

it('rejects an allow response if another tab blocks the origin while the prompt is open', async () => {
  const { privacy, grant, page } = await fixture();
  const a = page(1, 'https://permission.example/a');
  let approve!: (
    value: Awaited<ReturnType<typeof dialog.showMessageBox>>,
  ) => void;
  vi.mocked(dialog.showMessageBox).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        approve = resolve;
      }),
  );
  const pending = grant(a);
  privacy.command(
    { type: 'permission', permission: 'geolocation', denied: true },
    2,
    a.getURL(),
  );
  approve({ response: 1, checkboxChecked: false });
  expect(await pending).toBe(false);
  privacy.dispose();
});

it('grants clipboard writes and pointer lock to web pages without a prompt', async () => {
  const { privacy, check, request, page } = await fixture();
  const a = page(1, 'https://copy.example/');
  const details = { isMainFrame: true };
  expect(
    check(a, 'clipboard-sanitized-write', 'https://copy.example', details),
  ).toBe(true);
  expect(check(a, 'clipboard-read', 'https://copy.example', details)).toBe(
    false,
  );
  const granted = await new Promise<boolean>((resolve) =>
    request(a, 'pointerLock', resolve, {
      requestingUrl: a.getURL(),
      isMainFrame: true,
    }),
  );
  expect(granted).toBe(true);
  expect(dialog.showMessageBox).not.toHaveBeenCalled();
  privacy.dispose();
});

it('asks before handing a link to another app and never opens local-file schemes', async () => {
  const { privacy, request, page } = await fixture();
  const a = page(1, 'https://mail.example/');
  const open = (externalURL: string) =>
    new Promise<boolean>((resolve) =>
      request(a, 'openExternal', resolve, {
        requestingUrl: a.getURL(),
        isMainFrame: true,
        externalURL,
      } as never),
    );
  expect(await open('mailto:someone@example.com')).toBe(true);
  expect(dialog.showMessageBox).toHaveBeenCalledTimes(1);
  expect(await open('file:///C:/Windows/System32/calc.exe')).toBe(false);
  expect(await open('search-ms:query=x')).toBe(false);
  expect(await open('ms-msdt:/id')).toBe(false);
  expect(dialog.showMessageBox).toHaveBeenCalledTimes(1);
  privacy.dispose();
});

it('stops prompting a page after it has been blocked three times', async () => {
  const { privacy, grant, page } = await fixture();
  vi.mocked(dialog.showMessageBox).mockResolvedValue({
    response: 0,
    checkboxChecked: false,
  });
  const a = page(1, 'https://nag.example/');
  for (let i = 0; i < 5; i++) expect(await grant(a)).toBe(false);
  expect(dialog.showMessageBox).toHaveBeenCalledTimes(3);
  vi.mocked(dialog.showMessageBox).mockResolvedValue({
    response: 1,
    checkboxChecked: false,
  });
  privacy.dispose();
});

it('names the device a media request is for', () => {
  expect(permissionLabel('media', ['video'])).toBe('your camera');
  expect(permissionLabel('media', ['audio'])).toBe('your microphone');
  expect(permissionLabel('media', ['video', 'audio'])).toBe(
    'your camera and microphone',
  );
  expect(permissionLabel('geolocation')).toBe('your location');
});

it('keeps cookies on requests that have no page to compare against', async () => {
  const { privacy, sendHeaders } = await fixture();
  const headers = await new Promise<Record<string, string>>((resolve) =>
    sendHeaders!(
      {
        url: 'https://mail.example/sync',
        resourceType: 'xhr',
        requestHeaders: { Cookie: 'sid=1' },
      } as never,
      ({ requestHeaders }: { requestHeaders?: Record<string, string> }) =>
        resolve(requestHeaders!),
    ),
  );
  expect(headers.Cookie).toBe('sid=1');
  privacy.dispose();
});
