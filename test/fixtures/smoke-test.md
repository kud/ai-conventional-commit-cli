# opencode SDK migration

Replaced the `execa`-based subprocess provider with `@opencode-ai/sdk` for cleaner,
typed communication with the opencode server.

## Changes

- `OpenCodeProvider` now uses `createOpencode()` instead of spawning `opencode run`
- Timeout handled via `AbortController` passed to the SDK
- Removed eager JSON detection and stdout accumulation hacks
- Model string `"provider/model"` split into `{ providerID, modelID }` for the SDK
- Session lifecycle: create → prompt → `server.close()` in `finally`
