import { FileDiff, DiffHunk } from './types.js';

export interface Cluster {
  id: string;
  files: string[];
  hunkHashes: string[];
  rationale: string;
}

const topLevel = (file: string): string => file.split('/')[0] || file;

export const clusterHunks = (files: FileDiff[]): Cluster[] => {
  const clusters: Cluster[] = [];
  // Simple heuristic: group by top-level directory, fallback single-file clusters for large files
  const byDir = new Map<string, DiffHunk[]>();
  for (const f of files) {
    for (const h of f.hunks) {
      const dir = topLevel(f.file);
      if (!byDir.has(dir)) byDir.set(dir, []);
      byDir.get(dir)!.push(h);
    }
  }
  for (const [dir, hunks] of byDir.entries()) {
    // further split if too many hunks
    if (hunks.length <= 5) {
      clusters.push({
        id: `dir-${dir}`,
        files: [...new Set(hunks.map((h) => h.file))],
        hunkHashes: hunks.map((h) => h.hash),
        rationale: `Changes grouped by directory ${dir}`,
      });
    } else {
      // break into groups by file
      const perFile = new Map<string, DiffHunk[]>();
      for (const h of hunks) {
        if (!perFile.has(h.file)) perFile.set(h.file, []);
        perFile.get(h.file)!.push(h);
      }
      for (const [file, list] of perFile.entries()) {
        clusters.push({
          id: `file-${file}`,
          files: [file],
          hunkHashes: list.map((h) => h.hash),
          rationale: `Large directory; grouped by file ${file}`,
        });
      }
    }
  }
  return clusters;
};
