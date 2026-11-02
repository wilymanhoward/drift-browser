# Windows default browser

Direction: one option in General settings using Drift's existing preference rows, button and status text. ENERGY 1 / RHYTHM 1 / MOTION 1.

- Hard Gate PASS: real labelled action, disabled/loading/default/error states and keyboard-native button semantics. Existing tokens, typography and layout reused. No new assets, CSS effects, dependencies or background polling.
- Purpose Gate PASS: current status explains the action; the installer requirement avoids registering an ephemeral development/portable executable. Windows retains the final selection through its own default-app interface.
- Liveliness PASS: the existing General settings hierarchy and restrained interface are preserved without a new banner or startup prompt.
- Craftsmanship PASS: production build, 89 unit tests and scoped ESLint pass. Six focused tests cover external URL validation, registry identity, both default protocols, Windows Settings fallback, development/portable/mismatched registrations and invalid inputs. Source Electron checks cover the settings action/status/error states and real cold/warm process link delivery. Three existing paired-window/live/private tear-off regressions pass. Both new checks pass in the packaged app. Screenshots of light/dark settings were inspected.

Integration: the per-user NSIS hook registers DriftURL and HTTP/HTTPS browser capabilities, with a quoted executable/URL command and uninstall cleanup. It does not edit Windows UserChoice keys or claim any other app's protocol key. The main process opens only a fixed Windows Settings URI through the existing trusted UI IPC routing. Registration reads use the system registry executable with fixed arguments. External activation accepts validated credential-free HTTP/S URLs and targets regular windows; a single-instance lock prevents duplicate processes from competing for profile data.

Validation limits: the installer compiled successfully, but it was not run against the user's Windows registration and the OS selection was not changed. Unit tests mock the registry reader and shell launch. The UI test mocks installed/default status and Settings launch so it does not change the machine; external-link tests launch real second processes with isolated profiles. One initial UI run exceeded its 30-second limit; the isolated retry and subsequent complete source/packaged runs passed. The Windows installer is rebuilt; the portable artifact is unchanged.

References: [Windows Default Apps URI and per-user registration](https://learn.microsoft.com/en-us/windows/apps/develop/launch/launch-default-apps-settings), [Electron default-client checks and single-instance activation](https://www.electronjs.org/docs/latest/api/app).
