# Add retry logic for transient API failures

Improve reliability when the upstream model API returns 429 or 503 responses.

## Changes

- Added exponential backoff with jitter in `callModelWithRetry`
- Cap retries at 3 attempts with a max delay of 8 seconds
- Surface a human-readable error after exhausting retries instead of throwing raw
- Log each retry attempt at `debug` level for easier diagnostics
