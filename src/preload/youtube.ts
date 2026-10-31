// This function is serialized into the page's main world; keep its helpers local.
export function youtubeCompatibility() {
  const prune = (value: unknown): unknown => {
    if (!value || typeof value !== 'object') return value;
    const root = value as Record<string, unknown>;
    const player =
      root.playerResponse && typeof root.playerResponse === 'object'
        ? (root.playerResponse as Record<string, unknown>)
        : root;
    if ('streamingData' in player || 'playabilityStatus' in player) {
      for (const key of [
        'adPlacements',
        'playerAds',
        'adSlots',
        'no_ads',
        'adBreakHeartbeatParams',
      ]) {
        try {
          delete player[key];
        } catch {
          /* A frozen response stays intact. */
        }
      }
    }
    return value;
  };
  const playerURL = (url: string) => {
    try {
      const target = new URL(url, location.href);
      return (
        (target.hostname === 'youtube.com' ||
          target.hostname.endsWith('.youtube.com') ||
          target.hostname === 'youtubei.googleapis.com') &&
        /\/(?:youtubei\/v\d+\/player|player|get_watch)(?:\/|$)/.test(
          target.pathname,
        )
      );
    } catch {
      return false;
    }
  };
  // Initial page data, later JSON.parse calls and native JSON responses take
  // separate paths through YouTube's player, especially on in-page navigation.
  JSON.parse = new Proxy(JSON.parse, {
    apply(target, receiver, args) {
      return prune(Reflect.apply(target, receiver, args));
    },
  });
  Response.prototype.json = new Proxy(Response.prototype.json, {
    apply(target, response: Response, args) {
      const result = Reflect.apply(target, response, args) as Promise<unknown>;
      return playerURL(response.url) ? result.then(prune) : result;
    },
  });
  const response = Object.getOwnPropertyDescriptor(
    XMLHttpRequest.prototype,
    'response',
  );
  if (response?.get && response.configurable) {
    const get = response.get;
    Object.defineProperty(XMLHttpRequest.prototype, 'response', {
      ...response,
      get() {
        const value = get.call(this);
        return this.responseType === 'json' && playerURL(this.responseURL)
          ? prune(value)
          : value;
      },
    });
  }
  const descriptor = Object.getOwnPropertyDescriptor(
    window,
    'ytInitialPlayerResponse',
  );
  if (!descriptor || descriptor.configurable) {
    let value = prune(
      descriptor?.get ? descriptor.get.call(window) : descriptor?.value,
    );
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
      configurable: true,
      enumerable: descriptor?.enumerable ?? true,
      get() {
        return descriptor?.get ? prune(descriptor.get.call(window)) : value;
      },
      set(next) {
        value = prune(next);
        descriptor?.set?.call(window, value);
      },
    });
  }

  let observer: MutationObserver | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let player: HTMLElement | null = null;
  let attempts = 0;
  const skip = () => {
    clearTimeout(retry);
    if (
      !player?.classList.contains('ad-showing') &&
      !player?.classList.contains('ad-interrupting')
    ) {
      attempts = 0;
      return;
    }
    try {
      const button = player.querySelector<HTMLElement>(
        '.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern',
      );
      if (button) button.click();
    } catch {
      /* The player can replace its controls during navigation. */
    }
    if (++attempts < 20) retry = setTimeout(skip, 500);
  };
  const attach = () => {
    observer?.disconnect();
    clearTimeout(retry);
    player = document.querySelector('#movie_player');
    attempts = 0;
    if (!player) return;
    observer = new MutationObserver(skip);
    observer.observe(player, { attributes: true, attributeFilter: ['class'] });
    skip();
  };
  document.addEventListener('yt-navigate-finish', attach);
  document.addEventListener('yt-player-updated', attach);
  window.addEventListener('pageshow', attach);
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', attach, { once: true });
  else attach();
  window.addEventListener(
    'pagehide',
    () => {
      observer?.disconnect();
      clearTimeout(retry);
    },
    { once: true },
  );
}
