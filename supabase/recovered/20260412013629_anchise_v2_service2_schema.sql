-- Anchise v2 Service 2 schema additions.
-- Aligned with ANCHISE-LOCK-2026-04-11 + AMENDMENT-2026-04-12 + locks from this session.
-- See consolidated architecture document for the full data flow.

-- ============================================================================
-- 1. Recovered accounts - per-case, per-platform, labelled with the canonical
--    source_label format.
-- ============================================================================

create table if not exists anchise_v2.recovered_accounts (
  id                 bigserial primary key,
  case_id            bigint not null references anchise_v2.cases(id) on delete cascade,
  source_label       text not null,
  -- e.g. '18837_sophie_dupont_gmail_1_roby.bianchi@gmail.com'
  source_separator   text not null default '_'
    check (source_separator in ('_', '::', '==', '|||')),
  anchise_account    text not null,
  platform           text not null,
  platform_index     int not null,
  login_identifier   text not null,
  survey_counts      jsonb not null default '{}'::jsonb,
  -- { items_total, bytes_total, media_count, message_count, doc_count, date_range: {start, end} }
  survey_completed_at timestamptz,
  created_at         timestamptz not null default now(),
  unique (case_id, source_label)
);
create index if not exists idx_recovered_accounts_case
  on anchise_v2.recovered_accounts(case_id);
create index if not exists idx_recovered_accounts_platform
  on anchise_v2.recovered_accounts(case_id, platform);

-- ============================================================================
-- 2. Sieve batches - 20 GB raw-pull batches per case. Each batch has a working
--    slot that is released when all non-NSFW items have been archived locally.
-- ============================================================================

create table if not exists anchise_v2.sieve_batches (
  id                 bigserial primary key,
  case_id            bigint not null references anchise_v2.cases(id) on delete cascade,
  batch_kind         text not null check (batch_kind in ('phase_a_live', 'phase_b_takeout')),
  ordinal            int not null,
  -- 1 = first batch, 2 = second, ...
  status             text not null default 'allocating'
    check (status in (
      'allocating',     -- companion deciding which items go in this batch
      'downloading',    -- pulling from cloud / takeout archive
      'classifying',    -- local classification running
      'uploading',      -- uploading non-NSFW to vault, NSFW as ciphertext
      'archiving',      -- copying non-NSFW to Sophie's local archive
      'complete',       -- working slot released, local archive updated
      'failed'
    )),
  bytes_planned      bigint,       -- 20 GB target (20 * 1024^3)
  bytes_downloaded   bigint default 0,
  bytes_classified   bigint default 0,
  bytes_uploaded     bigint default 0,
  items_count        int default 0,
  items_nsfw_count   int default 0,
  items_non_nsfw_count int default 0,
  started_at         timestamptz not null default now(),
  completed_at       timestamptz,
  error              text,
  unique (case_id, batch_kind, ordinal)
);
create index if not exists idx_sieve_batches_case on anchise_v2.sieve_batches(case_id, status);

-- ============================================================================
-- 3. Items - the core content unit. Every piece of content Sophie's vault holds.
--    Shared across Service 1 (credentials are a degenerate item type) and Service 2.
-- ============================================================================

create table if not exists anchise_v2.items (
  id                      bigserial primary key,
  uuid                    uuid not null default gen_random_uuid() unique,
  case_id                 bigint not null references anchise_v2.cases(id) on delete cascade,
  recovered_account_id    bigint references anchise_v2.recovered_accounts(id) on delete cascade,
  sieve_batch_id          bigint references anchise_v2.sieve_batches(id) on delete set null,

  -- Self-describing source label (canonical provenance). Never parsed at runtime;
  -- extracted into the columns below for filtering and grouping.
  source_label            text not null,
  source_separator        text not null default '_',
  source_borniol_case     text not null,   -- e.g. '18837'
  source_anchise_account  text not null,   -- e.g. 'sophie_dupont'
  source_platform         text not null,   -- e.g. 'gmail'
  source_index            int not null,    -- 1, 2, 3...
  source_login            text not null,   -- 'roby.bianchi@gmail.com'

  -- Content facts (L0)
  content_hash            text,            -- sha256 of plaintext (for dedup and NSFW traceability)
  mime_type               text not null,
  byte_size               bigint,
  original_at             timestamptz,     -- when the content was created on the source platform
  language                text,            -- cld3-detected
  has_location            boolean default false,

  -- Vault storage
  storage_path            text,            -- supabase storage object key (plaintext for non-NSFW, ciphertext for NSFW)
  is_nsfw                 boolean not null default false,
  nsfw_iv                 bytea,           -- AES-GCM IV (only for NSFW)
  nsfw_gcm_tag            bytea,           -- AES-GCM auth tag (only for NSFW)

  -- Presentation
  title                   text,
  summary                 text,

  -- Classification pipeline state
  triage_stage_reached    text not null default 'stage_0_dedup' check (triage_stage_reached in (
    'stage_0_dedup','stage_1_l0','stage_2_metadata','stage_3_nsfw',
    'stage_4_junk','stage_5_full_tree','stage_6_flagged','committed'
  )),
  triage_confidence       numeric(3,2),
  triage_model            text,            -- 'heuristic' | 'nsfwjs' | 'llama_8b' | 'haiku-4.5' | 'founder'
  triage_reasoning        text,
  suggested_tags          jsonb not null default '{}'::jsonb,
  -- Layer 1 ML output preserved for founder / owner review

  -- Governance
  memorial_only_data      boolean not null default true,
  archived_to_local_at    timestamptz,     -- when the companion copied this item to Sophie's local archive

  -- Source metadata (Google Takeout JSON sidecars, Gmail MBOX headers, etc.)
  source_metadata         jsonb not null default '{}'::jsonb,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  -- Dedup: same content in the same case stored only once
  unique (case_id, content_hash)
);
create index if not exists idx_items_case on anchise_v2.items(case_id);
create index if not exists idx_items_platform on anchise_v2.items(case_id, source_platform);
create index if not exists idx_items_nsfw on anchise_v2.items(case_id, is_nsfw);
create index if not exists idx_items_batch on anchise_v2.items(sieve_batch_id);
create index if not exists idx_items_stage on anchise_v2.items(case_id, triage_stage_reached);

-- Enforce: items with a case_id must have memorial_only_data = true
create or replace function anchise_v2.enforce_memorial_only_data()
returns trigger as $$
begin
  if new.case_id is not null and new.memorial_only_data = false then
    raise exception 'items with a case_id must have memorial_only_data = true';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists items_memorial_only_data_check on anchise_v2.items;
create trigger items_memorial_only_data_check
  before insert or update on anchise_v2.items
  for each row execute function anchise_v2.enforce_memorial_only_data();

-- ============================================================================
-- 4. Item tags - multi-dimensional facets for the tree browser.
--    Each (item, dimension, value) is a row. Multi-dimensional by design.
-- ============================================================================

create table if not exists anchise_v2.item_tags (
  item_id     bigint not null references anchise_v2.items(id) on delete cascade,
  dimension   text not null,
  -- 'content_type' (L1) | 'centrality' (L2) | 'junk' (L2 MESSAGES) |
  -- 'authorship' (L2 SOCIALMEDIAPOSTING) | 'contact_kind' (L2 CONTACTS) |
  -- 'legal_domain' (L2 LEGALLYRELEVANT) | 'platform' (L3) | 'year' (L4) |
  -- 'institution' (L3 FINANCIAL) | 'provider' (L3 MEDICAL) | 'subtype' (L3 LEGAL) |
  -- 'personal' (L3 owner-added) | 'sensitive_kind' (cross-cutting)
  value       text not null,
  confidence  numeric(3,2) not null default 1.00,
  source      text not null check (source in (
    'layer0_extract','layer1_ai_local','layer1_ai_server_haiku',
    'layer2_founder','layer3_owner'
  )),
  created_at  timestamptz not null default now(),
  primary key (item_id, dimension, value)
);
create index if not exists idx_item_tags_dimension_value
  on anchise_v2.item_tags(dimension, value);
create index if not exists idx_item_tags_value
  on anchise_v2.item_tags(value);

-- ============================================================================
-- 5. Owner commitments - NSFW deletion at T+12mo and any future clauses.
-- ============================================================================

create table if not exists anchise_v2.owner_commitments (
  id                     bigserial primary key,
  case_id                bigint not null references anchise_v2.cases(id) on delete cascade,
  owner_id               bigint not null references anchise_v2.heirs(id) on delete cascade,
  commitment_kind        text not null check (commitment_kind in ('nsfw_deletion_at_12mo')),
  commitment_copy        text not null,
  scheduled_execution_at timestamptz not null,
  executed_at            timestamptz,
  executed_by            text,
  created_at             timestamptz not null default now(),
  unique (case_id, commitment_kind)
);
create index if not exists idx_owner_commitments_due
  on anchise_v2.owner_commitments(scheduled_execution_at)
  where executed_at is null;

-- ============================================================================
-- 6. Companion tokens - short-lived signed tokens the web app mints for the
--    companion to use for uploads. Companion has no identity; the token IS its
--    authorisation for a specific case + operation.
-- ============================================================================

create table if not exists anchise_v2.companion_tokens (
  id              bigserial primary key,
  case_id         bigint not null references anchise_v2.cases(id) on delete cascade,
  owner_id        bigint not null references anchise_v2.heirs(id) on delete cascade,
  token_hash      text not null unique,
  purpose         text not null check (purpose in (
    'survey','sieve_batch','ingest_item','batch_complete','classify_request'
  )),
  sieve_batch_id  bigint references anchise_v2.sieve_batches(id) on delete cascade,
  expires_at      timestamptz not null,
  used_at         timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists idx_companion_tokens_case
  on anchise_v2.companion_tokens(case_id, purpose);
create index if not exists idx_companion_tokens_expires
  on anchise_v2.companion_tokens(expires_at)
  where used_at is null;

-- ============================================================================
-- 7. Append-only enforcement for audit_log (tighten the existing table)
-- ============================================================================

create or replace function anchise_v2.reject_audit_mutation()
returns trigger as $$ begin raise exception 'audit_log is append-only'; end; $$ language plpgsql;

drop trigger if exists audit_log_no_update on anchise_v2.audit_log;
create trigger audit_log_no_update before update on anchise_v2.audit_log
  for each row execute function anchise_v2.reject_audit_mutation();

drop trigger if exists audit_log_no_delete on anchise_v2.audit_log;
create trigger audit_log_no_delete before delete on anchise_v2.audit_log
  for each row execute function anchise_v2.reject_audit_mutation();

-- ============================================================================
-- 8. Health views for the /founder/health dashboard and Grafana - extended
-- ============================================================================

create or replace view anchise_v2.v_items_by_platform as
select source_platform, count(*)::int as n, coalesce(sum(byte_size), 0)::bigint as bytes
from anchise_v2.items
group by source_platform
order by n desc;

create or replace view anchise_v2.v_items_by_l1 as
select t.value as l1, count(distinct i.id)::int as n
from anchise_v2.items i
join anchise_v2.item_tags t on t.item_id = i.id and t.dimension = 'content_type'
group by t.value
order by n desc;

create or replace view anchise_v2.v_sieve_batches_summary as
select
  case_id,
  count(*)::int as total_batches,
  count(*) filter (where status = 'complete')::int as complete_batches,
  count(*) filter (where status = 'failed')::int as failed_batches,
  coalesce(sum(bytes_uploaded), 0)::bigint as total_bytes_processed,
  coalesce(sum(items_count), 0)::int as total_items_processed,
  coalesce(sum(items_nsfw_count), 0)::int as total_nsfw_items
from anchise_v2.sieve_batches
group by case_id;

grant select on anchise_v2.v_items_by_platform,
               anchise_v2.v_items_by_l1,
               anchise_v2.v_sieve_batches_summary
  to anchise_grafana;
