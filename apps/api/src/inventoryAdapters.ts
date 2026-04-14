import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";

import type {
  Category,
  CategoryInventory,
  Connector,
  DiscoveredSourceItemInput,
  StorageComparison,
  Workspace
} from "@anchise/contracts";

import { ControlPlaneInputError } from "./controlPlaneRepository.js";

export interface InventoryAdapterResult {
  strategyLabel: string;
  categories: CategoryInventory[];
  comparison: StorageComparison;
  sourceItems: DiscoveredSourceItemInput[];
  generatedAt: string;
}

export interface InventoryAdapter {
  run(input: { connector: Connector; workspace: Workspace }): Promise<InventoryAdapterResult>;
}

export interface GoogleExportProbeResult {
  rootPath: string;
  detectedSourceItemCount: number;
  detectedCategories: Category[];
}

const googleMediaExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".heic",
  ".gif",
  ".webp",
  ".mp4",
  ".mov",
  ".m4v"
]);

function hashText(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

function hashKey(item: DiscoveredSourceItemInput): string {
  return item.contentHashHint ?? `source:${item.externalItemId}`;
}

function toMetadata(item: DiscoveredSourceItemInput): Record<string, unknown> {
  return item.metadata ?? {};
}

function itemCountWeight(item: DiscoveredSourceItemInput): number {
  const itemCountEstimate = toMetadata(item).itemCountEstimate;
  return typeof itemCountEstimate === "number" &&
    Number.isFinite(itemCountEstimate) &&
    itemCountEstimate > 0
    ? Math.max(1, Math.round(itemCountEstimate))
    : 1;
}

function extractItemDates(item: DiscoveredSourceItemInput): string[] {
  const dates = new Set<string>();

  if (item.externalUpdatedAt) {
    dates.add(item.externalUpdatedAt);
  }

  const metadata = toMetadata(item);

  if (typeof metadata.dateRangeStart === "string" && metadata.dateRangeStart) {
    dates.add(metadata.dateRangeStart);
  }

  if (typeof metadata.dateRangeEnd === "string" && metadata.dateRangeEnd) {
    dates.add(metadata.dateRangeEnd);
  }

  return [...dates];
}

function calculateComparison(
  sourceItems: DiscoveredSourceItemInput[],
  workspace: Workspace
): StorageComparison {
  let sourceBytesEstimate = 0;
  let netNewBytesEstimate = 0;
  const seen = new Set<string>();

  for (const item of sourceItems) {
    const byteSize = item.byteSizeEstimate ?? 0;
    sourceBytesEstimate += byteSize;

    const dedupKey = hashKey(item);
    if (!seen.has(dedupKey)) {
      seen.add(dedupKey);
      netNewBytesEstimate += byteSize;
    }
  }

  const availableAnchiseBytes = Math.max(
    workspace.storageCapacityBytes - workspace.storageUsedBytes,
    0
  );

  return {
    sourceBytesEstimate,
    netNewBytesEstimate,
    existingAnchiseBytesEstimate: workspace.storageUsedBytes,
    availableAnchiseBytes,
    fitState:
      netNewBytesEstimate <= availableAnchiseBytes
        ? "fits"
        : netNewBytesEstimate <= availableAnchiseBytes * 1.15
          ? "likely_exceeds"
          : "exceeds"
  };
}

function calculateCategories(sourceItems: DiscoveredSourceItemInput[]): CategoryInventory[] {
  const grouped = new Map<
    Category,
    {
      items: number;
      bytes: number;
      uniqueBytes: number;
      seenHashes: Set<string>;
      dates: string[];
    }
  >();

  for (const item of sourceItems) {
    const group = grouped.get(item.category) ?? {
      items: 0,
      bytes: 0,
      uniqueBytes: 0,
      seenHashes: new Set<string>(),
      dates: []
    };

    const byteSize = item.byteSizeEstimate ?? 0;
    group.items += itemCountWeight(item);
    group.bytes += byteSize;

    const dedupKey = hashKey(item);
    if (!group.seenHashes.has(dedupKey)) {
      group.seenHashes.add(dedupKey);
      group.uniqueBytes += byteSize;
    }

    group.dates.push(...extractItemDates(item));
    grouped.set(item.category, group);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, group]) => {
      const orderedDates = group.dates.slice().sort((left, right) => left.localeCompare(right));

      return {
        category,
        itemCountEstimate: group.items,
        bytesEstimate: group.bytes,
        duplicateBytesEstimate: Math.max(group.bytes - group.uniqueBytes, 0),
        netNewBytesEstimate: group.uniqueBytes,
        importSupported: true,
        incrementalSupported: true,
        dateRangeStart: orderedDates[0] ?? null,
        dateRangeEnd: orderedDates.length > 0 ? orderedDates[orderedDates.length - 1] : null
      };
    });
}

function buildInventoryResult(
  sourceItems: DiscoveredSourceItemInput[],
  workspace: Workspace,
  strategyLabel: string
): InventoryAdapterResult {
  return {
    strategyLabel,
    categories: calculateCategories(sourceItems),
    comparison: calculateComparison(sourceItems, workspace),
    sourceItems,
    generatedAt: new Date().toISOString()
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function readNested(value: unknown, keys: string[]): unknown {
  let current = value;

  for (const key of keys) {
    const record = asRecord(current);
    if (!record) {
      return null;
    }

    current = record[key];
  }

  return current;
}

function readNestedString(value: unknown, keys: string[]): string | null {
  const candidate = readNested(value, keys);
  return typeof candidate === "string" && candidate.trim() !== "" ? candidate.trim() : null;
}

function parseTimestamp(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = new Date(value > 1_000_000_000_000 ? value : value * 1000);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (typeof value !== "string" || value.trim() === "") {
    return null;
  }

  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return parseTimestamp(Number(trimmed));
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function categoriesForGoogleProfile(profile: string | null | undefined): Category[] {
  switch (profile) {
    case "space_warning":
      return ["mail", "files"];
    case "google_core":
    default:
      return ["photos", "mail", "geolocation"];
  }
}

function requestedGoogleCategories(connector: Connector): Set<Category> {
  const requested = connector.authSession?.requestedCategories;
  if (requested && requested.length > 0) {
    return new Set(requested);
  }

  return new Set(categoriesForGoogleProfile(connector.settings.inventoryProfile ?? null));
}

function normalizeRootPath(configuredRoot: string): string {
  return isAbsolute(configuredRoot) ? configuredRoot : resolve(configuredRoot);
}

function statByteSize(fileStat: Awaited<ReturnType<typeof stat>>): number {
  return Number(fileStat.size);
}

async function ensureReadableDirectory(rootPath: string, label: string): Promise<void> {
  let rootStat;

  try {
    rootStat = await stat(rootPath);
  } catch {
    throw new ControlPlaneInputError(`${label} does not exist: ${rootPath}`);
  }

  if (!rootStat.isDirectory()) {
    throw new ControlPlaneInputError(`${label} must point to a directory: ${rootPath}`);
  }
}

function categoryForLocalFile(filePath: string): Category {
  const extension = extname(filePath).toLowerCase();
  const filename = basename(filePath).toLowerCase();

  if (googleMediaExtensions.has(extension)) {
    return "photos";
  }

  if ([".eml", ".mbox", ".pst"].includes(extension)) {
    return "mail";
  }

  if ([".vcf"].includes(extension)) {
    return "contacts";
  }

  if (
    [".json", ".geojson", ".gpx", ".kml", ".kmz"].includes(extension) &&
    /(location|timeline|places|tracks)/.test(filename)
  ) {
    return "geolocation";
  }

  return "files";
}

function mimeTypeForExtension(extension: string): string {
  switch (extension.toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".heic":
      return "image/heic";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".mp4":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".m4v":
      return "video/x-m4v";
    case ".eml":
      return "message/rfc822";
    case ".mbox":
      return "application/mbox";
    case ".pst":
      return "application/vnd.ms-outlook";
    case ".vcf":
      return "text/vcard";
    case ".json":
      return "application/json";
    case ".geojson":
      return "application/geo+json";
    case ".gpx":
      return "application/gpx+xml";
    case ".kml":
      return "application/vnd.google-earth.kml+xml";
    case ".kmz":
      return "application/vnd.google-earth.kmz";
    default:
      return "application/octet-stream";
  }
}

async function scanLocalSource(rootPath: string, maxFiles: number): Promise<DiscoveredSourceItemInput[]> {
  const sourceItems: DiscoveredSourceItemInput[] = [];
  const stack = [rootPath];

  while (stack.length > 0 && sourceItems.length < maxFiles) {
    const currentPath = stack.pop();

    if (!currentPath) {
      continue;
    }

    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (sourceItems.length >= maxFiles) {
        break;
      }

      const fullPath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const fileStat = await stat(fullPath);
      const relativePath = relative(rootPath, fullPath).replace(/\\/g, "/");
      const extension = extname(entry.name).toLowerCase();

      sourceItems.push({
        category: categoryForLocalFile(fullPath),
        externalItemId: relativePath,
        sourcePath: fullPath,
        externalUpdatedAt: fileStat.mtime.toISOString(),
        byteSizeEstimate: fileStat.size,
        contentHashHint: hashText(`${entry.name.toLowerCase()}:${fileStat.size}`),
        mimeType: mimeTypeForExtension(extension),
        title: basename(entry.name, extension),
        metadata: {
          rootPath,
          relativePath,
          scanMode: "filesystem"
        }
      });
    }
  }

  return sourceItems;
}

function isGooglePhotosMediaFile(relativePath: string, extension: string): boolean {
  const normalized = relativePath.toLowerCase();
  return googleMediaExtensions.has(extension) && normalized.includes("google photos");
}

function isGoogleMailFile(relativePath: string, extension: string): boolean {
  const normalized = relativePath.toLowerCase();
  return extension === ".mbox" && (normalized.includes("/mail/") || normalized.startsWith("mail/"));
}

function isGoogleLocationFile(relativePath: string, extension: string): boolean {
  const normalized = relativePath.toLowerCase();
  return (
    extension === ".json" &&
    (normalized.includes("location history") ||
      normalized.includes("timeline") ||
      normalized.includes("semantic location history"))
  );
}

function isGoogleDriveFile(relativePath: string, extension: string): boolean {
  const normalized = relativePath.toLowerCase();

  if (extension === ".json" || normalized.includes("google photos")) {
    return false;
  }

  return (
    normalized.includes("/drive/") ||
    normalized.startsWith("drive/") ||
    normalized.includes("/my drive/") ||
    normalized.startsWith("my drive/")
  );
}

function isGoogleContactsFile(relativePath: string, extension: string): boolean {
  const normalized = relativePath.toLowerCase();
  return extension === ".vcf" && normalized.includes("contacts");
}

async function pathExists(pathToCheck: string): Promise<boolean> {
  try {
    await stat(pathToCheck);
    return true;
  } catch {
    return false;
  }
}

async function isGooglePhotoSidecarFile(fullPath: string, relativePath: string): Promise<boolean> {
  const normalized = relativePath.toLowerCase();

  if (!normalized.includes("google photos") || !normalized.endsWith(".json")) {
    return false;
  }

  return pathExists(fullPath.slice(0, -5));
}

function googlePhotoSidecarCandidates(fullPath: string): string[] {
  const extension = extname(fullPath);
  const basenameWithoutExtension = basename(fullPath, extension);

  return [...new Set([`${fullPath}.json`, join(dirname(fullPath), `${basenameWithoutExtension}.json`)])];
}

async function readJsonIfSmall(
  filePath: string,
  maxBytes: number = 2 * 1024 * 1024
): Promise<Record<string, unknown> | null> {
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile() || fileStat.size > maxBytes) {
      return null;
    }

    const raw = await readFile(filePath, "utf8");
    return asRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function readFirstJsonCandidate(
  candidates: string[]
): Promise<{ path: string; data: Record<string, unknown> } | null> {
  for (const candidate of candidates) {
    const data = await readJsonIfSmall(candidate);
    if (data) {
      return { path: candidate, data };
    }
  }

  return null;
}

function extractJsonItemCount(payload: Record<string, unknown> | null): number | null {
  if (!payload) {
    return null;
  }

  if (Array.isArray(payload)) {
    return payload.length;
  }

  const arrayKeys = ["locations", "timelineObjects", "semanticSegments", "features"];
  for (const key of arrayKeys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value.length;
    }
  }

  return null;
}

async function inspectMbox(
  filePath: string
): Promise<{ itemCountEstimate: number; dateRangeStart: string | null; dateRangeEnd: string | null }> {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });

  let itemCountEstimate = 0;
  let dateRangeStart: string | null = null;
  let dateRangeEnd: string | null = null;
  let inHeaders = false;

  for await (const line of rl) {
    if (line.startsWith("From ")) {
      itemCountEstimate += 1;
      inHeaders = true;
      continue;
    }

    if (!inHeaders) {
      continue;
    }

    if (line.trim() === "") {
      inHeaders = false;
      continue;
    }

    if (line.toLowerCase().startsWith("date:")) {
      const parsed = parseTimestamp(line.slice(5).trim());
      if (!parsed) {
        continue;
      }

      if (dateRangeStart === null || parsed < dateRangeStart) {
        dateRangeStart = parsed;
      }

      if (dateRangeEnd === null || parsed > dateRangeEnd) {
        dateRangeEnd = parsed;
      }
    }
  }

  return {
    itemCountEstimate: Math.max(itemCountEstimate, 1),
    dateRangeStart,
    dateRangeEnd
  };
}

async function buildGoogleMailSourceItem(input: {
  rootPath: string;
  fullPath: string;
  relativePath: string;
  fileStat: Awaited<ReturnType<typeof stat>>;
}): Promise<DiscoveredSourceItemInput> {
  const extension = extname(input.fullPath).toLowerCase();
  const mbox = await inspectMbox(input.fullPath);
  const title = basename(input.fullPath, extension);

  return {
    category: "mail",
    externalItemId: input.relativePath,
    sourcePath: input.fullPath,
    externalUpdatedAt: mbox.dateRangeEnd ?? input.fileStat.mtime.toISOString(),
    byteSizeEstimate: statByteSize(input.fileStat),
    contentHashHint: hashText(
      `gmail:${title.toLowerCase()}:${statByteSize(input.fileStat)}:${mbox.dateRangeEnd ?? ""}`
    ),
    mimeType: mimeTypeForExtension(extension),
    title,
    metadata: {
      provider: "gmail",
      inventoryMode: "google_export",
      rootPath: input.rootPath,
      relativePath: input.relativePath,
      itemCountEstimate: mbox.itemCountEstimate,
      dateRangeStart: mbox.dateRangeStart,
      dateRangeEnd: mbox.dateRangeEnd
    }
  };
}

async function buildGooglePhotoSourceItem(input: {
  rootPath: string;
  fullPath: string;
  relativePath: string;
  fileStat: Awaited<ReturnType<typeof stat>>;
}): Promise<DiscoveredSourceItemInput> {
  const extension = extname(input.fullPath).toLowerCase();
  const sidecar = await readFirstJsonCandidate(googlePhotoSidecarCandidates(input.fullPath));
  const takenAt =
    parseTimestamp(readNested(sidecar?.data, ["photoTakenTime", "timestamp"])) ??
    parseTimestamp(readNested(sidecar?.data, ["creationTime", "timestamp"]));
  const sidecarTitle = readNestedString(sidecar?.data, ["title"]);
  const title = sidecarTitle ?? basename(input.fullPath, extension);

  return {
    category: "photos",
    externalItemId: input.relativePath,
    sourcePath: input.fullPath,
    externalUpdatedAt: takenAt ?? input.fileStat.mtime.toISOString(),
    byteSizeEstimate: statByteSize(input.fileStat),
    contentHashHint: hashText(
      `gphoto:${title.toLowerCase()}:${statByteSize(input.fileStat)}:${takenAt ?? ""}`
    ),
    mimeType: mimeTypeForExtension(extension),
    title,
    metadata: {
      provider: "google_photos",
      inventoryMode: "google_export",
      rootPath: input.rootPath,
      relativePath: input.relativePath,
      sidecarPath: sidecar?.path ?? null,
      sidecarFound: Boolean(sidecar),
      dateRangeStart: takenAt,
      dateRangeEnd: takenAt
    }
  };
}

async function buildGoogleLocationSourceItem(input: {
  rootPath: string;
  fullPath: string;
  relativePath: string;
  fileStat: Awaited<ReturnType<typeof stat>>;
}): Promise<DiscoveredSourceItemInput> {
  const extension = extname(input.fullPath).toLowerCase();
  const payload = await readJsonIfSmall(input.fullPath);
  const itemCountEstimate = extractJsonItemCount(payload);

  return {
    category: "geolocation",
    externalItemId: input.relativePath,
    sourcePath: input.fullPath,
    externalUpdatedAt: input.fileStat.mtime.toISOString(),
    byteSizeEstimate: statByteSize(input.fileStat),
    contentHashHint: hashText(
      `glocation:${input.relativePath.toLowerCase()}:${statByteSize(input.fileStat)}`
    ),
    mimeType: mimeTypeForExtension(extension),
    title: basename(input.fullPath, extension),
    metadata: {
      provider: "location_history",
      inventoryMode: "google_export",
      rootPath: input.rootPath,
      relativePath: input.relativePath,
      itemCountEstimate
    }
  };
}

async function buildGoogleGenericSourceItem(input: {
  category: Extract<Category, "files" | "contacts">;
  provider: "google_drive" | "google_contacts";
  rootPath: string;
  fullPath: string;
  relativePath: string;
  fileStat: Awaited<ReturnType<typeof stat>>;
}): Promise<DiscoveredSourceItemInput> {
  const extension = extname(input.fullPath).toLowerCase();
  const title = basename(input.fullPath, extension);

  return {
    category: input.category,
    externalItemId: input.relativePath,
    sourcePath: input.fullPath,
    externalUpdatedAt: input.fileStat.mtime.toISOString(),
    byteSizeEstimate: statByteSize(input.fileStat),
    contentHashHint: hashText(
      `${input.category}:${input.relativePath.toLowerCase()}:${statByteSize(input.fileStat)}`
    ),
    mimeType: mimeTypeForExtension(extension),
    title,
    metadata: {
      provider: input.provider,
      inventoryMode: "google_export",
      rootPath: input.rootPath,
      relativePath: input.relativePath
    }
  };
}

async function analyzeGoogleExportFile(input: {
  rootPath: string;
  fullPath: string;
  relativePath: string;
  fileStat: Awaited<ReturnType<typeof stat>>;
  requestedCategories: Set<Category>;
}): Promise<DiscoveredSourceItemInput | null> {
  const extension = extname(input.fullPath).toLowerCase();

  if (await isGooglePhotoSidecarFile(input.fullPath, input.relativePath)) {
    return null;
  }

  if (input.requestedCategories.has("photos") && isGooglePhotosMediaFile(input.relativePath, extension)) {
    return buildGooglePhotoSourceItem(input);
  }

  if (input.requestedCategories.has("mail") && isGoogleMailFile(input.relativePath, extension)) {
    return buildGoogleMailSourceItem(input);
  }

  if (
    input.requestedCategories.has("geolocation") &&
    isGoogleLocationFile(input.relativePath, extension)
  ) {
    return buildGoogleLocationSourceItem(input);
  }

  if (input.requestedCategories.has("contacts") && isGoogleContactsFile(input.relativePath, extension)) {
    return buildGoogleGenericSourceItem({
      ...input,
      category: "contacts",
      provider: "google_contacts"
    });
  }

  if (input.requestedCategories.has("files") && isGoogleDriveFile(input.relativePath, extension)) {
    return buildGoogleGenericSourceItem({
      ...input,
      category: "files",
      provider: "google_drive"
    });
  }

  return null;
}

async function scanGoogleExportSource(
  rootPath: string,
  connector: Connector,
  maxFilesOverride?: number
): Promise<DiscoveredSourceItemInput[]> {
  const sourceItems: DiscoveredSourceItemInput[] = [];
  const stack = [rootPath];
  const requestedCategories = requestedGoogleCategories(connector);
  const maxFiles =
    maxFilesOverride ??
    ((typeof connector.settings.maxFiles === "number" &&
      Number.isInteger(connector.settings.maxFiles) &&
      connector.settings.maxFiles > 0)
      ? connector.settings.maxFiles
      : 5000);

  while (stack.length > 0 && sourceItems.length < maxFiles) {
    const currentPath = stack.pop();

    if (!currentPath) {
      continue;
    }

    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (sourceItems.length >= maxFiles) {
        break;
      }

      const fullPath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const fileStat = await stat(fullPath);
      const relativePath = relative(rootPath, fullPath).replace(/\\/g, "/");
      const analyzed = await analyzeGoogleExportFile({
        rootPath,
        fullPath,
        relativePath,
        fileStat,
        requestedCategories
      });

      if (analyzed) {
        sourceItems.push(analyzed);
      }
    }
  }

  return sourceItems;
}

function resolveGoogleExportRootPath(connector: Connector): string {
  const configuredRoot = connector.settings.rootPath;
  if (typeof configuredRoot !== "string" || configuredRoot.trim() === "") {
    throw new ControlPlaneInputError(
      "Google inventory needs settings.rootPath pointing to the extracted Google export root before Anchise can inventory it."
    );
  }

  return normalizeRootPath(configuredRoot);
}

export async function probeGoogleExportStaging(
  connector: Connector,
  maxProbeFiles = 24
): Promise<GoogleExportProbeResult> {
  const rootPath = resolveGoogleExportRootPath(connector);
  await ensureReadableDirectory(rootPath, "Google export root");
  const sourceItems = await scanGoogleExportSource(rootPath, connector, maxProbeFiles);

  return {
    rootPath,
    detectedSourceItemCount: sourceItems.length,
    detectedCategories: [...new Set(sourceItems.map((item) => item.category))].sort((left, right) =>
      left.localeCompare(right)
    )
  };
}

const googleInventoryAdapter: InventoryAdapter = {
  async run({ connector, workspace }) {
    const rootPath = resolveGoogleExportRootPath(connector);
    await ensureReadableDirectory(rootPath, "Google export root");

    const sourceItems = await scanGoogleExportSource(rootPath, connector);
    if (sourceItems.length === 0) {
      throw new ControlPlaneInputError(
        `Anchise did not find supported Google export files under ${rootPath}. Point the connector to the extracted export folder and try again.`
      );
    }

    return buildInventoryResult(sourceItems, workspace, `google_export:${rootPath}`);
  }
};

const localHardwareInventoryAdapter: InventoryAdapter = {
  async run({ connector, workspace }) {
    const configuredRoot = connector.settings.rootPath;
    if (typeof configuredRoot !== "string" || configuredRoot.trim() === "") {
      throw new ControlPlaneInputError(
        "Local hardware inventory needs settings.rootPath so Anchise knows which local folder to inspect."
      );
    }

    const rootPath = normalizeRootPath(configuredRoot);
    await ensureReadableDirectory(rootPath, "Local source root");

    const maxFilesSetting = connector.settings.maxFiles;
    const maxFiles =
      typeof maxFilesSetting === "number" && Number.isInteger(maxFilesSetting) && maxFilesSetting > 0
        ? maxFilesSetting
        : 250;

    const sourceItems = await scanLocalSource(rootPath, maxFiles);
    if (sourceItems.length === 0) {
      throw new ControlPlaneInputError(
        `No files were found under ${rootPath}. Pick a folder with content before inventorying.`
      );
    }

    return buildInventoryResult(sourceItems, workspace, `local_filesystem:${rootPath}`);
  }
};

export function getInventoryAdapter(platform: Connector["platform"]): InventoryAdapter {
  if (platform === "google") {
    return googleInventoryAdapter;
  }

  return localHardwareInventoryAdapter;
}
