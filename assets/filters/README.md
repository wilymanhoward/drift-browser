# Bundled network filters

EasyList and EasyPrivacy snapshots from 27 October 2026, obtained from their official distribution URLs:

- https://easylist.to/easylist/easylist.txt
- https://easylist.to/easylist/easyprivacy.txt

Original headers and license notices are retained in the files. `full-engine.bin` is a complete compiled snapshot containing EasyList, EasyPrivacy, Peter Lowe's list, uBlock Origin's filter/unbreak/quick-fix lists and their scriptlet resources. This keeps network blocking, ad hiding and player-compatible scriptlets available together before the first navigation, including offline.

`full-engine.json` records snapshot time, source URLs and SHA-256 checksums. `full-sources.json` contains every unmodified source body, including original headers. uBlock sources/resources are GPL-3.0; `UBLOCK-LICENSE.txt` accompanies them. Source references and notices also appear in THIRD-PARTY-NOTICES.md.

Drift uses a newer complete profile cache when available, otherwise this snapshot. Daily refreshes are atomic; a failed download retains the working engine. Shields can force a refresh and reload the current page. Regenerate bundled data explicitly with `node scripts/update-bundled-filters.mjs`; normal builds require no filter downloads. Source text is included for attribution/reproducibility and is not loaded by the runtime.
