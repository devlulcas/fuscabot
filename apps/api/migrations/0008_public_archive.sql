UPDATE resources
SET archived_at = NULL, updated_at = now()
WHERE archived_at IS NOT NULL;

ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS public_slug text,
  ADD COLUMN IF NOT EXISTS public_published_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS resources_public_slug_uidx
  ON resources(public_slug)
  WHERE public_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS resources_public_published_idx
  ON resources(public_published_at DESC, id)
  WHERE public_published_at IS NOT NULL;

ALTER TABLE resources DROP COLUMN IF EXISTS archived_at;

ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS public_search_document tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(summary, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(source_domain, '') || ' ' ||
      coalesce(selected_quote, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS resources_public_search_document_idx
  ON resources USING gin(public_search_document)
  WHERE public_published_at IS NOT NULL;
