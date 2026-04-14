# Anchise V1 Build Start Plan

## Phase 1

Build the deterministic core first:

1. Shared contracts for states, manifests, inventory, and provenance
2. API shell for workspaces, connectors, inventory snapshots, and import plans
3. Local agent shell for browser lanes, local-folder intake, and uploads
4. Web control-plane shell for the six-step customer journey

## First End-to-End Slice

The first slice should prove:

- one Google connector can be created
- the user can authenticate in a visible local browser lane
- Anchise can produce an inventory snapshot
- the snapshot can compute storage fit and net-new estimates
- an import plan can be saved

## Runtime Integration Order

Implement the execution lanes in this order:

1. deterministic connector policy and typed results
2. local agent browser-lane launcher
3. storage-fit and reconciliation calculation
4. AI assist adapter for bounded interpretation only

The AI adapter should sit behind a strict interface so OpenClaw + Qwen can be enabled without changing the rest of the state model.

## Second Slice

After the Google inventory path works, add:

- local hardware folder selection
- manifest creation
- upload bookkeeping
- recent import view

## Do Not Build Yet

- generic delete automation
- broad connector coverage
- AI-driven state ownership
- complex microservice topology
