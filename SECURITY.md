# Security

Drift is experimental browser software. Public source availability is not a security certification. Avoid relying on it for sensitive browsing until its browser isolation, extension compatibility and update process have received independent review.

Report vulnerabilities privately through [GitHub's vulnerability reporting page](https://github.com/wilymanhoward/drift-browser/security/advisories/new). Do not put credentials, browsing databases, cookies, private URLs or exploitable details in a public issue.

Use the latest source and a supported Electron runtime. Extension code can access sites according to its permissions; only install extensions you trust. Existing downloaded installers are not automatically rebuilt when dependencies change in this repository.

The runtime dependency audit was clean after pinning the extension installer's `adm-zip` dependency to 0.6.1 on 31 October 2026. The complete audit still reports moderate development-tool dependency findings involving older `minimatch` versions. Those tools run during local linting and packaging; do not run builds against untrusted source or glob patterns. Recheck with `npm audit` as advisories change.

Local browser profiles contain plaintext browsing data. Keep profiles, `.env` files, signing keys, test output and installer artifacts out of Git. The ignore rules are a precaution and cannot remove files already committed; review the staged diff before every push.
