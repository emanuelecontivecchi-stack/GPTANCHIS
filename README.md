# Anchise

Anchise is a trust-first control center for a user's digital footprint.

V1 is intentionally narrow:
- Google: photos, mail, geolocation
- Local hardware: user-selected folders only

The product rule we are locking first is simple:

1. Inventory before acquisition is mandatory.
2. Anchise compares source content against what is already stored in Anchise cloud space.
3. Anchise shows whether the selected net-new content fits within available storage before download begins.
4. Anchise stores duplicate-identical binaries once while preserving source references and provenance.

## Workspace Layout

- `KEY DOCS/`: locked product and architecture decisions
- `apps/web/`: control-plane user experience
- `apps/api/`: backend state, orchestration, manifests, and storage-fit logic
- `apps/agent/`: local execution plane for browser and local-folder intake
- `packages/contracts/`: shared state-machine and entity definitions

## Current Build Direction

- Deterministic state and manifest logic own trust-sensitive behavior.
- The local agent launches visible, user-authenticated browser sessions.
- AI is a bounded assistive layer, not the source of truth.
