# Public repository review

Scope: the tracked source tree and all 15 existing commits before publication. This is a source-disclosure check, not a complete application penetration test or legal opinion.

## Disclosure checks

- Gitleaks 8.30.1, downloaded from its official GitHub release and checked against the release SHA-256 file, scanned all Git refs and approximately 9.88 MB of history.
- All 55 reported matches were reviewed: 53 are ordinary 40-character hashes inside upstream filter lists, incorrectly classified as Sourcegraph tokens; two are public malware URL match patterns in uBlock's badware list. The relevant values were checked against the upstream Ghostery asset mirror. No Drift-owned credentials were identified. The lists remain unmodified to preserve their behavior and provenance.
- Git history contains no `.env` files, signing/private key files, browser profile databases or test-output folders. Commit identity uses the owner's GitHub noreply address. No history rewrite was needed.
- Existing ignores exclude dependencies, builds, test output and installers. Added ignores cover environment files, signing/private keys and local databases.
- Filter source bodies, hashes and licenses remain included. Added the complete SIL OFL 1.1 text and existing copyright attributions for the three bundled fonts; application packaging includes that text.
- Making the repository public does not assign a new license to Drift's original code. Third-party components retain their own licenses and notices.

## Dependency remediation and checks

- Runtime audit identified vulnerable `adm-zip` 0.5.18 through `electron-chrome-web-store`. A scoped npm override pins 0.6.1, the patched release. `npm audit --omit=dev` now reports zero vulnerabilities.
- Full `npm audit` retains 25 moderate findings in the development dependency graph, rooted in older `minimatch` versions. Automatic suggestions include incompatible major downgrades; these were not applied. See SECURITY.md for limits and reporting guidance.
- All 82 unit tests pass and the production build succeeds after the dependency change.
- A real Chrome Web Store download installed Google Translate 2.0.18 and survived restart in an isolated test profile using the updated ZIP dependency. The first test attempt exceeded its 5-second startup wait; rerunning with a 30-second startup bound passed.
- Enabled weekly npm Dependabot update checks through repository configuration. GitHub security settings are verified separately after publication.

References: [ZIP allocation advisory](https://github.com/advisories/GHSA-7q85-xj36-vmfc), [official font license](https://openfontlicense.org/open-font-license-official-text/), [Gitleaks release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1).
