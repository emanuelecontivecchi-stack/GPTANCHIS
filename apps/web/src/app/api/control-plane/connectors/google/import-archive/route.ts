import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ControlPlaneInputError } from "@anchise/api/controlPlaneRepository";
import { createControlPlaneRuntime } from "@anchise/api/controlPlaneRuntime";
import type { UploadGoogleConnectorArchiveResponse } from "@anchise/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(code: string, message: string, status: number): Response {
  const body: UploadGoogleConnectorArchiveResponse = {
    ok: false,
    error: {
      code,
      message
    }
  };

  return Response.json(body, { status });
}

export async function POST(request: Request): Promise<Response> {
  let tempRoot: string | null = null;

  try {
    const formData = await request.formData();
    const connectorId = formData.get("connectorId");
    const archive = formData.get("archive");

    if (typeof connectorId !== "string" || connectorId.trim() === "") {
      return failure("invalid_request", "connectorId is required.", 400);
    }

    if (!(archive instanceof File)) {
      return failure("invalid_request", "archive must be a file upload.", 400);
    }

    tempRoot = await mkdtemp(join(tmpdir(), "anchise-google-upload-"));
    const archivePath = join(tempRoot, archive.name);
    await writeFile(archivePath, Buffer.from(await archive.arrayBuffer()));

    const controlPlaneRuntime = createControlPlaneRuntime();
    const result = await controlPlaneRuntime.uploadGoogleConnectorArchive({
      connectorId,
      archiveFilePath: archivePath,
      archiveFileName: archive.name
    });

    const body: UploadGoogleConnectorArchiveResponse = {
      ok: true,
      data: result
    };

    return Response.json(body, { status: 200 });
  } catch (error) {
    if (error instanceof ControlPlaneInputError) {
      return failure("invalid_request", error.message, 400);
    }

    return failure("internal_error", "Unexpected control-plane error.", 500);
  } finally {
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
    }
  }
}
