import { Plugin } from '../../src/types.js';

const examplePlugin: Plugin = {
  name: 'example-plugin',
  transformCandidates(candidates) {
    return candidates.map((c) => {
      if (/^\w+\(.+\): /.test(c.title)) {
        return { ...c, score: Math.min(100, c.score + 5) };
      }
      return c;
    });
  },
  validateCandidate(candidate) {
    if (/WIP/i.test(candidate.title)) {
      return 'Title contains WIP; remove before committing.';
    }
  },
};

export default examplePlugin;
