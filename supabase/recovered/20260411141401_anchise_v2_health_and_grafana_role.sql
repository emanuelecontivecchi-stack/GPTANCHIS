-- Read-only role for Grafana, scoped to anchise_v2.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anchise_grafana') then
    create role anchise_grafana login password 'rotate-me-immediately';
  end if;
end $$;

grant usage on schema anchise_v2 to anchise_grafana;
grant select on all tables in schema anchise_v2 to anchise_grafana;
alter default privileges in schema anchise_v2 grant select on tables to anchise_grafana;

-- Health views for both the in-app /founder/health page and Grafana dashboards.
-- All live under anchise_v2 and are derived-only (safe to rebuild).

create or replace view anchise_v2.v_cases_by_status as
select status, count(*)::int as n
from anchise_v2.cases
group by status;

create or replace view anchise_v2.v_cases_by_tier as
select coalesce(service_tier, 'none') as tier, count(*)::int as n
from anchise_v2.cases
group by coalesce(service_tier, 'none');

create or replace view anchise_v2.v_cases_by_day as
select date_trunc('day', created_at)::date as day, count(*)::int as n
from anchise_v2.cases
where created_at > now() - interval '90 days'
group by 1
order by 1;

create or replace view anchise_v2.v_credentials_by_day as
select date_trunc('day', created_at)::date as day, count(*)::int as n
from anchise_v2.credentials
where created_at > now() - interval '90 days'
group by 1
order by 1;

create or replace view anchise_v2.v_audit_events_by_event as
select event, count(*)::int as n
from anchise_v2.audit_log
where created_at > now() - interval '30 days'
group by event
order by n desc;

-- Funnel: intake -> heir invite -> session started -> tier chosen -> delivered
create or replace view anchise_v2.v_funnel as
with counts as (
  select
    (select count(*) from anchise_v2.cases where created_at > now() - interval '90 days') as intake,
    (select count(*) from anchise_v2.audit_log where event = 'heir.invite_sent' and created_at > now() - interval '90 days') as invited,
    (select count(*) from anchise_v2.audit_log where event = 'auth.session_started' and created_at > now() - interval '90 days') as logged_in,
    (select count(*) from anchise_v2.cases where service_tier is not null and tier_selected_at > now() - interval '90 days') as tier_chosen,
    (select count(*) from anchise_v2.cases where status = 'delivered' and updated_at > now() - interval '90 days') as delivered
)
select * from counts;

-- Active batches for the founder (cases in mid-recovery states).
create or replace view anchise_v2.v_active_batches as
select sim_carrier, count(*)::int as n
from anchise_v2.cases
where status in ('intake','sim_picked_up','at_carrier','puk_obtained','recovering')
group by sim_carrier
order by n desc;

grant select on anchise_v2.v_cases_by_status,
               anchise_v2.v_cases_by_tier,
               anchise_v2.v_cases_by_day,
               anchise_v2.v_credentials_by_day,
               anchise_v2.v_audit_events_by_event,
               anchise_v2.v_funnel,
               anchise_v2.v_active_batches
  to anchise_grafana;
