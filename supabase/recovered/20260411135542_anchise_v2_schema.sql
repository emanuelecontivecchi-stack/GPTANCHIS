-- Anchise v2 schema
-- Aligned with ANCHISE-LOCK-2026-04-11 + ANCHISE-LOCK-AMENDMENT-2026-04-12
-- Lives alongside the legacy v1 tables. No clash.

create schema if not exists anchise_v2;

-- Borniol partner staff who run intake.
create table if not exists anchise_v2.partner_staff (
  id bigserial primary key,
  partner_name text not null default 'Borniol Grenelle',
  staff_name text not null,
  staff_email text not null unique,
  staff_passcode_hash text,
  created_at timestamptz not null default now()
);

-- Heirs = living data subjects. GDPR applies in full. Minimum data only.
create table if not exists anchise_v2.heirs (
  id bigserial primary key,
  email text not null unique,
  first_name text,
  language text not null default 'fr',
  created_at timestamptz not null default now()
);

-- Cases = one deceased + one heir + one recovery operation.
create table if not exists anchise_v2.cases (
  id bigserial primary key,
  public_id text not null unique,
  deceased_full_name text not null,
  deceased_date_of_birth text,
  deceased_date_of_death text,
  deceased_place_of_death text,
  deceased_nationality text,
  deceased_languages jsonb not null default '[]'::jsonb,
  deceased_known_emails jsonb not null default '[]'::jsonb,
  deceased_known_phones jsonb not null default '[]'::jsonb,
  deceased_known_usernames jsonb not null default '[]'::jsonb,
  deceased_notes text,
  sim_carrier text,
  sim_phone_number text,
  sim_received_at timestamptz,
  heir_id bigint not null references anchise_v2.heirs(id),
  legal_identity_verified boolean not null default false,
  verification_staff_id bigint references anchise_v2.partner_staff(id),
  verification_at timestamptz,
  verification_location text,
  declaration_signed boolean not null default false,
  declaration_signed_at timestamptz,
  service_tier text check (service_tier in ('service_1','service_2','service_3')),
  tier_selected_at timestamptz,
  status text not null default 'intake'
    check (status in ('intake','sim_picked_up','at_carrier','puk_obtained',
                      'recovering','recovered','sim_returned','delivered',
                      'closed','aborted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cases_status on anchise_v2.cases(status);
create index if not exists idx_cases_heir on anchise_v2.cases(heir_id);

-- Recovered credentials. AES-256-GCM envelope at rest.
create table if not exists anchise_v2.credentials (
  id bigserial primary key,
  case_id bigint not null references anchise_v2.cases(id) on delete cascade,
  platform_slug text not null,
  account_identifier text not null,
  temp_password_ciphertext bytea not null,
  temp_password_iv bytea not null,
  temp_password_tag bytea not null,
  notes text,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_credentials_case on anchise_v2.credentials(case_id);

-- Magic-link tokens for heir auth. Single-use, short-lived.
create table if not exists anchise_v2.auth_tokens (
  id bigserial primary key,
  heir_id bigint not null references anchise_v2.heirs(id) on delete cascade,
  token_hash text not null unique,
  kind text not null default 'login' check (kind in ('login','invite')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_tokens_expires on anchise_v2.auth_tokens(expires_at);

-- Heir sessions after magic-link redemption.
create table if not exists anchise_v2.sessions (
  id bigserial primary key,
  heir_id bigint not null references anchise_v2.heirs(id) on delete cascade,
  session_token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sessions_expires on anchise_v2.sessions(expires_at);

-- Append-only audit log.
create table if not exists anchise_v2.audit_log (
  id bigserial primary key,
  case_id bigint,
  heir_id bigint,
  actor text not null,
  event text not null,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_case on anchise_v2.audit_log(case_id);
create index if not exists idx_audit_created on anchise_v2.audit_log(created_at);

-- Rate limiting bucket (per-key counter with window).
create table if not exists anchise_v2.rate_limits (
  key text primary key,
  count int not null default 0,
  window_start timestamptz not null default now()
);

-- Seed a default Borniol staff row for dev.
insert into anchise_v2.partner_staff (partner_name, staff_name, staff_email)
values ('Borniol Grenelle', 'Test Staff', 'test@borniol-grenelle.invalid')
on conflict (staff_email) do nothing;
