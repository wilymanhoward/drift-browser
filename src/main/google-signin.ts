import { app } from 'electron';
import type { WebContents } from 'electron';
import { firefoxUserAgent, isGoogleSignIn } from '../shared/google-signin';

// The request headers are rewritten in the privacy controller; this keeps the
// page's own navigator.userAgent in step so Google's scripts see the same
// browser the server did. Covers tabs, previews and sign-in popups alike.
const switched = new WeakSet<WebContents>();

function follow(contents: WebContents) {
  contents.on('did-start-navigation', (details) => {
    if (!details.isMainFrame || details.isSameDocument) return;
    const signIn = isGoogleSignIn(details.url);
    if (signIn && !switched.has(contents)) {
      contents.setUserAgent(firefoxUserAgent());
      switched.add(contents);
    } else if (!signIn && switched.has(contents)) {
      contents.setUserAgent(contents.session.getUserAgent());
      switched.delete(contents);
    }
  });
}

export function enableGoogleSignIn() {
  app.on('web-contents-created', (_event, contents) => {
    const type = contents.getType();
    if (type === 'window' || type === 'browserView' || type === 'webview')
      follow(contents);
  });
}
