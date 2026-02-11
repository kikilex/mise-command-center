-- Book Builder tables + document word count
-- Date: 2026-02-10

BEGIN;

-- Add word_count to documents (if missing)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS word_count INTEGER DEFAULT 0;

-- Books table
CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  author TEXT,
  target_word_count INTEGER,
  current_word_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'planning',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  include_toc BOOLEAN DEFAULT true,
  include_title_page BOOLEAN DEFAULT true,
  include_copyright BOOLEAN DEFAULT true,
  trim_size TEXT DEFAULT '6x9',
  font_family TEXT DEFAULT 'serif',
  UNIQUE(project_id)
);

CREATE INDEX IF NOT EXISTS idx_books_project ON books(project_id);

-- Parts table
CREATE TABLE IF NOT EXISTS book_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  part_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_book_parts_book ON book_parts(book_id);

-- Chapters table
CREATE TABLE IF NOT EXISTS book_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID REFERENCES books(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  part_id UUID REFERENCES book_parts(id) ON DELETE SET NULL,
  chapter_number INTEGER,
  chapter_order INTEGER NOT NULL,
  chapter_type TEXT DEFAULT 'chapter',
  synopsis TEXT,
  notes TEXT,
  pov_character TEXT,
  setting TEXT,
  status TEXT DEFAULT 'idea',
  target_word_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_book_chapters_book ON book_chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_book_chapters_document ON book_chapters(document_id);
CREATE INDEX IF NOT EXISTS idx_book_chapters_part ON book_chapters(part_id);

-- RLS
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_chapters ENABLE ROW LEVEL SECURITY;

-- Policies: books
DROP POLICY IF EXISTS "Books select" ON books;
DROP POLICY IF EXISTS "Books insert" ON books;
DROP POLICY IF EXISTS "Books update" ON books;
DROP POLICY IF EXISTS "Books delete" ON books;

CREATE POLICY "Books select" ON books FOR SELECT
USING (project_id IN (SELECT get_user_project_ids(auth.uid())));

CREATE POLICY "Books insert" ON books FOR INSERT
WITH CHECK (project_id IN (SELECT get_user_project_ids(auth.uid())));

CREATE POLICY "Books update" ON books FOR UPDATE
USING (project_id IN (SELECT get_user_project_ids(auth.uid())));

CREATE POLICY "Books delete" ON books FOR DELETE
USING (
  project_id IN (
    SELECT pm.project_id FROM project_members pm
    WHERE pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin')
  )
);

-- Policies: book_parts
DROP POLICY IF EXISTS "Book parts select" ON book_parts;
DROP POLICY IF EXISTS "Book parts insert" ON book_parts;
DROP POLICY IF EXISTS "Book parts update" ON book_parts;
DROP POLICY IF EXISTS "Book parts delete" ON book_parts;

CREATE POLICY "Book parts select" ON book_parts FOR SELECT
USING (
  book_id IN (
    SELECT b.id FROM books b
    WHERE b.project_id IN (SELECT get_user_project_ids(auth.uid()))
  )
);

CREATE POLICY "Book parts insert" ON book_parts FOR INSERT
WITH CHECK (
  book_id IN (
    SELECT b.id FROM books b
    WHERE b.project_id IN (SELECT get_user_project_ids(auth.uid()))
  )
);

CREATE POLICY "Book parts update" ON book_parts FOR UPDATE
USING (
  book_id IN (
    SELECT b.id FROM books b
    WHERE b.project_id IN (SELECT get_user_project_ids(auth.uid()))
  )
);

CREATE POLICY "Book parts delete" ON book_parts FOR DELETE
USING (
  book_id IN (
    SELECT b.id FROM books b
    WHERE b.project_id IN (
      SELECT pm.project_id FROM project_members pm
      WHERE pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin')
    )
  )
);

-- Policies: book_chapters
DROP POLICY IF EXISTS "Book chapters select" ON book_chapters;
DROP POLICY IF EXISTS "Book chapters insert" ON book_chapters;
DROP POLICY IF EXISTS "Book chapters update" ON book_chapters;
DROP POLICY IF EXISTS "Book chapters delete" ON book_chapters;

CREATE POLICY "Book chapters select" ON book_chapters FOR SELECT
USING (
  book_id IN (
    SELECT b.id FROM books b
    WHERE b.project_id IN (SELECT get_user_project_ids(auth.uid()))
  )
);

CREATE POLICY "Book chapters insert" ON book_chapters FOR INSERT
WITH CHECK (
  book_id IN (
    SELECT b.id FROM books b
    WHERE b.project_id IN (SELECT get_user_project_ids(auth.uid()))
  )
);

CREATE POLICY "Book chapters update" ON book_chapters FOR UPDATE
USING (
  book_id IN (
    SELECT b.id FROM books b
    WHERE b.project_id IN (SELECT get_user_project_ids(auth.uid()))
  )
);

CREATE POLICY "Book chapters delete" ON book_chapters FOR DELETE
USING (
  book_id IN (
    SELECT b.id FROM books b
    WHERE b.project_id IN (
      SELECT pm.project_id FROM project_members pm
      WHERE pm.user_id = auth.uid() AND pm.role IN ('owner', 'admin')
    )
  )
);

COMMIT;
