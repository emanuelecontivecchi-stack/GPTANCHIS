-- Anchise control-plane V1
-- Clean schema path in the existing Supabase project.
-- Inventory-first, incremental-first, dedup-first.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists anchise_control_v1;

create table if not exists anchise_control_v1.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  plan_state text not null default 'trial'
    check (plan_state in ('trial', 'active', 'limited')),
  agent_state text not null default 'not_installed'
    check (agent_state in ('not_installed', 'paired', 'action_needed')),
  storage_capacity_bytes bigint not null,
  storage_used_bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists anchise_control_v1.connectors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references anchise_control_v1.workspaces(id) on delete cascade,
  platform text not null,
  account_label text not null,
  surface text not null
    check (surface in ('browser_account', 'local_folder')),
  state text not null default 'not_connected'
    check (state in (
      'not_connected',
      'connected',
      'inventorying',
      'inventory_ready',
      'download_pending',
      'downloading',
      'uploaded',
      'organization_pending',
      'organized',
      'delete_eligible',
      'delete_requested',
      'deleted',
      'action_needed',
      'error'
    )),
  extraction_strategy text not null default 'browser'
    check (extraction_strategy in ('api', 'browser', 'export', 'physical', 'local')),
  delete_capability text not null default 'download_only'
    check (delete_capability in (
      'direct_delete',
      'deletion_request',
      'account_deletion_only',
      'download_only'
    )),
  last_inventory_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, platform, account_label)
);

create index if not exists idx_control_connectors_workspace
  on anchise_control_v1.connectors(workspace_id, state);

create table if not exists anchise_control_v1.inventory_snapshots (
  id uuid primary key default gen_random_uuid(),
  connector_id uuid not null references anchise_control_v1.connectors(id) on delete cascade,
  status text not null default 'ready'
    check (status in ('running', 'ready', 'superseded', 'failed')),
  source_bytes_estimate bigint,
  net_new_bytes_estimate bigint,
  existing_anchise_bytes_estimate bigint not null default 0,
  available_anchise_bytes bigint,
  fit_state text not null default 'unknown'
    check (fit_state in ('fits', 'likely_exceeds', 'exceeds', 'unknown')),
  space_warning boolean not null default false,
  generated_at timestamptz not null default now(),
  superseded_at timestamptz
);

create index if not exists idx_control_inventory_connector
  on anchise_control_v1.inventory_snapshots(connector_id, generated_at desc);

create table if not exists anchise_control_v1.inventory_categories (
  snapshot_id uuid not null references anchise_control_v1.inventory_snapshots(id) on delete cascade,
  category text not null
    check (category in ('photos', 'mail', 'files', 'contacts', 'geolocation')),
  item_count_estimate int,
  bytes_estimate bigint,
  duplicate_bytes_estimate bigint not null default 0,
  import_supported boolean not null default true,
  incremental_supported boolean not null default true,
  date_range_start timestamptz,
  date_range_end timestamptz,
  created_at timestamptz not null default now(),
  primary key (snapshot_id, category)
);

create table if not exists anchise_control_v1.import_plans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references anchise_control_v1.workspaces(id) on delete cascade,
  connector_id uuid not null references anchise_control_v1.connectors(id) on delete cascade,
  snapshot_id uuid not null references anchise_control_v1.inventory_snapshots(id) on delete restrict,
  mode text not null default 'incremental'
    check (mode in ('incremental')),
  source_action text not null default 'download_only'
    check (source_action in ('download_only', 'download_and_delete_source')),
  selected_categories jsonb not null default '[]'::jsonb,
  source_bytes_estimate bigint,
  net_new_bytes_estimate bigint,
  available_anchise_bytes bigint,
  fit_state text not null default 'unknown'
    check (fit_state in ('fits', 'likely_exceeds', 'exceeds', 'unknown')),
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'running', 'completed', 'cancelled', 'failed')),
  requested_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index if not exists idx_control_import_plans_connector
  on anchise_control_v1.import_plans(connector_id, status);

create table if not exists anchise_control_v1.import_batches (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references anchise_control_v1.import_plans(id) on delete cascade,
  connector_id uuid not null references anchise_control_v1.connectors(id) on delete cascade,
  ordinal int not null,
  status text not null default 'queued'
    check (status in (
      'queued',
      'preparing',
      'extracting',
      'staging',
      'uploading',
      'manifest_committing',
      'uploaded',
      'verified',
      'organization_pending',
      'done',
      'failed'
    )),
  items_expected int not null default 0,
  items_received int not null default 0,
  bytes_planned bigint not null default 0,
  bytes_downloaded bigint not null default 0,
  bytes_uploaded bigint not null default 0,
  dedup_hits int not null default 0,
  dedup_bytes_skipped bigint not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error text,
  unique (plan_id, ordinal)
);

create index if not exists idx_control_import_batches_plan
  on anchise_control_v1.import_batches(plan_id, status);

create table if not exists anchise_control_v1.object_manifests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references anchise_control_v1.workspaces(id) on delete cascade,
  connector_id uuid not null references anchise_control_v1.connectors(id) on delete cascade,
  batch_id uuid not null references anchise_control_v1.import_batches(id) on delete cascade,
  category text not null
    check (category in ('photos', 'mail', 'files', 'contacts', 'geolocation')),
  object_count int not null default 0,
  chunk_count int not null default 0,
  bytes_plain_estimate bigint not null default 0,
  bytes_stored bigint not null default 0,
  bytes_skipped_dedup bigint not null default 0,
  integrity_state text not null default 'pending'
    check (integrity_state in ('pending', 'verified', 'failed')),
  verification_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (batch_id, category)
);

create table if not exists anchise_control_v1.stored_objects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references anchise_control_v1.workspaces(id) on delete cascade,
  connector_id uuid not null references anchise_control_v1.connectors(id) on delete cascade,
  batch_id uuid references anchise_control_v1.import_batches(id) on delete set null,
  manifest_id uuid references anchise_control_v1.object_manifests(id) on delete set null,
  content_hash text not null,
  storage_path text not null,
  byte_size bigint,
  stored_byte_size bigint,
  mime_type text not null,
  lane text not null default 'recent_import'
    check (lane in ('organized', 'recent_import', 'locked_folder', 'review', 'location_history')),
  title text,
  summary text,
  original_at timestamptz,
  has_location boolean not null default false,
  is_primary_copy boolean not null default true,
  duplicate_of_object_id uuid references anchise_control_v1.stored_objects(id) on delete set null,
  source_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, content_hash)
);

create index if not exists idx_control_stored_objects_connector
  on anchise_control_v1.stored_objects(connector_id, created_at desc);

create table if not exists anchise_control_v1.object_provenance (
  id uuid primary key default gen_random_uuid(),
  stored_object_id uuid not null references anchise_control_v1.stored_objects(id) on delete cascade,
  connector_id uuid not null references anchise_control_v1.connectors(id) on delete cascade,
  batch_id uuid references anchise_control_v1.import_batches(id) on delete set null,
  category text not null
    check (category in ('photos', 'mail', 'files', 'contacts', 'geolocation')),
  source_path text,
  source_item_id text,
  source_account_label text,
  first_seen_at timestamptz not null default now()
);

create index if not exists idx_control_provenance_object
  on anchise_control_v1.object_provenance(stored_object_id);

create table if not exists anchise_control_v1.connector_events (
  id bigserial primary key,
  connector_id uuid not null references anchise_control_v1.connectors(id) on delete cascade,
  from_state text,
  to_state text not null,
  trigger text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_control_connector_events_connector
  on anchise_control_v1.connector_events(connector_id, created_at desc);

create or replace view anchise_control_v1.v_workspace_storage as
select
  w.id as workspace_id,
  w.storage_capacity_bytes,
  w.storage_used_bytes,
  greatest(w.storage_capacity_bytes - w.storage_used_bytes, 0) as storage_available_bytes,
  count(c.id)::int as connector_count
from anchise_control_v1.workspaces w
left join anchise_control_v1.connectors c on c.workspace_id = w.id
group by w.id;

create or replace view anchise_control_v1.v_recent_imports as
select
  b.id as batch_id,
  p.workspace_id,
  p.connector_id,
  b.status,
  b.bytes_uploaded,
  b.dedup_bytes_skipped,
  b.completed_at
from anchise_control_v1.import_batches b
join anchise_control_v1.import_plans p on p.id = b.plan_id;
