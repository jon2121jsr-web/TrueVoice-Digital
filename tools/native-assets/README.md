# Optional native artwork generation

This directory is a separate npm project, not a root workspace. Normal root
`npm ci`, web builds and Capacitor sync do not install or invoke this tool.
Committed native assets are used for ordinary packaging. Do not install this
project in release CI or on a host containing signing keys/backend credentials.
The isolated generator is not approved for routine release execution.

The exact `@capacitor/assets 3.0.5` version and its transitive dependencies are
pinned in this lockfile. They remain vulnerable (Sharp, nested CLI/tar and uuid).
Isolation reduces release-host exposure; it does not repair these packages.
Use only reviewed artwork in a disposable restricted environment, with separate
approval of the regeneration risk. This npm directory is not an OS sandbox.

## Explicit workflow

Prepare a disposable copy of the reviewed source revision containing `assets/`,
`ios/`, `android/` and this tooling directory. Do not copy environment files,
signing keys, native credentials, existing node_modules or CI secrets. Run these
commands from that copy's root, never the release checkout:

```powershell
npm ci --prefix tools/native-assets --no-audit --no-fund
npm audit --prefix tools/native-assets
node tools/native-assets/node_modules/@capacitor/assets/bin/capacitor-assets generate --ios --android --assetPath assets --iconBackgroundColor "#050816" --splashBackgroundColor "#050816"
```

The audit exits nonzero for known findings; do not hide them. No npx download or
root package install is required. The generation command selects only native
platforms, preserving PWA assets. npm installation can run Sharp's native install
script; allow required downloads only in the disposable environment, then restrict
network access during generation. `--ignore-scripts` is suitable for dependency
inspection but does not prepare Sharp for working image generation.

Keep `assets/icon.png` at least 1024x1024. Existing source splash is 1024x1024;
review upscaling quality or supply approved 2732x2732 artwork before regeneration.
Verify both platforms actually generated outputs: this upstream CLI can report
errors or skip absent platforms without a failing exit status. Review PNG/XML/
catalog diffs and device appearance; copy only approved native resources back.
Never copy generated signing/project/configuration changes wholesale. Retain the
existing source artwork and catalog/resource layout in the main repository.

After reviewing outputs, use normal root build/sync in the release checkout as
documented in NATIVE_APP_SETUP.md. Future tool updates require a separate audit,
lockfile review and output validation. Do not run npm update for routine artwork.
