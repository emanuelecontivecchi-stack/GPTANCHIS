import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
const schemaName = process.env.ANCHISE_DB_SCHEMA ?? "anchise_control_v1";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(schemaName)) {
  throw new Error(`Invalid ANCHISE_DB_SCHEMA value: ${schemaName}`);
}

class RollbackPreview extends Error {
  constructor(summary) {
    super("Rolled back smoke test after previewing the flow.");
    this.name = "RollbackPreview";
    this.summary = summary;
  }
}

const sql = postgres(databaseUrl, {
  prepare: false,
  connection: {
    application_name: "anchise_control_plane_smoke",
    options: `-c search_path=${schemaName},public`
  }
});

try {
  await sql.begin(async (tx) => {
    const [workspace] = await tx`
      insert into workspaces (
        owner_id,
        plan_state,
        agent_state,
        storage_capacity_bytes
      )
      values (
        'smoke-owner',
        'trial',
        'paired',
        ${200 * 1024 * 1024 * 1024}
      )
      returning id, storage_capacity_bytes, storage_used_bytes
    `;

    const [connector] = await tx`
      insert into connectors (
        workspace_id,
        platform,
        account_label,
        surface,
        extraction_strategy,
        delete_capability
      )
      values (
        ${workspace.id},
        'google',
        'smoke-google-account',
        'browser_account',
        'browser',
        'download_only'
      )
      returning id, state
    `;

    const [snapshot] = await tx`
      insert into inventory_snapshots (
        connector_id,
        status,
        source_bytes_estimate,
        net_new_bytes_estimate,
        existing_anchise_bytes_estimate,
        available_anchise_bytes,
        fit_state,
        space_warning
      )
      values (
        ${connector.id},
        'ready',
        ${90 * 1024 * 1024 * 1024},
        ${70 * 1024 * 1024 * 1024},
        ${10 * 1024 * 1024 * 1024},
        ${190 * 1024 * 1024 * 1024},
        'fits',
        false
      )
      returning id
    `;

    await tx`
      insert into inventory_categories (
        snapshot_id,
        category,
        item_count_estimate,
        bytes_estimate,
        duplicate_bytes_estimate,
        import_supported,
        incremental_supported
      )
      values
        (${snapshot.id}, 'photos', 1200, ${60 * 1024 * 1024 * 1024}, ${10 * 1024 * 1024 * 1024}, true, true),
        (${snapshot.id}, 'mail', 80000, ${30 * 1024 * 1024 * 1024}, ${10 * 1024 * 1024 * 1024}, true, true)
    `;

    const [plan] = await tx`
      insert into import_plans (
        workspace_id,
        connector_id,
        snapshot_id,
        mode,
        source_action,
        selected_categories,
        source_bytes_estimate,
        net_new_bytes_estimate,
        available_anchise_bytes,
        fit_state,
        status
      )
      values (
        ${workspace.id},
        ${connector.id},
        ${snapshot.id},
        'incremental',
        'download_only',
        '["photos","mail"]'::jsonb,
        ${90 * 1024 * 1024 * 1024},
        ${70 * 1024 * 1024 * 1024},
        ${190 * 1024 * 1024 * 1024},
        'fits',
        'draft'
      )
      returning id, status
    `;

    throw new RollbackPreview({
      rolledBack: true,
      schemaName,
      workspaceId: workspace.id,
      connectorId: connector.id,
      snapshotId: snapshot.id,
      planId: plan.id,
      planStatus: plan.status
    });
  });
} catch (error) {
  if (error instanceof RollbackPreview) {
    console.log(JSON.stringify(error.summary, null, 2));
    process.exit(0);
  }

  throw error;
} finally {
  await sql.end({ timeout: 5 });
}
