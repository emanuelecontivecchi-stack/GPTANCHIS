import type { Category } from "@anchise/contracts";

export interface GoogleBrowserLanePlan {
  sessionId: string;
  connectorId: string;
  loginMode: "manual_visible_browser";
  continueUrl: string;
  launchUrl: string;
  requestedCategories: Category[];
  preparedAt: string;
}

export interface GoogleExportHandoffPlan {
  connectorId: string;
  handoffUrl: string;
  exportRootPath: string;
  archiveExpectation: string;
  orchestrationSteps: string[];
  preparedAt: string;
}

function categoriesForInventoryProfile(profile: string | null | undefined): Category[] {
  switch (profile) {
    case "space_warning":
      return ["mail", "files"];
    case "google_core":
    default:
      return ["photos", "mail", "geolocation"];
  }
}

function continueUrlForCategories(categories: Category[]): string {
  const baseUrl = new URL("https://takeout.google.com/settings/takeout");
  baseUrl.searchParams.set("pli", "1");
  baseUrl.searchParams.set("anchors", categories.join(","));
  return baseUrl.toString();
}

export function createGoogleBrowserLanePlan(input: {
  connectorId: string;
  sessionId: string;
  inventoryProfile?: string | null;
}): GoogleBrowserLanePlan {
  const requestedCategories = categoriesForInventoryProfile(input.inventoryProfile);
  const continueUrl = continueUrlForCategories(requestedCategories);
  const launchUrl = new URL("https://accounts.google.com/ServiceLogin");
  launchUrl.searchParams.set("continue", continueUrl);
  launchUrl.searchParams.set("service", "wise");
  launchUrl.searchParams.set("passive", "1209600");
  launchUrl.searchParams.set("flowName", "GlifWebSignIn");

  return {
    sessionId: input.sessionId,
    connectorId: input.connectorId,
    loginMode: "manual_visible_browser",
    continueUrl,
    launchUrl: launchUrl.toString(),
    requestedCategories,
    preparedAt: new Date().toISOString()
  };
}

export function createGoogleExportHandoffPlan(input: {
  connectorId: string;
  exportRootPath: string;
  requestedCategories: Category[];
  handoffUrl?: string | null;
}): GoogleExportHandoffPlan {
  const handoffUrl =
    input.handoffUrl && input.handoffUrl.trim() !== ""
      ? input.handoffUrl
      : continueUrlForCategories(input.requestedCategories);
  const categorySummary = input.requestedCategories.join(", ");

  return {
    connectorId: input.connectorId,
    handoffUrl,
    exportRootPath: input.exportRootPath,
    archiveExpectation: "Google export archive or extracted Takeout folder",
    orchestrationSteps: [
      `Open the Google export page for ${categorySummary}.`,
      "Verify the selected categories and create the export in the visible browser lane.",
      `Save the archive into ${input.exportRootPath}, or extract the download there if it lands elsewhere first.`,
      "Keep the exported files inside the watch folder so Anchise can detect them and auto-start inventory."
    ],
    preparedAt: new Date().toISOString()
  };
}
