-- Public company slug for /c/[slug] profile pages
ALTER TABLE companies ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS public_profile boolean NOT NULL DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS public_tagline text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS public_services text[];

-- Unique index on slug (when set)
CREATE UNIQUE INDEX IF NOT EXISTS companies_slug_unique ON companies (slug) WHERE slug IS NOT NULL;
