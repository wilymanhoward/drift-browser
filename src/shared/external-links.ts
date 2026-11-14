import { isLocalPDF, isWebURL, navigationURL } from './navigation';

// The link or PDF file Windows asked Drift to open, if any.
export function externalLink(argv: string[]): string | undefined {
  const web = argv.find((arg) => /^https?:\/\//i.test(arg) && isWebURL(arg));
  if (web) return web;
  for (const arg of argv)
    if (/\.pdf$/i.test(arg))
      try {
        const url = navigationURL(arg);
        if (isLocalPDF(url)) return url;
      } catch {
        /* Not a usable PDF path. */
      }
}
