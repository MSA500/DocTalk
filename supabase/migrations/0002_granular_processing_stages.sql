-- Widens documents.status to the granular pipeline stages introduced
-- alongside the two-request upload/process split (see
-- app/api/documents/upload and app/api/documents/[id]/process):
--   uploading -> extracting -> embedding -> ready (or failed at any step)
-- 'indexing' (the old, coarser stage covering both extraction and
-- embedding) is dropped in favor of the two more specific values.
--
-- Required if you ran 0001_init.sql before this migration existed — the
-- original check constraint only allowed
-- ('uploading', 'indexing', 'ready', 'failed'), which silently rejects any
-- write using 'extracting'/'embedding' with a 23514 check-constraint error.

alter table documents drop constraint if exists documents_status_check;

alter table documents add constraint documents_status_check
  check (status in ('uploading', 'extracting', 'embedding', 'ready', 'failed'));

update documents set status = 'extracting' where status = 'indexing';
