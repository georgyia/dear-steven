import { Allow, parse } from 'partial-json';
import {
  type ModelAnswer,
  ModelAnswerSchema,
  type ModelBlock,
  ModelBlockSchema,
} from '../schema/index.ts';

function parsePartial(text: string): { blocks?: unknown[]; evidence?: unknown } | null {
  try {
    const value: unknown = parse(text, Allow.ALL & ~Allow.STR);
    return value && typeof value === 'object'
      ? (value as { blocks?: unknown[]; evidence?: unknown })
      : null;
  } catch {
    return null;
  }
}

/**
 * Watches the model's structured output arrive as JSON text and reports blocks as they *complete*.
 * Strict structured output emits keys in schema order, so block i is complete once block i+1 has
 * begun, or once the `evidence` key (which follows `blocks`) appears.
 */
export class BlockStream {
  private buffer = '';
  private started = 0;
  private completed = 0;

  push(delta: string): {
    started: number[];
    completed: { index: number; block: ModelBlock | null }[];
  } {
    this.buffer += delta;
    const partial = parsePartial(this.buffer);
    if (!partial) return { started: [], completed: [] };
    const blocks = Array.isArray(partial.blocks) ? partial.blocks : [];
    const started: number[] = [];
    while (this.started < blocks.length) started.push(this.started++);

    const closed = 'evidence' in partial;
    const ready = closed ? blocks.length : Math.max(0, blocks.length - 1);
    const completed: { index: number; block: ModelBlock | null }[] = [];
    while (this.completed < ready) {
      const index = this.completed++;
      const parsed = ModelBlockSchema.safeParse(blocks[index]);
      completed.push({ index, block: parsed.success ? parsed.data : null });
    }
    return { started, completed };
  }

  /** The whole answer, validated against the schema. Throws if the model broke the contract. */
  finish(): ModelAnswer {
    return ModelAnswerSchema.parse(JSON.parse(this.buffer));
  }

  get text() {
    return this.buffer;
  }
}
