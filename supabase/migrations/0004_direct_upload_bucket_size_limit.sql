-- Enforces the 15MB upload cap at the Supabase Storage layer itself, not just
-- in application code. Needed now that large files are uploaded directly from
-- the browser to Storage via a signed upload URL (bypassing our API routes
-- entirely, to stay under Vercel's serverless request body limit) — a client
-- that lies about size in the prepare-upload request would otherwise be able
-- to write an arbitrarily large object straight past our own size check.
update storage.buckets set file_size_limit = 15728640 where id = 'documents';
