ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS search_document tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(source_domain, '') || ' ' || coalesce(original_url, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(why_useful, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(personal_note, '') || ' ' || coalesce(selected_quote, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS resources_search_document_idx
  ON resources USING gin(search_document);
