# Anchise V1 Live Schema Alignment

## What Was Recovered From The Live Supabase Project

The live project currently has four applied migrations in `supabase_migrations.schema_migrations`:

1. `20260411135542_anchise_v2_schema`
2. `20260411141401_anchise_v2_health_and_grafana_role`
3. `20260412013629_anchise_v2_service2_schema`
4. `20260413025822_anchise_v3_connectors_manifests`

Those have been recovered locally under `supabase/recovered/` so the historical live shape is no longer implicit.

## What The Live Schema Already Gets Right

- explicit connector lifecycle states
- inventory before download
- per-category inventory counts and byte estimates
- per-batch manifest verification
- content-hash deduplication logic
- separate provenance-rich content records instead of only account-level metadata

These are all compatible with the locked V1 direction.

## What Must Not Become The New Core

The `anchise_v2` schema is still a pilot schema for the Borniol and memorial workflow. These tables should not be reused as the new product spine:

- `partner_staff`
- `heirs`
- `cases`
- `credentials`
- `auth_tokens`
- `sessions`
- `owner_commitments`

They encode a specific memorial-service operating model and naming scheme that does not match the broader Anchise control-plane direction.

## Mapping Live Shape To The New V1 Direction

| Live `anchise_v2` shape | Clean V1 direction |
| --- | --- |
| `recovered_accounts` | `connectors` |
| `connector_inventory` | `inventory_snapshots` + `inventory_categories` |
| `sieve_batches` | `import_batches` |
| `import_manifests` | `object_manifests` |
| `items` | `stored_objects` |
| `item_tags` | later explorer classification layer |
| `connector_events` | `connector_events` |
| `companion_tokens` | later local-agent auth lane, not first schema pass |

## Locked V1 Principles Reflected In The New Schema

- inventory before import is mandatory
- step 0 can still be incremental from nothing
- Anchise must show if the selected import exceeds available space before download begins
- only net-new bytes should be downloaded when the source supports incremental acquisition
- no two identical content files should be kept in Anchise-controlled storage for the same workspace

## Clean Schema Path

The new build path should stay in the same Supabase project, but move to a clean schema:

`anchise_control_v1`

That lets us:

- preserve the live pilot schema untouched
- keep the new product model explicit
- test and iterate without renaming legacy tables
- migrate selected concepts forward intentionally instead of by accident
