# Anchise V1 Topology and Runtime

## Build Location

The active workspace root is:

`C:\Users\emanu\OneDrive\ANCHISE - GPT`

This is where the repo, apps, packages, and refined docs should live.

## Runtime Topology

```text
User Browser
   |
   v
Web App + API (control plane)
   |
   +--> Postgres
   +--> Object Storage
   +--> Background Worker
   |
   v
Local Agent (execution plane)
   |
   +--> Browser session runner
   +--> Local folder importer
   +--> Upload client
   +--> Progress reporter
```

## Stack Choice For V1

- Web app: Next.js or equivalent React control-plane app
- API: Node.js + TypeScript
- Database: PostgreSQL
- Object storage: S3-compatible bucket
- Uploads: resumable upload protocol
- Local agent: desktop-local TypeScript service
- Browser control: Playwright or comparable deterministic browser layer

## Playwright and Google

Google is a real source of friction for naive browser automation. The safe interpretation is not that Playwright is unusable, but that the automation strategy must be constrained.

For V1:

- do not rely on headless credential entry
- do not treat Google as a stealth-scraping target
- launch a visible, user-controlled browser lane from the local agent
- let the user authenticate manually
- persist session state per connector lane
- keep re-auth and action-needed states explicit
- prefer stable post-login flows and export surfaces over brittle page scraping where possible

The right principle is:

Playwright may drive the browser shell, but Anchise should rely on user-authenticated, visible sessions and deterministic state handling.

## AI Role

AI is optional and bounded in V1. It can help with:

- page interpretation
- brittle UI fallback guidance
- content classification during organization

## OpenClaw + Qwen Policy

OpenClaw + Qwen are explicitly allowed in V1 as an assistive lane, not as the primary execution core.

The runtime should follow this order:

1. deterministic connector logic first
2. bounded AI interpretation only when the deterministic lane cannot confidently continue
3. typed normalization of any AI output before the rest of the system trusts it

This means OpenClaw + Qwen may help with:

- interpreting unstable page structure
- mapping page state to a known connector action
- proposing recovery steps when browser flows drift
- classifying ambiguous imported content

They must not directly own:

- connector state transitions
- import planning truth
- storage-fit decisions
- object manifests
- deduplication outcomes
- integrity verification
- delete eligibility

AI should not own:

- connector states
- manifests
- storage-fit logic
- dedup rules
- integrity verification
- delete eligibility
