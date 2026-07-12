import github from './github.js';

const PACKS = { github };

export function getDomain(name = 'github') {
  const pack = PACKS[name];
  if (!pack) throw new Error(`Unknown domain: ${name}`);
  return pack;
}
