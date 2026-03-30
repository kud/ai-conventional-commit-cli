# Performance optimisations

Reduced startup latency by parallelising independent operations.

## Changes

- Combined `ensureStagedChanges` and `parseDiff` into a single `getStagedFilesAndDiff` call
- Git diff and status now run in parallel via `Promise.all`
- Style profiling and plugin loading now run in parallel
- Removed synchronous `clusterHunks` wrapper step in split mode
- Removed redundant `getStagedFiles` call in split commit loop
