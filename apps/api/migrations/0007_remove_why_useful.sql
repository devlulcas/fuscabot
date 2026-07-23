DROP INDEX IF EXISTS resources_search_document_idx;

ALTER TABLE resources DROP COLUMN IF EXISTS search_document;
ALTER TABLE resources DROP COLUMN IF EXISTS why_useful;

ALTER TABLE resources
  ADD COLUMN search_document tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(source_domain, '') || ' ' || coalesce(original_url, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(description, '') || ' ' || coalesce(summary, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(personal_note, '') || ' ' || coalesce(selected_quote, '')), 'D')
  ) STORED;

CREATE INDEX resources_search_document_idx
  ON resources USING gin(search_document);
