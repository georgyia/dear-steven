import { EMBEDDING_DIMENSIONS } from '../config/models.ts';

/**
 * Schema migrations, applied in order and tracked with `PRAGMA user_version`. Never edit a shipped
 * migration — append a new one. Plain tables are ordinary SQL; `passages_fts` (FTS5, external
 * content) and `passages_vec` (sqlite-vec) are virtual tables kept in sync by triggers.
 */
export const MIGRATIONS: readonly string[] = [
  // 1 — initial schema (docs/ARCHITECTURE.md §6)
  `
  CREATE TABLE kb_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE episodes (
    id                  TEXT PRIMARY KEY,
    source_guid         TEXT NOT NULL UNIQUE,
    title               TEXT NOT NULL,
    description         TEXT NOT NULL DEFAULT '',
    published_at        TEXT NOT NULL,
    duration_ms         INTEGER,
    episode_type        TEXT NOT NULL CHECK (episode_type IN ('full', 'bonus', 'trailer')),
    guest_names         TEXT NOT NULL DEFAULT '[]',
    guest_source        TEXT NOT NULL DEFAULT 'title' CHECK (guest_source IN ('title', 'llm', 'manual')),
    audio_url           TEXT,
    transcript_url      TEXT,
    transcript_source   TEXT CHECK (transcript_source IN ('rss-vtt', 'openai-diarize', 'manual')),
    transcript_status   TEXT NOT NULL DEFAULT 'none' CHECK (transcript_status IN ('none', 'fetched', 'failed')),
    youtube_video_id    TEXT,
    youtube_duration_ms INTEGER,
    youtube_offset_ms   INTEGER NOT NULL DEFAULT 0,
    youtube_alignment   TEXT NOT NULL DEFAULT 'unknown' CHECK (youtube_alignment IN ('exact', 'estimated', 'unknown')),
    summary             TEXT,
    indexed_at          TEXT,
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX episodes_published ON episodes (published_at DESC);

  CREATE TABLE segments (
    episode_id             TEXT NOT NULL REFERENCES episodes (id) ON DELETE CASCADE,
    idx                    INTEGER NOT NULL,
    start_ms               INTEGER NOT NULL,
    end_ms                 INTEGER NOT NULL,
    speaker                TEXT NOT NULL CHECK (speaker IN ('host', 'guest', 'unknown')),
    speaker_name           TEXT,
    attribution_method     TEXT NOT NULL CHECK (attribution_method IN ('diarization', 'manual', 'none')),
    attribution_confidence REAL,
    text                   TEXT NOT NULL,
    PRIMARY KEY (episode_id, idx)
  ) WITHOUT ROWID;

  CREATE TABLE passages (
    pk                INTEGER PRIMARY KEY,
    id                TEXT NOT NULL UNIQUE,
    episode_id        TEXT NOT NULL REFERENCES episodes (id) ON DELETE CASCADE,
    idx               INTEGER NOT NULL,
    start_ms          INTEGER NOT NULL,
    end_ms            INTEGER NOT NULL,
    segment_start_idx INTEGER NOT NULL,
    segment_end_idx   INTEGER NOT NULL,
    text              TEXT NOT NULL,
    context_prefix    TEXT NOT NULL,
    speakers_present  TEXT NOT NULL CHECK (speakers_present IN ('host', 'guest', 'mixed', 'unknown')),
    token_count       INTEGER NOT NULL,
    embedding_model   TEXT,
    UNIQUE (episode_id, idx)
  );

  CREATE VIRTUAL TABLE passages_fts USING fts5 (
    text,
    context_prefix,
    content = 'passages',
    content_rowid = 'pk',
    tokenize = 'porter unicode61 remove_diacritics 2'
  );

  CREATE VIRTUAL TABLE passages_vec USING vec0 (
    passage_pk INTEGER PRIMARY KEY,
    embedding  float[${EMBEDDING_DIMENSIONS}] distance_metric=cosine
  );

  CREATE TRIGGER passages_after_insert AFTER INSERT ON passages BEGIN
    INSERT INTO passages_fts (rowid, text, context_prefix) VALUES (new.pk, new.text, new.context_prefix);
  END;
  CREATE TRIGGER passages_after_delete AFTER DELETE ON passages BEGIN
    INSERT INTO passages_fts (passages_fts, rowid, text, context_prefix)
      VALUES ('delete', old.pk, old.text, old.context_prefix);
    DELETE FROM passages_vec WHERE passage_pk = old.pk;
  END;
  CREATE TRIGGER passages_after_update AFTER UPDATE OF text, context_prefix ON passages BEGIN
    INSERT INTO passages_fts (passages_fts, rowid, text, context_prefix)
      VALUES ('delete', old.pk, old.text, old.context_prefix);
    INSERT INTO passages_fts (rowid, text, context_prefix) VALUES (new.pk, new.text, new.context_prefix);
  END;

  CREATE TABLE ingestion_runs (
    id          INTEGER PRIMARY KEY,
    episode_id  TEXT REFERENCES episodes (id) ON DELETE CASCADE,
    stage       TEXT NOT NULL,
    status      TEXT NOT NULL CHECK (status IN ('running', 'done', 'failed', 'skipped')),
    started_at  TEXT NOT NULL,
    finished_at TEXT,
    error       TEXT,
    meta        TEXT NOT NULL DEFAULT '{}'
  );
  CREATE INDEX ingestion_runs_episode ON ingestion_runs (episode_id, stage, id DESC);
  `,
  // 2 — offsets that change mid-episode (P6-15): JSON array of { fromMs, offsetMs }
  `
  ALTER TABLE episodes ADD COLUMN youtube_offset_steps TEXT NOT NULL DEFAULT '[]';
  `,
];
