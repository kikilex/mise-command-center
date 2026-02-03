-- Add doc_type to documents
-- Date: 2026-02-03

BEGIN;

ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS doc_type TEXT DEFAULT 'document' 
CHECK (doc_type IN ('document', 'note'));

CREATE INDEX IF NOT EXISTS idx_documents_doc_type ON documents(doc_type);

COMMIT;
