# Anchise V1 Locked Principles

## Product Promise

Anchise V1 is a control center for a user's digital footprint, not a blind scraper and not a full account-closure platform.

## Locked Principles

1. Inventory before acquisition is mandatory.
   Before any download begins, Anchise shows the shape of the target account, what Anchise already stores, and whether the selected net-new import fits within available Anchise storage.

2. The user experience should feel one-click simple.
   The complexity belongs in the system, not in the workflow the user sees.

3. Downloads are reconciliation-based from step 0.
   Even the first import compares source content against the current Anchise baseline, which may be empty or partially filled.

4. Anchise avoids storing duplicate-identical binaries.
   Deduplication happens at the storage layer while provenance and source references remain intact.

5. Delete from source is not a core V1 promise.
   It is a later, stateful, source-specific action that can only be offered after verification thresholds pass.

6. Deterministic code owns states and guarantees.
   AI may help interpret pages or classify content, but it does not own manifests, storage-fit logic, integrity, or delete eligibility.

7. The web app decides, the local agent executes, and Anchise cloud stores and organizes.

8. OpenClaw + Qwen are fallback and assist layers only.
   They may help with bounded page interpretation, brittle UI recovery, or classification, but they are not the primary execution core for V1.

## Narrow V1 Source Set

- Google: photos, mail, geolocation
- Local hardware: user-selected folders only
