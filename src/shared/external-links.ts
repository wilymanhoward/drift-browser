import { isWebURL } from './navigation';

export function externalLink(argv: string[]): string | undefined {
  return argv.find((arg) => /^https?:\/\//i.test(arg) && isWebURL(arg));
}
