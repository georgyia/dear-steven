import { describe, expect, it } from 'vitest';
import { groupTurns, type Turn } from './conversation';
import { MODE_KEY, readMode, writeMode } from './mode';

const store = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
};
const blocked = {
  getItem: () => {
    throw new DOMException('denied', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('denied', 'SecurityError');
  },
};

describe('the reply mode, kept for the visit (P7-05)', () => {
  it('remembers talk, and starts with ask', () => {
    const s = store();
    expect(readMode(s)).toBe('ask');
    writeMode('talk', s);
    expect(s.data.get(MODE_KEY)).toBe('talk');
    expect(readMode(s)).toBe('talk');
    writeMode('ask', s);
    expect(readMode(s)).toBe('ask');
  });

  it('reads anything unexpected as ask, and survives blocked storage', () => {
    const s = store();
    s.setItem(MODE_KEY, 'interview');
    expect(readMode(s)).toBe('ask');
    expect(readMode(blocked)).toBe('ask');
    expect(() => writeMode('talk', blocked)).not.toThrow();
    expect(readMode(null)).toBe('ask');
  });
});

describe('groupTurns (P7-05)', () => {
  const turn = (id: string, mode?: 'talk') => ({ id, ...(mode ? { mode } : {}) }) as Turn;

  it('keeps consecutive talk turns together, and every answer on its own', () => {
    const groups = groupTurns([
      turn('a'),
      turn('b', 'talk'),
      turn('c', 'talk'),
      turn('d'),
      turn('e', 'talk'),
    ]);
    expect(
      groups.map((g) => (g.kind === 'ask' ? g.turn.id : g.turns.map((t) => t.id).join('+'))),
    ).toEqual(['a', 'b+c', 'd', 'e']);
  });
});
