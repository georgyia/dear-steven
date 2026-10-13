import { createHash } from 'node:crypto';
import { z } from 'zod';
import { EMBEDDING_DIMENSIONS } from '../config/models.ts';
import type { PassageDraft } from '../ingest/chunk.ts';
import {
  type AttributionMethod,
  type ConversationSummary,
  ConversationSummarySchema,
  type Episode,
  type EpisodeType,
  type OffsetStep,
  OffsetStepSchema,
  type Passage,
  type Segment,
  type Speaker,
  type SpeakersPresent,
  type TranscriptSource,
  type TranscriptStatus,
  type YouTubeAlignment,
} from '../schema/index.ts';
import { toFtsQuery } from './fts.ts';
import { type Db, type OpenOptions, openDatabase } from './sqlite.ts';

export interface EpisodeInput {
  sourceGuid: string;
  title: string;
  description: string;
  publishedAt: string;
  durationMs: number | null;
  episodeType: EpisodeType;
  guestNames: string[];
  audioUrl: string | null;
  transcriptUrl: string | null;
}

export interface StoredPassage extends Passage {
  pk: number;
  episode: Episode;
}

export interface SearchHit {
  pk: number;
  passageId: string;
  episodeId: string;
  /** 1-based rank within its own list. */
  rank: number;
  /** bm25 (lower is better) or cosine distance (lower is better). */
  score: number;
}

export interface KnowledgeStats {
  episodes: number;
  transcribedEpisodes: number;
  passages: number;
  embeddedPassages: number;
  diarizedEpisodes: number;
  youtubeLinkedEpisodes: number;
  lastIndexedAt: string | null;
}

export interface RunRow {
  id: number;
  episodeId: string | null;
  stage: string;
  status: 'running' | 'done' | 'failed' | 'skipped';
  startedAt: string;
  finishedAt: string | null;
  error: string | null;
  meta: Record<string, unknown>;
}

interface EpisodeRow {
  id: string;
  source_guid: string;
  title: string;
  description: string;
  published_at: string;
  duration_ms: number | null;
  episode_type: EpisodeType;
  guest_names: string;
  audio_url: string | null;
  transcript_url: string | null;
  transcript_source: TranscriptSource | null;
  transcript_status: TranscriptStatus;
  youtube_video_id: string | null;
  youtube_offset_ms: number;
  youtube_offset_steps: string;
  youtube_alignment: YouTubeAlignment;
  summary: string | null;
  indexed_at: string | null;
}

interface PassageRow {
  pk: number;
  id: string;
  episode_id: string;
  idx: number;
  start_ms: number;
  end_ms: number;
  segment_start_idx: number;
  segment_end_idx: number;
  text: string;
  context_prefix: string;
  speakers_present: SpeakersPresent;
  token_count: number;
}

interface SegmentRow {
  idx: number;
  start_ms: number;
  end_ms: number;
  speaker: Speaker;
  speaker_name: string | null;
  attribution_method: AttributionMethod;
  attribution_confidence: number | null;
  text: string;
}

const now = () => new Date().toISOString();

export const episodeIdFor = (sourceGuid: string) =>
  `ep_${createHash('sha256').update(sourceGuid).digest('hex').slice(0, 12)}`;

export const passageIdFor = (episodeId: string, idx: number) =>
  `${episodeId}_p${String(idx).padStart(4, '0')}`;

/** Ascending by `fromMs`; anything malformed reads as "one offset throughout". */
function parseOffsetSteps(json: string): OffsetStep[] {
  try {
    const parsed = z.array(OffsetStepSchema).safeParse(JSON.parse(json));
    return parsed.success ? parsed.data.sort((a, b) => a.fromMs - b.fromMs) : [];
  } catch {
    return [];
  }
}

const toEpisode = (r: EpisodeRow): Episode => ({
  id: r.id,
  sourceGuid: r.source_guid,
  title: r.title,
  description: r.description,
  publishedAt: r.published_at,
  durationMs: r.duration_ms,
  episodeType: r.episode_type,
  guestNames: JSON.parse(r.guest_names) as string[],
  audioUrl: r.audio_url,
  transcriptUrl: r.transcript_url,
  transcriptSource: r.transcript_source,
  transcriptStatus: r.transcript_status,
  youtubeVideoId: r.youtube_video_id,
  youtubeOffsetMs: r.youtube_offset_ms,
  youtubeOffsetSteps: parseOffsetSteps(r.youtube_offset_steps),
  youtubeAlignment: r.youtube_alignment,
  summary: r.summary,
  indexedAt: r.indexed_at,
});

const toPassage = (r: PassageRow): Passage & { pk: number } => ({
  pk: r.pk,
  id: r.id,
  episodeId: r.episode_id,
  idx: r.idx,
  startMs: r.start_ms,
  endMs: r.end_ms,
  segmentStartIdx: r.segment_start_idx,
  segmentEndIdx: r.segment_end_idx,
  text: r.text,
  contextPrefix: r.context_prefix,
  speakersPresent: r.speakers_present,
  tokenCount: r.token_count,
});

const toSegment = (r: SegmentRow): Segment => ({
  idx: r.idx,
  startMs: r.start_ms,
  endMs: r.end_ms,
  speaker: r.speaker,
  speakerName: r.speaker_name,
  attributionMethod: r.attribution_method,
  attributionConfidence: r.attribution_confidence,
  text: r.text,
});

/**
 * The knowledge base: one SQLite file. Every read and write goes through this class — the web app
 * reads, the ingest CLI writes — so the schema stays an implementation detail of packages/core.
 */
export class KnowledgeStore {
  readonly db: Db;

  private constructor(db: Db) {
    this.db = db;
  }

  static open(path: string, options: OpenOptions = {}): KnowledgeStore {
    return new KnowledgeStore(openDatabase(path, options));
  }

  close() {
    this.db.close();
  }

  // ---------------------------------------------------------------------------------- episodes

  upsertEpisodes(inputs: EpisodeInput[]): { inserted: number; updated: number } {
    const exists = this.db.prepare<[string], { id: string }>(
      'SELECT id FROM episodes WHERE id = ?',
    );
    const insert = this.db.prepare(`
      INSERT INTO episodes (id, source_guid, title, description, published_at, duration_ms, episode_type,
        guest_names, audio_url, transcript_url)
      VALUES (@id, @sourceGuid, @title, @description, @publishedAt, @durationMs, @episodeType,
        @guestNames, @audioUrl, @transcriptUrl)`);
    const update = this.db.prepare(`
      UPDATE episodes SET title = @title, description = @description, published_at = @publishedAt,
        duration_ms = @durationMs, episode_type = @episodeType, audio_url = @audioUrl,
        transcript_url = @transcriptUrl,
        guest_names = CASE WHEN guest_source = 'title' THEN @guestNames ELSE guest_names END,
        updated_at = @now
      WHERE id = @id`);
    let inserted = 0;
    let updated = 0;
    this.db.transaction(() => {
      for (const e of inputs) {
        const id = episodeIdFor(e.sourceGuid);
        const params = { ...e, id, guestNames: JSON.stringify(e.guestNames), now: now() };
        if (exists.get(id)) {
          update.run(params);
          updated += 1;
        } else {
          insert.run(params);
          inserted += 1;
        }
      }
    })();
    return { inserted, updated };
  }

  getEpisode(id: string): Episode | null {
    const row = this.db
      .prepare<[string], EpisodeRow>('SELECT * FROM episodes WHERE id = ?')
      .get(id);
    return row ? toEpisode(row) : null;
  }

  /** Resolves an episode by id, RSS guid, or a unique title fragment (for CLI arguments). */
  findEpisodes(ref: string): Episode[] {
    const exact = this.db
      .prepare<[string, string], EpisodeRow>(
        'SELECT * FROM episodes WHERE id = ? OR source_guid = ?',
      )
      .all(ref, ref);
    if (exact.length) return exact.map(toEpisode);
    return this.db
      .prepare<[string], EpisodeRow>(
        "SELECT * FROM episodes WHERE title LIKE '%' || ? || '%' ORDER BY published_at DESC LIMIT 20",
      )
      .all(ref)
      .map(toEpisode);
  }

  listEpisodes(
    filter: {
      types?: EpisodeType[];
      transcriptStatus?: TranscriptStatus[];
      hasTranscriptUrl?: boolean;
      hasAudio?: boolean;
      limit?: number;
    } = {},
  ): Episode[] {
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.types?.length) {
      where.push(`episode_type IN (${filter.types.map(() => '?').join(',')})`);
      params.push(...filter.types);
    }
    if (filter.transcriptStatus?.length) {
      where.push(`transcript_status IN (${filter.transcriptStatus.map(() => '?').join(',')})`);
      params.push(...filter.transcriptStatus);
    }
    if (filter.hasTranscriptUrl !== undefined) {
      where.push(filter.hasTranscriptUrl ? 'transcript_url IS NOT NULL' : 'transcript_url IS NULL');
    }
    if (filter.hasAudio) where.push('audio_url IS NOT NULL');
    const sql = `SELECT * FROM episodes ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY published_at DESC ${filter.limit ? `LIMIT ${Math.max(1, Math.floor(filter.limit))}` : ''}`;
    return this.db
      .prepare<unknown[], EpisodeRow>(sql)
      .all(...params)
      .map(toEpisode);
  }

  /**
   * Indexed episodes for the episode explorer, newest first, optionally filtered by a title or
   * guest-name fragment. Metadata only — never transcript text.
   */
  browseIndexed(options: { search?: string; limit: number; offset: number }): {
    total: number;
    episodes: (Episode & { passages: number })[];
  } {
    const term = options.search?.trim();
    // LIKE wildcards in user input are escaped so a search for "100%" means exactly that.
    const like = term ? `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
    const where = `WHERE e.indexed_at IS NOT NULL${like ? " AND (e.title LIKE ? ESCAPE '\\' OR e.guest_names LIKE ? ESCAPE '\\')" : ''}`;
    const params = like ? [like, like] : [];
    const total =
      this.db
        .prepare<unknown[], { n: number }>(`SELECT COUNT(*) AS n FROM episodes e ${where}`)
        .get(...params)?.n ?? 0;
    const rows = this.db
      .prepare<unknown[], EpisodeRow & { passages: number }>(
        `SELECT e.*, (SELECT COUNT(*) FROM passages p WHERE p.episode_id = e.id) AS passages
         FROM episodes e ${where} ORDER BY e.published_at DESC LIMIT ? OFFSET ?`,
      )
      .all(
        ...params,
        Math.max(1, Math.floor(options.limit)),
        Math.max(0, Math.floor(options.offset)),
      );
    return { total, episodes: rows.map((r) => ({ ...toEpisode(r), passages: r.passages })) };
  }

  setGuestNames(episodeId: string, names: string[], source: 'title' | 'llm' | 'manual') {
    this.db
      .prepare('UPDATE episodes SET guest_names = ?, guest_source = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(names), source, now(), episodeId);
  }

  setYouTube(
    episodeId: string,
    v: {
      videoId: string | null;
      durationMs: number | null;
      offsetMs: number;
      /** Later offsets; omitted or empty when one offset holds throughout. */
      offsetSteps?: OffsetStep[];
      alignment: YouTubeAlignment;
    },
  ) {
    const steps = (v.offsetSteps ?? []).map((s) => ({
      fromMs: Math.round(s.fromMs),
      offsetMs: Math.round(s.offsetMs),
    }));
    this.db
      .prepare(
        `UPDATE episodes SET youtube_video_id = ?, youtube_duration_ms = ?, youtube_offset_ms = ?,
          youtube_offset_steps = ?, youtube_alignment = ?, updated_at = ? WHERE id = ?`,
      )
      .run(
        v.videoId,
        v.durationMs,
        Math.round(v.offsetMs),
        JSON.stringify(steps),
        v.alignment,
        now(),
        episodeId,
      );
  }

  setTranscriptFailed(episodeId: string) {
    this.db
      .prepare("UPDATE episodes SET transcript_status = 'failed', updated_at = ? WHERE id = ?")
      .run(now(), episodeId);
  }

  // -------------------------------------------------------------------------- transcripts

  /** Replaces an episode's transcript. Its passages (and their embeddings) are dropped with it. */
  replaceTranscript(episodeId: string, segments: Segment[], source: TranscriptSource) {
    const insert = this.db.prepare(`
      INSERT INTO segments (episode_id, idx, start_ms, end_ms, speaker, speaker_name, attribution_method,
        attribution_confidence, text)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM passages WHERE episode_id = ?').run(episodeId);
      // A summary points into the old passages: it goes with them (P8-03).
      this.db.prepare('DELETE FROM episode_summaries WHERE episode_id = ?').run(episodeId);
      this.db.prepare('DELETE FROM segments WHERE episode_id = ?').run(episodeId);
      for (const s of segments) {
        insert.run(
          episodeId,
          s.idx,
          s.startMs,
          s.endMs,
          s.speaker,
          s.speakerName,
          s.attributionMethod,
          s.attributionConfidence,
          s.text,
        );
      }
      this.db
        .prepare(
          `UPDATE episodes SET transcript_source = ?, transcript_status = 'fetched', indexed_at = NULL,
            updated_at = ? WHERE id = ?`,
        )
        .run(source, now(), episodeId);
    })();
  }

  getSegments(episodeId: string, fromIdx = 0, toIdx = Number.MAX_SAFE_INTEGER): Segment[] {
    return this.db
      .prepare<[string, number, number], SegmentRow>(
        'SELECT * FROM segments WHERE episode_id = ? AND idx BETWEEN ? AND ? ORDER BY idx',
      )
      .all(episodeId, fromIdx, toIdx)
      .map(toSegment);
  }

  segmentCount(episodeId: string): number {
    return (
      this.db
        .prepare<[string], { n: number }>('SELECT COUNT(*) AS n FROM segments WHERE episode_id = ?')
        .get(episodeId)?.n ?? 0
    );
  }

  // ----------------------------------------------------------------------------- passages

  replacePassages(episodeId: string, drafts: PassageDraft[], prefix: string): number {
    const insert = this.db.prepare(`
      INSERT INTO passages (id, episode_id, idx, start_ms, end_ms, segment_start_idx, segment_end_idx, text,
        context_prefix, speakers_present, token_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    this.db.transaction(() => {
      this.db.prepare('DELETE FROM passages WHERE episode_id = ?').run(episodeId);
      for (const d of drafts) {
        insert.run(
          passageIdFor(episodeId, d.idx),
          episodeId,
          d.idx,
          d.startMs,
          d.endMs,
          d.segmentStartIdx,
          d.segmentEndIdx,
          d.text,
          prefix,
          d.speakersPresent,
          d.tokenCount,
        );
      }
      this.db
        .prepare('UPDATE episodes SET indexed_at = ?, updated_at = ? WHERE id = ?')
        .run(now(), now(), episodeId);
    })();
    return drafts.length;
  }

  /**
   * Transcript lines that ask something (P7-06): the interview mode's style references. Verified host
   * turns first, then lines whose speaker is unknown; never a verified guest's, who isn't the one
   * asking. A random sample, so interviews don't all lean on the same few.
   */
  questionLines(limit: number): string[] {
    return this.db
      .prepare<[number], { text: string }>(
        `SELECT text FROM segments
         WHERE speaker IN ('host', 'unknown') AND instr(text, '?') > 0
           AND length(text) BETWEEN 20 AND 400
         ORDER BY (speaker = 'host') DESC, random() LIMIT ?`,
      )
      .all(limit)
      .map((r) => r.text);
  }

  /** An episode's passages in order, with the episode. */
  episodePassages(episodeId: string): StoredPassage[] {
    const rows = this.db
      .prepare<[string], PassageRow>('SELECT * FROM passages WHERE episode_id = ? ORDER BY idx')
      .all(episodeId);
    return this.withEpisodes(rows);
  }

  // ---------------------------------------------------------------------------- summaries

  /** Stored only once it has passed `ConversationSummarySchema`; replaces any earlier one. */
  saveConversationSummary(episodeId: string, summary: ConversationSummary) {
    const valid = ConversationSummarySchema.parse(summary);
    this.db
      .prepare(
        `INSERT INTO episode_summaries (episode_id, version, model, summary, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (episode_id) DO UPDATE SET version = excluded.version, model = excluded.model,
           summary = excluded.summary, created_at = excluded.created_at`,
      )
      .run(episodeId, valid.version, valid.model, JSON.stringify(valid), valid.createdAt);
  }

  /** The stored summary, or `null`; one that no longer matches the schema is treated as none. */
  conversationSummary(episodeId: string): ConversationSummary | null {
    const row = this.db
      .prepare<[string], { summary: string }>(
        'SELECT summary FROM episode_summaries WHERE episode_id = ?',
      )
      .get(episodeId);
    if (!row) return null;
    try {
      const parsed = ConversationSummarySchema.safeParse(JSON.parse(row.summary));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  /**
   * Indexed episodes without a summary of `version` (all of them with `force`), newest first,
   * with how many passages, and passage tokens, each would send.
   */
  episodesToSummarise(options: {
    version: string;
    limit?: number;
    episodeId?: string;
    force?: boolean;
  }): (Episode & { passages: number; passageTokens: number })[] {
    const rows = this.db
      .prepare<unknown[], EpisodeRow & { passages: number; passage_tokens: number }>(
        `SELECT e.*,
           (SELECT COUNT(*) FROM passages p WHERE p.episode_id = e.id) AS passages,
           (SELECT SUM(p.token_count) FROM passages p WHERE p.episode_id = e.id) AS passage_tokens
         FROM episodes e
         WHERE e.indexed_at IS NOT NULL
           AND EXISTS (SELECT 1 FROM passages p WHERE p.episode_id = e.id)
           AND (? IS NULL OR e.id = ?)
           AND (? = 1 OR NOT EXISTS (
             SELECT 1 FROM episode_summaries s WHERE s.episode_id = e.id AND s.version = ?))
         ORDER BY e.published_at DESC LIMIT ?`,
      )
      .all(
        options.episodeId ?? null,
        options.episodeId ?? null,
        options.force ? 1 : 0,
        options.version,
        Math.max(1, Math.floor(options.limit ?? 1_000_000)),
      );
    return rows.map((r) => ({
      ...toEpisode(r),
      passages: r.passages,
      passageTokens: r.passage_tokens ?? 0,
    }));
  }

  summaryCount(version: string): number {
    return (
      this.db
        .prepare<[string], { n: number }>(
          'SELECT COUNT(*) AS n FROM episode_summaries WHERE version = ?',
        )
        .get(version)?.n ?? 0
    );
  }

  passageCount(episodeId: string): number {
    return (
      this.db
        .prepare<[string], { n: number }>('SELECT COUNT(*) AS n FROM passages WHERE episode_id = ?')
        .get(episodeId)?.n ?? 0
    );
  }

  /** Passages whose embedding is missing or was made by a different model. */
  passagesNeedingEmbedding(model: string, limit: number, episodeId?: string) {
    return this.db
      .prepare<unknown[], { pk: number; id: string; text: string; context_prefix: string }>(
        `SELECT pk, id, text, context_prefix FROM passages
         WHERE (embedding_model IS NULL OR embedding_model != ?) ${episodeId ? 'AND episode_id = ?' : ''}
         ORDER BY pk LIMIT ?`,
      )
      .all(...(episodeId ? [model, episodeId, limit] : [model, limit]))
      .map((r) => ({ pk: r.pk, id: r.id, text: r.text, contextPrefix: r.context_prefix }));
  }

  countNeedingEmbedding(model: string): { passages: number; tokens: number } {
    const row = this.db
      .prepare<[string], { n: number; t: number | null }>(
        `SELECT COUNT(*) AS n, SUM(token_count) AS t FROM passages
         WHERE embedding_model IS NULL OR embedding_model != ?`,
      )
      .get(model);
    return { passages: row?.n ?? 0, tokens: row?.t ?? 0 };
  }

  setEmbeddings(rows: { pk: number; embedding: Float32Array }[], model: string) {
    const del = this.db.prepare('DELETE FROM passages_vec WHERE passage_pk = ?');
    const ins = this.db.prepare('INSERT INTO passages_vec (passage_pk, embedding) VALUES (?, ?)');
    const mark = this.db.prepare('UPDATE passages SET embedding_model = ? WHERE pk = ?');
    this.db.transaction(() => {
      for (const r of rows) {
        if (r.embedding.length !== EMBEDDING_DIMENSIONS) {
          throw new Error(
            `Embedding has ${r.embedding.length} dimensions, expected ${EMBEDDING_DIMENSIONS}`,
          );
        }
        const key = BigInt(r.pk);
        del.run(key);
        ins.run(key, r.embedding);
        mark.run(model, r.pk);
      }
    })();
  }

  getPassagesByIds(ids: string[]): StoredPassage[] {
    if (ids.length === 0) return [];
    const rows = this.db
      .prepare<string[], PassageRow>(
        `SELECT * FROM passages WHERE id IN (${ids.map(() => '?').join(',')})`,
      )
      .all(...ids);
    return this.withEpisodes(rows);
  }

  getPassagesByPks(pks: number[]): StoredPassage[] {
    if (pks.length === 0) return [];
    const rows = this.db
      .prepare<number[], PassageRow>(
        `SELECT * FROM passages WHERE pk IN (${pks.map(() => '?').join(',')})`,
      )
      .all(...pks);
    return this.withEpisodes(rows);
  }

  getPassage(id: string): StoredPassage | null {
    return this.getPassagesByIds([id])[0] ?? null;
  }

  private withEpisodes(rows: PassageRow[]): StoredPassage[] {
    const cache = new Map<string, Episode | null>();
    const out: StoredPassage[] = [];
    for (const r of rows) {
      if (!cache.has(r.episode_id)) cache.set(r.episode_id, this.getEpisode(r.episode_id));
      const episode = cache.get(r.episode_id);
      if (episode) out.push({ ...toPassage(r), episode });
    }
    return out;
  }

  // ------------------------------------------------------------------------------- search

  /** Keyword search (BM25). Text is weighted over the context prefix. */
  ftsSearch(question: string, k: number): SearchHit[] {
    const query = toFtsQuery(question);
    if (!query) return [];
    return this.db
      .prepare<[string, number], { pk: number; id: string; episode_id: string; score: number }>(
        `SELECT p.pk, p.id, p.episode_id, bm25(passages_fts, 1.0, 0.35) AS score
         FROM passages_fts JOIN passages p ON p.pk = passages_fts.rowid
         WHERE passages_fts MATCH ? ORDER BY score LIMIT ?`,
      )
      .all(query, k)
      .map((r, i) => ({
        pk: r.pk,
        passageId: r.id,
        episodeId: r.episode_id,
        rank: i + 1,
        score: r.score,
      }));
  }

  /** Semantic search: brute-force cosine KNN over every embedded passage. */
  vectorSearch(embedding: Float32Array, k: number): SearchHit[] {
    const rows = this.db
      .prepare<[Float32Array, number], { passage_pk: number; distance: number }>(
        'SELECT passage_pk, distance FROM passages_vec WHERE embedding MATCH ? AND k = ? ORDER BY distance',
      )
      .all(embedding, k);
    if (rows.length === 0) return [];
    const meta = new Map(
      this.db
        .prepare<number[], { pk: number; id: string; episode_id: string }>(
          `SELECT pk, id, episode_id FROM passages WHERE pk IN (${rows.map(() => '?').join(',')})`,
        )
        .all(...rows.map((r) => r.passage_pk))
        .map((r) => [r.pk, r]),
    );
    return rows.flatMap((r, i) => {
      const m = meta.get(r.passage_pk);
      return m
        ? [
            {
              pk: r.passage_pk,
              passageId: m.id,
              episodeId: m.episode_id,
              rank: i + 1,
              score: r.distance,
            },
          ]
        : [];
    });
  }

  /**
   * Passages from *other* episodes nearest to a stored passage, by its own stored embedding: at most
   * one per episode, only vectors from the same embedding model, only within `maxDistance` (cosine).
   * Empty when the passage has no embedding. No model call.
   */
  similarPassages(
    passageId: string,
    options: { k: number; maxDistance: number; candidates: number },
  ): { passage: StoredPassage; distance: number }[] {
    const source = this.db
      .prepare<[string], { pk: number; episode_id: string; embedding_model: string | null }>(
        'SELECT pk, episode_id, embedding_model FROM passages WHERE id = ?',
      )
      .get(passageId);
    if (!source?.embedding_model) return [];
    const vector = this.db
      .prepare<[bigint], { embedding: Buffer }>(
        'SELECT embedding FROM passages_vec WHERE passage_pk = ?',
      )
      .get(BigInt(source.pk));
    if (!vector) return [];

    const near = this.db
      .prepare<[Buffer, number], { passage_pk: number; distance: number }>(
        'SELECT passage_pk, distance FROM passages_vec WHERE embedding MATCH ? AND k = ? ORDER BY distance',
      )
      .all(vector.embedding, Math.max(1, Math.floor(options.candidates)))
      .filter((r) => r.passage_pk !== source.pk && r.distance <= options.maxDistance);
    if (near.length === 0) return [];

    const meta = new Map(
      this.db
        .prepare<number[], { pk: number; episode_id: string; embedding_model: string | null }>(
          `SELECT pk, episode_id, embedding_model FROM passages WHERE pk IN (${near.map(() => '?').join(',')})`,
        )
        .all(...near.map((r) => r.passage_pk))
        .map((m) => [m.pk, m] as const),
    );
    const seen = new Set([source.episode_id]);
    const picked: { pk: number; distance: number }[] = [];
    for (const r of near) {
      const m = meta.get(r.passage_pk);
      if (!m || m.embedding_model !== source.embedding_model || seen.has(m.episode_id)) continue;
      seen.add(m.episode_id);
      picked.push({ pk: r.passage_pk, distance: r.distance });
      if (picked.length >= options.k) break;
    }
    const byPk = new Map(this.getPassagesByPks(picked.map((p) => p.pk)).map((p) => [p.pk, p]));
    return picked.flatMap((p) => {
      const passage = byPk.get(p.pk);
      return passage ? [{ passage, distance: p.distance }] : [];
    });
  }

  hasEmbeddings(): boolean {
    return Boolean(
      this.db.prepare('SELECT 1 FROM passages WHERE embedding_model IS NOT NULL LIMIT 1').get(),
    );
  }

  /** Every guest name in the knowledge base, for the fabricated-guest guard. */
  knownGuestNames(): string[] {
    const rows = this.db
      .prepare<[], { guest_names: string }>('SELECT guest_names FROM episodes')
      .all();
    const names = new Set<string>();
    for (const r of rows) for (const n of JSON.parse(r.guest_names) as string[]) names.add(n);
    return [...names];
  }

  // ------------------------------------------------------------------------------- status

  stats(): KnowledgeStats {
    const one = <T>(sql: string) => this.db.prepare<[], T>(sql).get() as T;
    return {
      episodes: one<{ n: number }>(
        'SELECT COUNT(*) AS n FROM episodes WHERE indexed_at IS NOT NULL',
      ).n,
      transcribedEpisodes: one<{ n: number }>(
        "SELECT COUNT(*) AS n FROM episodes WHERE transcript_status = 'fetched'",
      ).n,
      passages: one<{ n: number }>('SELECT COUNT(*) AS n FROM passages').n,
      embeddedPassages: one<{ n: number }>(
        'SELECT COUNT(*) AS n FROM passages WHERE embedding_model IS NOT NULL',
      ).n,
      diarizedEpisodes: one<{ n: number }>(
        "SELECT COUNT(*) AS n FROM episodes WHERE transcript_source = 'openai-diarize' AND indexed_at IS NOT NULL",
      ).n,
      youtubeLinkedEpisodes: one<{ n: number }>(
        'SELECT COUNT(*) AS n FROM episodes WHERE youtube_video_id IS NOT NULL AND indexed_at IS NOT NULL',
      ).n,
      lastIndexedAt: one<{ t: string | null }>('SELECT MAX(indexed_at) AS t FROM episodes').t,
    };
  }

  discoveredCount(): number {
    return this.db.prepare<[], { n: number }>('SELECT COUNT(*) AS n FROM episodes').get()?.n ?? 0;
  }

  // ------------------------------------------------------------------------- ingestion runs

  startRun(episodeId: string | null, stage: string, meta: Record<string, unknown> = {}): number {
    const r = this.db
      .prepare(
        'INSERT INTO ingestion_runs (episode_id, stage, status, started_at, meta) VALUES (?, ?, ?, ?, ?)',
      )
      .run(episodeId, stage, 'running', now(), JSON.stringify(meta));
    return Number(r.lastInsertRowid);
  }

  finishRun(
    runId: number,
    status: 'done' | 'failed' | 'skipped',
    extra: { error?: string; meta?: Record<string, unknown> } = {},
  ) {
    const prev = this.db
      .prepare<[number], { meta: string }>('SELECT meta FROM ingestion_runs WHERE id = ?')
      .get(runId);
    const meta = {
      ...(prev ? (JSON.parse(prev.meta) as Record<string, unknown>) : {}),
      ...extra.meta,
    };
    this.db
      .prepare(
        'UPDATE ingestion_runs SET status = ?, finished_at = ?, error = ?, meta = ? WHERE id = ?',
      )
      .run(status, now(), extra.error ?? null, JSON.stringify(meta), runId);
  }

  /** The latest run per (episode, stage). */
  latestRuns(): RunRow[] {
    return this.db
      .prepare<
        [],
        {
          id: number;
          episode_id: string | null;
          stage: string;
          status: RunRow['status'];
          started_at: string;
          finished_at: string | null;
          error: string | null;
          meta: string;
        }
      >(
        `SELECT r.* FROM ingestion_runs r
         JOIN (SELECT episode_id, stage, MAX(id) AS id FROM ingestion_runs GROUP BY episode_id, stage) latest
           ON latest.id = r.id
         ORDER BY r.id DESC`,
      )
      .all()
      .map((r) => ({
        id: r.id,
        episodeId: r.episode_id,
        stage: r.stage,
        status: r.status,
        startedAt: r.started_at,
        finishedAt: r.finished_at,
        error: r.error,
        meta: JSON.parse(r.meta) as Record<string, unknown>,
      }));
  }

  /** Total estimated spend recorded by paid stages. */
  spentUsd(): number {
    const rows = this.db
      .prepare<[], { meta: string }>("SELECT meta FROM ingestion_runs WHERE status = 'done'")
      .all();
    return rows.reduce(
      (sum, r) => sum + Number((JSON.parse(r.meta) as { costUsd?: number }).costUsd ?? 0),
      0,
    );
  }

  // ------------------------------------------------------------------------------ hygiene

  /** Removes an episode and everything derived from it (segments, passages, vectors, runs). */
  purgeEpisode(episodeId: string): boolean {
    const r = this.db.prepare('DELETE FROM episodes WHERE id = ?').run(episodeId);
    return r.changes > 0;
  }

  purgeAll() {
    this.db.transaction(() => {
      this.db.exec(
        'DELETE FROM ingestion_runs; DELETE FROM passages; DELETE FROM segments; DELETE FROM episodes;',
      );
    })();
    this.db.exec('VACUUM');
  }
}
