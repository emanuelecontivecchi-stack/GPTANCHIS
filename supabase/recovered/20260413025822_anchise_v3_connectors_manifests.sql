-- Anchise V3: connector state machine + import manifests
-- Implements V1 Build Guide section 5.2 connector states + section 5.3 import batch lifecycle
-- + Appendix A shared connector model

-- ============================================================================
-- 1. Connectors - per-account state machine
-- Each recovered_account gets a connector row tracking its lifecycle.
-- ============================================================================

alter table anchise_v2.recovered_accounts
  add column if not exists connector_state text not null default 'not_connected'
    check (connector_state in (
      'not_connected',       -- source in registry, no session
      'connected',           -- authenticated session active
      'inventorying',        -- scanning categories + counts
      'inventory_ready',     -- counts available, user can choose categories
      'download_pending',    -- user selected categories, queued for import
      'downloading',         -- agent actively pulling content
      'uploaded',            -- raw batches in Anchise cloud
      'organization_pending',-- content available but not yet organized
      'organized',           -- content classified and browsable
      'delete_eligible',     -- import verified, source deletion safe
      'delete_requested',    -- user requested source deletion
      'deleted',             -- source-side deletion confirmed
      'error'                -- something failed, needs attention
    )),
  add column if not exists connector_error text,
  add column if not exists inventory_at timestamptz,
  add column if not exists categories_selected jsonb,
  -- e.g. ["MEDIA","MESSAGES","CONTACTS","LEGALLYRELEVANT"]
  add column if not exists import_mode text check (import_mode in ('full', 'incremental')),
  add column if not exists delete_support text not null default 'download_only'
    check (delete_support in (
      'direct_delete',        -- platform API supports selective deletion
      'deletion_request',     -- platform accepts a deletion request (async)
      'account_deletion_only',-- only full account closure, no selective delete
      'download_only'         -- no deletion capability at all
    )),
  add column if not exists delete_requested_at timestamptz,
  add column if not exists delete_confirmed_at timestamptz,
  add column if not exists extraction_strategy text not null default 'browser'
    check (extraction_strategy in ('api', 'browser', 'export', 'physical', 'local'));

-- ============================================================================
-- 2. Connector inventory - per-category counts before download
-- ============================================================================

create table if not exists anchise_v2.connector_inventory (
  id                  bigserial primary key,
  recovered_account_id bigint not null references anchise_v2.recovered_accounts(id) on delete cascade,
  category            text not null,
  -- matches L1 taxonomy: MEDIA, MESSAGES, SOCIALMEDIAPOSTING, DOCUMENTS, CONTACTS, LEGALLYRELEVANT
  item_count_estimate int,
  byte_size_estimate  bigint,
  supports_incremental boolean not null default false,
  supports_delete     boolean not null default false,
  date_range_start    text,
  date_range_end      text,
  notes               text,
  scanned_at          timestamptz not null default now(),
  unique (recovered_account_id, category)
);
create index if not exists idx_connector_inventory_account
  on anchise_v2.connector_inventory(recovered_account_id);

-- ============================================================================
-- 3. Import manifests - per-batch verification
-- ============================================================================

create table if not exists anchise_v2.import_manifests (
  id               bigserial primary key,
  sieve_batch_id   bigint not null references anchise_v2.sieve_batches(id) on delete cascade,
  recovered_account_id bigint not null references anchise_v2.recovered_accounts(id) on delete cascade,
  category         text not null,
  items_expected   int not null default 0,
  items_received   int not null default 0,
  bytes_expected   bigint not null default 0,
  bytes_received   bigint not null default 0,
  status           text not null default 'pending'
    check (status in ('pending', 'in_progress', 'complete', 'incomplete', 'failed')),
  verification_at  timestamptz,
  error            text,
  created_at       timestamptz not null default now(),
  unique (sieve_batch_id, recovered_account_id, category)
);
create index if not exists idx_import_manifests_batch
  on anchise_v2.import_manifests(sieve_batch_id);

-- ============================================================================
-- 4. Connector state change log (separate from audit_log for fast querying)
-- ============================================================================

create table if not exists anchise_v2.connector_events (
  id                  bigserial primary key,
  recovered_account_id bigint not null references anchise_v2.recovered_accounts(id) on delete cascade,
  from_state          text not null,
  to_state            text not null,
  trigger             text,  -- 'user_login', 'inventory_scan', 'download_start', 'upload_complete', 'delete_request', etc.
  details             jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists idx_connector_events_account
  on anchise_v2.connector_events(recovered_account_id);

-- ============================================================================
-- 5. Health views for connectors
-- ============================================================================

create or replace view anchise_v2.v_connectors_by_state as
select connector_state, count(*)::int as n
from anchise_v2.recovered_accounts
group by connector_state
order by n desc;

create or replace view anchise_v2.v_connectors_by_platform as
select platform, connector_state, count(*)::int as n
from anchise_v2.recovered_accounts
group by platform, connector_state
order by platform, connector_state;

grant select on anchise_v2.v_connectors_by_state,
               anchise_v2.v_connectors_by_platform
  to anchise_grafana;
