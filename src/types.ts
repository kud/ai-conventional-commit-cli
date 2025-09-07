export interface DiffHunk {
  file: string;
  header: string;
  from: number;
  to: number;
  added: number;
  removed: number;
  lines: string[];
  hash: string;
  functionContext?: string;
}

export interface FileDiff {
  file: string;
  hunks: DiffHunk[];
  additions: number;
  deletions: number;
  languageGuess?: string;
}

export interface StyleProfile {
  tense: string;
  avgTitleLength: number;
  usesScopes: boolean;
  gitmojiRatio: number;
  topPrefixes: string[];
  conventionalRatio: number;
}

export interface CommitCandidate {
  title: string;
  body?: string;
  score: number;
  reasons?: string[];
  files?: string[]; // optional list of associated files for staging
  clusterIds?: string[];
}

export interface CommitPlan {
  commits: CommitCandidate[];
  meta?: {
    splitRecommended?: boolean;
  };
}

export interface RefineOptions {
  shorter?: boolean;
  longer?: boolean;
  scope?: string;
  emoji?: boolean;
  index?: number;
}

export interface PluginContext {
  cwd: string;
  env: NodeJS.ProcessEnv;
}

export interface Plugin {
  name: string;
  transformCandidates?(
    candidates: CommitCandidate[],
    ctx: PluginContext,
  ): Promise<CommitCandidate[]> | CommitCandidate[];
  validateCandidate?(
    candidate: CommitCandidate,
    ctx: PluginContext,
  ): Promise<string[] | void | string> | string[] | void | string;
}
