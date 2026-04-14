alter table if exists anchise_control_v1.connectors
  add column if not exists settings jsonb not null default '{}'::jsonb,
  add column if not exists inventory_cursor jsonb not null default '{}'::jsonb;

create table if not exists anchise_control_v1.source_items (
  id uuid primary key default gen_random_uuid(),
  connector_id uuid not null references anchise_control_v1.connectors(id) on delete cascade,
  snapshot_id uuid references anchise_control_v1.inventory_snapshots(id) on delete set null,
  category text not null
    check (category in ('photos', 'mail', 'files', 'contacts', 'geolocation')),
  source_item_id text not null,
  source_path text,
  external_updated_at timestamptz,
  byte_size_estimate bigint,
  content_hash_hint text,
  mime_type text,
  title text,
  inventory_state text not null default 'discovered'
    check (inventory_state in ('discovered', 'planned', 'imported', 'skipped_duplicate', 'missing')),
  download_disposition text not null default 'defer'
    check (download_disposition in ('defer', 'pending', 'downloaded', 'skipped_duplicate')),
  imported_object_id uuid references anchise_control_v1.stored_objects(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_planned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connector_id, source_item_id)
);

create index if not exists idx_control_source_items_connector
  on anchise_control_v1.source_items(connector_id, category, download_disposition);

create index if not exists idx_control_source_items_snapshot
  on anchise_control_v1.source_items(snapshot_id);

create table if not exists anchise_control_v1.batch_source_items (
  batch_id uuid not null references anchise_control_v1.import_batches(id) on delete cascade,
  source_item_id uuid not null references anchise_control_v1.source_items(id) on delete cascade,
  ordinal int not null,
  status text not null default 'planned'
    check (status in ('planned', 'committed', 'skipped_duplicate')),
  planned_byte_size bigint not null default 0,
  created_at timestamptz not null default now(),
  primary key (batch_id, source_item_id),
  unique (batch_id, ordinal)
);

create index if not exists idx_control_batch_source_items_source
  on anchise_control_v1.batch_source_items(source_item_id);
