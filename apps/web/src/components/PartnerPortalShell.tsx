"use client";

type ScreenId =
  | "wf-login"
  | "wf-dashboard"
  | "wf-search"
  | "wf-intake"
  | "wf-retrieval"
  | "wf-pictures"
  | "wf-match"
  | "wf-release";

type ChecklistStatus = "done" | "pending" | "na";

type LiveCaseStep = {
  label: string;
  title: string;
  detail: string;
  tone: "complete" | "current" | "locked";
};

const interactionMap = [
  {
    number: 1,
    label: "Partner log in",
    wireframe: "Wireframe 1",
    target: "wf-login",
    detail: "Secure Borniol staff entry"
  },
  {
    number: 2,
    label: "Dashboard home",
    wireframe: "Wireframe 2",
    target: "wf-dashboard",
    detail: "Billing, cases, invites, and match queue"
  },
  {
    number: 3,
    label: "Search dossier",
    wireframe: "Wireframe 3",
    target: "wf-search",
    detail: "Find a deceased, heir, invoice, or document"
  },
  {
    number: 4,
    label: "Add new dossier",
    wireframe: "Wireframe 4",
    target: "wf-intake",
    detail: "Open the new memorial intake workflow"
  },
  {
    number: 5,
    label: "Dossier checklist",
    wireframe: "Wireframe 5",
    target: "wf-retrieval",
    detail: "Review completeness, payment, and supporting records"
  },
  {
    number: 6,
    label: "Request pictures",
    wireframe: "Wireframe 6",
    target: "wf-pictures",
    detail: "Send Sophie the secure Service 2 upload step"
  },
  {
    number: 7,
    label: "Run match review",
    wireframe: "Wireframe 7",
    target: "wf-match",
    detail: "Manual or biometric confirmation before release"
  },
  {
    number: 8,
    label: "Release Anchise invite",
    wireframe: "Wireframe 8",
    target: "wf-release",
    detail: "Issue the Anchise account only after approval"
  }
] as const;

const branchRibbon = [
  "PARIS 7E",
  "PARIS 8E",
  "PARIS 16E",
  "PARIS 17E",
  "NEUILLY-SUR-SEINE"
] as const;

const maisonHighlights = [
  "Prestige et reference des services funeraires depuis 1820",
  "Deux siecles d'excellence et de tradition",
  "Service de protocole et ceremonies officielles",
  "5 agences a Paris et Neuilly-sur-Seine"
] as const;

const maisonContacts = [
  "Prendre un rendez-vous en agence",
  "Demander un devis",
  "01 46 24 81 18"
] as const;

const dashboardMetrics = [
  {
    label: "Monthly billing",
    value: "$42.8K",
    detail: "12 invoices pending review"
  },
  {
    label: "Open memorial dossiers",
    value: "184",
    detail: "37 need Borniol action"
  },
  {
    label: "Identity match queue",
    value: "29",
    detail: "9 awaiting photo confirmation"
  },
  {
    label: "Heir invitations",
    value: "16",
    detail: "ready once matching clears"
  }
] as const;

const liveCaseCards = [
  {
    label: "Shared dossier",
    title: "CASE-10482 / HDB-NEUILLY-2026-0415",
    detail: "Opened by Borniol Neuilly-sur-Seine on April 15, 2026 at 09:22."
  },
  {
    label: "Deceased",
    title: "Jean Dupont",
    detail: "Born February 14, 1946 in Paris 16e. Died April 7, 2026 in Neuilly-sur-Seine."
  },
  {
    label: "Lead heir",
    title: "Sophie Martin / fille",
    detail: "Secure invite opened from sophie@email.com on April 15, 2026 at 14:18."
  },
  {
    label: "Live blocker",
    title: "3 pictures still missing",
    detail: "Only 2 of the required 5 Service 2 images are staged, so the biometric gate is still blocked."
  },
  {
    label: "Service 1 state",
    title: "100 EUR pending / heir ID pending",
    detail: "POA and notoriete are already in, but the order is not fully confirmed yet."
  },
  {
    label: "Anchise staged space",
    title: "1.8 GB projected / 200 GB available",
    detail: "The family sees the projected footprint before larger uploads expand the case."
  }
] as const;

const liveCaseTimeline: ReadonlyArray<LiveCaseStep> = [
  {
    label: "Completed",
    title: "Partner intake and passport lock finished",
    detail: "Passport packet, death certificate, core civil fields, and heir email are already in the dossier.",
    tone: "complete"
  },
  {
    label: "Completed",
    title: "Secure Sophie invite opened",
    detail: "The heir-side room is live, but it is still staged rather than a full Anchise account.",
    tone: "complete"
  },
  {
    label: "Current",
    title: "Pictures 2 / 5 and Service 1 still incomplete",
    detail: "The 100 EUR deposit and heir ID are still pending, and Sophie still owes 3 of the 5 memorial pictures.",
    tone: "current"
  },
  {
    label: "Locked next",
    title: "Automatic match and full checklist gate",
    detail: "The biometric pass only runs fully once the fifth picture lands, and release still depends on the whole checklist.",
    tone: "locked"
  }
] as const;

const dossierRows = [
  {
    caseId: "CASE-10482",
    service: "Service 2 + Service 1 / real live dossier",
    deceased: "Jean Dupont",
    heir: "Sophie Martin",
    status: "3 pictures still missing",
    updated: "Apr 15, 14:31",
    tone: "warning"
  },
  {
    caseId: "CASE-10467",
    service: "Service 1 recovery dossier",
    deceased: "Marguerite Rossi",
    heir: "Luca Rossi",
    status: "Invite ready",
    updated: "Today",
    tone: "ready"
  },
  {
    caseId: "CASE-10431",
    service: "Memorial intake",
    deceased: "Antoine Bernard",
    heir: "Claire Bernard",
    status: "Certificate missing",
    updated: "Yesterday",
    tone: "hold"
  }
] as const;

const searchFilters = [
  "Dossier number",
  "Deceased name",
  "Lead heir email",
  "Invoice reference",
  "Document type"
] as const;

const searchResults = [
  {
    label: "Best match",
    title: "CASE-10482 / Jean Dupont / Sophie Martin",
    detail: "2 of 5 pictures uploaded - 100 EUR deposit still pending"
  },
  {
    label: "Secondary match",
    title: "CASE-09931 / Jean Dupond / family archive",
    detail: "Prior family archive file from 2024"
  },
  {
    label: "Related billing",
    title: "PAY-10482 / Sophie Martin",
    detail: "100 EUR link issued - unpaid as of April 15, 2026"
  }
] as const;

const intakeFlowSteps = [
  {
    label: "Step 1",
    title: "Borniol opens the dossier shell",
    detail: "Create the case with service type, case reference, deceased identity data, and the lead heir email."
  },
  {
    label: "Step 2",
    title: "Borniol uploads and locks the passport packet",
    detail: "Lock the deceased passport as the anchor document, together with the death certificate and the required civil-record fields."
  },
  {
    label: "Step 3",
    title: "Anchise sends Sophie the home upload step",
    detail: "The secure link was sent at 14:15 on April 15, 2026, and Sophie opened it three minutes later."
  },
  {
    label: "Step 4",
    title: "Automations take over after Sophie uploads",
    detail: "The 5 pictures will be compared to the passport and to each other, then unlock and email actions will run automatically if policy passes."
  }
] as const;

const intakeNecessary = [
  "Service requested",
  "Dossier reference",
  "Passport of deceased",
  "Death certificate",
  "Full legal name of deceased",
  "Date and place of birth of deceased",
  "Date and place of death of deceased",
  "Last known address of deceased",
  "Lead heir email",
  "Borniol lock on the passport packet"
] as const;

const intakeDesirable = [
  "Heir passport and full profile upfront, if Borniol already has it",
  "Additional heirs or secondary contact details",
  "Service notes, billing reference, and partner comments",
  "Preferred language or family communication notes",
  "Recovered email list metadata for Service 1, if available",
  "Reference portrait that may help later picture matching"
] as const;

const serviceSelectionCards = [
  {
    label: "Standard path",
    title: "Service 2",
    detail: "Biometric picture unlock after Sophie uploads 5 pictures from home.",
    state: "Available"
  },
  {
    label: "Optional add-on",
    title: "Service 1 / 1.5",
    detail: "Adds mobile recovery prerequisites, online deposit, and heir support documents.",
    state: "Available"
  },
  {
    label: "Demo selection",
    title: "Service 2 + Service 1",
    detail: "Selected for CASE-10482 so Borniol can see the full memorial and recovery checklist together.",
    state: "Selected in this live case",
    selected: true
  }
] as const satisfies ReadonlyArray<{
  label: string;
  title: string;
  detail: string;
  state: string;
  selected?: boolean;
}>;

const borniolFormSections = [
  {
    label: "Borniol input block A",
    title: "Open the dossier",
    detail: "This is the first real partner form. Borniol types this before any family upload begins.",
    fields: [
      {
        label: "Service selection",
        value: "Service 2 + Service 1",
        helper: "The chosen service controls the checklist and automations that follow."
      },
      {
        label: "Dossier reference",
        value: "CASE-10482 / HDB-NEUILLY-2026-0415",
        helper: "Internal memorial dossier number for the agency, founder handoff, and heir-side invite."
      },
      {
        label: "Lead heir email",
        value: "sophie@email.com",
        helper: "Used later for the secure upload link and Anchise activation email."
      },
      {
        label: "Derniere adresse connue",
        value: "12 rue Perronet, Neuilly-sur-Seine",
        helper: "Mandatory base dossier field before any case can move."
      }
    ]
  },
  {
    label: "Borniol input block B",
    title: "Civil identity of the deceased",
    detail: "These are the core identity fields visible in the checklist and founder packet.",
    fields: [
      {
        label: "Nom legal complet",
        value: "Jean Dupont",
        helper: "Must match the passport and death certificate."
      },
      {
        label: "Date + lieu de naissance",
        value: "14 Feb 1946 - Paris 16e",
        helper: "Required base identity field."
      },
      {
        label: "Date + lieu de deces",
        value: "7 Apr 2026 - Neuilly-sur-Seine",
        helper: "Paired with the death certificate inside the dossier."
      },
      {
        label: "Heir record",
        value: "Sophie Martin / fille",
        helper: "Capture heir identity where applicable, even if only the email is mandatory at opening."
      }
    ]
  },
  {
    label: "Borniol input block C",
    title: "Locked base packet and uploads",
    detail: "These uploads happen in the intake itself. Existing records are only supporting evidence.",
    fields: [
      {
        label: "Passeport du defunt",
        value: "Upload JPG/PDF + verrou Borniol",
        helper: "Anchor document for the automated picture comparison."
      },
      {
        label: "Acte de deces",
        value: "Upload PDF",
        helper: "Mandatory supporting document in every dossier."
      },
      {
        label: "Archives ou notes deja en main",
        value: "Optional attachment",
        helper: "Helpful if Borniol already has them, but not a primary workflow by themselves."
      },
      {
        label: "Commentaires operateur",
        value: "Invite opened; 2 / 5 pictures received",
        helper: "Live operations note shared with founder context and agency continuity."
      }
    ]
  },
  {
    label: "Conditional block",
    title: "Additional Service 1 prerequisites",
    detail: "These appear only when the selected service includes Service 1 or 1.5.",
    fields: [
      {
        label: "Contrat mobile au nom du defunt",
        value: "Verification required",
        helper: "Blocking item before Service 1 can proceed."
      },
      {
        label: "Acompte 100 EUR",
        value: "Link sent, still unpaid",
        helper: "The order is confirmed only after payment and successful picture upload."
      },
      {
        label: "Carte SIM remise a Borniol",
        value: "Not yet received",
        helper: "Tracked in the same dossier, not in a separate document-heavy route."
      },
      {
        label: "POA + ID + notoriete",
        value: "POA + notoriete in / heir ID pending",
        helper: "Heir support packet is partly complete, but the ID upload is still missing."
      }
    ]
  }
] as const satisfies ReadonlyArray<{
  label: string;
  title: string;
  detail: string;
  fields: ReadonlyArray<{
    label: string;
    value: string;
    helper: string;
  }>;
}>;

const serviceOnePanelRows = [
  {
    label: "Contrat mobile au nom du defunt",
    detail: "Verifier que la ligne existe bien au nom du defunt.",
    action: "Cocher",
    status: "done"
  },
  {
    label: "Acompte 100 EUR",
    detail: "Paiement en ligne uniquement. Le dossier n'est confirme qu'apres paiement.",
    action: "Encaisser",
    status: "pending"
  },
  {
    label: "Carte SIM du defunt",
    detail: "Recue a Borniol avant la transmission au fondateur ?",
    action: "Cocher",
    status: "pending"
  },
  {
    label: "POA signee par l'heritiere",
    detail: "Upload de la procuration signee le 15 avril 2026 a 14:42.",
    action: "Voir",
    number: 10,
    status: "done"
  },
  {
    label: "Piece d'identite de l'heritiere",
    detail: "Upload du document d'identite.",
    action: "Televerser",
    number: 11,
    status: "pending"
  },
  {
    label: "Livret de famille / acte de notoriete",
    detail: "Document support deja televerse par Sophie.",
    action: "Voir",
    number: 12,
    status: "done"
  }
] as const satisfies ReadonlyArray<{
  label: string;
  detail: string;
  action: string;
  status: ChecklistStatus;
  number?: number;
}>;

const borniolTouchpoints = [
  "Type the deceased case data and choose the requested service.",
  "Record the last known address and the lead heir email at dossier opening.",
  "Upload and lock the deceased passport packet.",
  "Attach the death certificate and any support records already in hand.",
  "Set Sophie as the lead heir contact so Anchise can send the home upload link."
] as const;

const sophieTouchpoints = [
  "Receive the secure upload link at home.",
  "Upload the remaining 3 of the 5 required pictures from home.",
  "Wait while Anchise compares the finished 5-picture set to the locked passport and to each other.",
  "Receive the automated follow-up email once the policy checks pass."
] as const;

const baseChecklistRows = [
  {
    label: "Nom legal complet",
    status: "done",
    action: "Voir"
  },
  {
    label: "Date + lieu de naissance",
    status: "done",
    action: "Voir"
  },
  {
    label: "Date + lieu de deces",
    status: "done",
    action: "Voir"
  },
  {
    label: "Derniere adresse connue",
    status: "done",
    action: "Voir"
  },
  {
    label: "Email heritier",
    status: "done",
    action: "Voir"
  },
  {
    label: "Passeport du defunt",
    status: "done",
    action: "Voir"
  },
  {
    label: "Acte de deces",
    status: "done",
    action: "Voir"
  },
  {
    label: "Verrou biometrique",
    status: "pending",
    action: "Suivre"
  }
] as const satisfies ReadonlyArray<{
  label: string;
  status: ChecklistStatus;
  action: string;
}>;

const serviceOneChecklistRows = [
  {
    label: "Contrat mobile au nom du defunt",
    status: "done",
    action: "Voir"
  },
  {
    label: "Acompte 100 EUR encaisse",
    status: "pending",
    action: "Encaisser"
  },
  {
    label: "Solde 400 EUR programme sur succes",
    status: "na",
    action: "Programmer"
  },
  {
    label: "Carte SIM remise a Borniol",
    status: "pending",
    action: "Cocher"
  },
  {
    label: "POA signee par l'heritiere",
    status: "done",
    action: "Voir"
  },
  {
    label: "Piece d'identite de l'heritiere",
    status: "pending",
    action: "Televerser"
  }
] as const satisfies ReadonlyArray<{
  label: string;
  status: ChecklistStatus;
  action: string;
}>;

const retrievalItems = [
  "The checklist remains the primary operating surface for the case.",
  "Only the passport, death certificate, and already-available records are attached here.",
  "For CASE-10482, the live blocker is still the missing 3 pictures and the unpaid 100 EUR deposit."
] as const;

const retrievalSources = [
  {
    label: "Base packet",
    title: "Passeport du defunt + acte de deces",
    detail: "Attached during intake at 09:22 on April 15, 2026 and always visible in the dossier."
  },
  {
    label: "Partner archive",
    title: "Prior memorial notes or family archive",
    detail: "Neuilly branch note attached: invite opened and 2 pictures already staged."
  },
  {
    label: "Anchise vault",
    title: "Invite package capacity preview",
    detail: "Projected case footprint remains 1.8 GB under the 200 GB staged envelope."
  }
] as const;

const serviceTwoChecklist = [
  "Sophie must upload exactly 5 pictures from home for Service 2.",
  "For CASE-10482, 2 pictures are already staged and 3 more are still required.",
  "No Anchise space is issued to Sophie before the automated picture-to-passport lock succeeds and the checklist gate is green."
] as const;

const uploadMilestones = [
  {
    label: "Passport lock",
    title: "Locked on April 15, 2026 at 09:22",
    detail: "This is the reference document for the future automated match."
  },
  {
    label: "Secure upload link",
    title: "Sent at 14:15, opened at 14:18",
    detail: "The link opens a limited heir flow, not a full Anchise account."
  },
  {
    label: "5-picture upload",
    title: "2 / 5 pictures received so far",
    detail: "The automated comparison remains blocked until Sophie finishes the remaining 3 uploads."
  }
] as const;

const matchChecks = [
  "Compare each of the 5 uploaded pictures to the locked passport photo",
  "Compare the 5 uploaded pictures against each other for consistency",
  "If the passport and the 5 uploads are consistent, the case locks automatically",
  "Only failed or ambiguous cases route back to Borniol for exception handling"
] as const;

const matchSignals = [
  {
    label: "Passport anchor",
    title: "Locked by Borniol",
    detail: "The automation uses the passport as the non-negotiable identity reference."
  },
  {
    label: "5-photo consensus",
    title: "Blocked until the 5-picture set is complete",
    detail: "Only 2 of 5 required pictures are currently staged for CASE-10482."
  },
  {
    label: "Auto lock result",
    title: "Still waiting, not failed",
    detail: "This case is blocked by missing inputs, not by a biometric mismatch."
  }
] as const;

const onboardingSteps = [
  "The founder handoff and Sophie activation email happen only when the dossier checklist is green.",
  "For CASE-10482, the remaining 3 pictures and the 100 EUR deposit still block that release.",
  "Sophie sets her password and enters Anchise immediately once the email flow completes."
] as const;

const releaseChecks = [
  {
    label: "Case email",
    title: "sophie@email.com",
    detail: "This is the address reserved for the eventual automatic Sophie activation flow."
  },
  {
    label: "Service 1 branch",
    title: "Deposit + heir ID still pending",
    detail: "Release remains blocked until the online payment and the missing heir ID are in."
  },
  {
    label: "Account action",
    title: "Activation email queued, not yet sent",
    detail: "Sophie will choose a password only after the dossier turns fully green."
  }
] as const;

const automationLane = [
  {
    label: "Auto trigger",
    title: "Still waiting for 3 pictures + 100 EUR payment",
    detail: "The workflow fully wakes up only once the locked passport packet exists, the 5-picture upload succeeds, and the online payment is confirmed."
  },
  {
    label: "Auto match",
    title: "Passport and 5-picture comparison runs",
    detail: "Anchise compares the 5 uploaded pictures to the passport and to each other automatically once the package is complete."
  },
  {
    label: "Auto checklist gate",
    title: "Complete dossier checklist turns green",
    detail: "The case only becomes transmittable when every checklist item is green except the 400 EUR success balance."
  },
  {
    label: "Auto email",
    title: "Founder handoff + conditional Sophie email",
    detail: "If Service 1 applies, Anchise checks for the recovered email list and then sends the founder transmission and Sophie email automatically."
  }
] as const;

function scrollTo(sectionId: ScreenId) {
  const target = document.getElementById(sectionId);

  if (!target) {
    return;
  }

  window.history.replaceState(null, "", `#${sectionId}`);
  target.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function NumberedButton({
  number,
  label,
  target,
  tone = "secondary"
}: {
  number: number;
  label: string;
  target: ScreenId;
  tone?: "primary" | "secondary";
}) {
  return (
    <button type="button" className={`partner-action-button ${tone}`} onClick={() => scrollTo(target)}>
      <span className="partner-blue-circle">{number}</span>
      <span className="partner-action-copy">
        <strong>{label}</strong>
      </span>
    </button>
  );
}

function WireframeIntro({
  number,
  copy
}: {
  number: number;
  copy: string;
}) {
  return (
    <div className="partner-wireframe-intro">
      <span className="partner-blue-circle">{number}</span>
      <p>{copy}</p>
    </div>
  );
}

function ChecklistRow({
  label,
  status,
  action,
  target,
  helper,
  number
}: {
  label: string;
  status: ChecklistStatus;
  action: string;
  target: ScreenId;
  helper?: string;
  number?: number;
}) {
  const symbol = status === "done" ? "✓" : status === "pending" ? "•" : "—";

  return (
    <div className="checklist-row">
      <div className="checklist-main">
        <span className={`checklist-dot checklist-dot-${status}`}>{symbol}</span>
        <div className="checklist-copy">
          <strong>{label}</strong>
          {helper ? <p>{helper}</p> : null}
        </div>
      </div>
      <button type="button" className="checklist-action-link" onClick={() => scrollTo(target)}>
        {number ? <span className="partner-blue-circle checklist-number">{number}</span> : null}
        <span>{action}</span>
      </button>
    </div>
  );
}

export function PartnerPortalShell() {
  return (
    <main className="partner-page">
      <section className="partner-brand-strip">
        <div className="partner-branch-row">
          {branchRibbon.map((branch) => (
            <span key={branch} className="partner-branch-pill">
              {branch}
            </span>
          ))}
        </div>
        <div className="partner-contact-row">
          {maisonContacts.map((item) => (
            <span key={item} className="partner-contact-pill">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="partner-hero">
        <div className="partner-hero-copy">
          <span className="eyebrow partner-eyebrow">Maison Henri de Borniol | Bureau Partenaire</span>
          <h1>Partner operations aligned with the prestige, tradition, and protocol of Henri de Borniol.</h1>
          <p>
            This portal keeps the internal workflow grounded in the same visual language as the
            public Maison: high-touch service, protocol discipline, and a refined agency network.
          </p>
        </div>
        <div className="partner-hero-note">
          <span>Maison cues</span>
          <strong>French excellence, ceremonial protocol, and agency-level discretion.</strong>
          <div className="partner-maison-list">
            {maisonHighlights.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
        </div>
      </section>

      <section className="partner-map">
        <div className="partner-map-header">
          <div>
            <span className="eyebrow partner-eyebrow">Interaction Map</span>
            <h2>Every numbered button now has a dedicated destination</h2>
          </div>
          <p>
            Use the map as the master index. The portal screens below are ordered in the same flow
            Borniol staff would follow in real use.
          </p>
        </div>
        <div className="partner-map-grid">
          {interactionMap.map((item) => (
            <button
              key={item.number}
              type="button"
              className="partner-map-button"
              onClick={() => scrollTo(item.target)}
            >
              <span className="partner-blue-circle">{item.number}</span>
              <div className="partner-map-copy">
                <strong>{item.label}</strong>
                <span>{item.wireframe}</span>
                <p>{item.detail}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="prototype-heading">
        <span>Alignment Note</span>
        <strong>The wireflow now uses Henri de Borniol brand cues rather than a generic partner shell.</strong>
        <p>
          The clickable journey still runs from staff login through checklist-based release, but the
          outer shell now reflects the Maison's official positioning and branch identity.
        </p>
      </section>

      <section className="portal-screen partner-focus-screen">
        <div className="portal-screen-label">
          <span>Real case</span>
          <strong>CASE-10482 / Jean Dupont / Sophie Martin</strong>
        </div>
        <WireframeIntro
          number={0}
          copy="The partner portal below now follows the same live dossier as the heir side, including the current blockers and future release gate."
        />
        <div className="portal-order-card">
          <span>Live dossier snapshot</span>
          <strong>One Borniol case, one heir room, one shared state</strong>
          <div className="portal-intake-grid">
            {liveCaseCards.map((card) => (
              <div key={card.title} className="portal-intake-card">
                <span>{card.label}</span>
                <strong>{card.title}</strong>
                <p>{card.detail}</p>
              </div>
            ))}
          </div>
          <div className="wireframe-steps">
            {liveCaseTimeline.map((step) => (
              <article
                key={step.title}
                className={`wireframe-step ${
                  step.tone === "complete"
                    ? "wireframe-step-complete"
                    : step.tone === "current"
                      ? "wireframe-step-current"
                      : "wireframe-step-locked"
                }`}
              >
                <div className="wireframe-step-meta">
                  <span>{step.label}</span>
                  <strong>{step.title}</strong>
                </div>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="wf-login" className="portal-screen partner-focus-screen">
        <div className="portal-screen-label">
          <span>Wireframe 1</span>
          <strong>Partner portal log in</strong>
        </div>
        <WireframeIntro
          number={1}
          copy="Button 1 opens the Borniol staff entry point before any deceased or heir workflow begins."
        />
        <div className="portal-login-shell">
          <div className="portal-login-mark">
            <span>Maison Henri de Borniol | bureau partenaire</span>
            <h3>Reserved access to protocol-sensitive dossiers, heirs, and ceremonial records.</h3>
            <p>
              Henri de Borniol staff and authorized partners enter here first. Families never use
              this page; Sophie receives Anchise only once the dossier gate is green.
            </p>
            <div className="portal-chip-row">
              <span className="portal-chip">Email</span>
              <span className="portal-chip">Secret</span>
              <span className="portal-chip">Partner code</span>
            </div>
          </div>
          <div className="portal-login-panel">
            <div className="portal-field">
              <span>Partner email</span>
              <strong>name@borniol-partner.fr</strong>
            </div>
            <div className="portal-field">
              <span>Password</span>
              <strong>************</strong>
            </div>
            <div className="portal-field">
              <span>Partner code</span>
              <strong>ANCH-PRO-014</strong>
            </div>
            <div className="partner-button-row">
              <NumberedButton number={1} label="Log in" target="wf-dashboard" tone="primary" />
              <NumberedButton number={2} label="Dashboard home" target="wf-dashboard" />
            </div>
          </div>
        </div>
      </section>

      <section id="wf-dashboard" className="portal-screen partner-focus-screen">
        <div className="portal-screen-label">
          <span>Wireframe 2</span>
          <strong>Partner dashboard</strong>
        </div>
        <WireframeIntro
          number={2}
          copy="Button 2 lands on the command center for billing, overall cases, active invites, and the identity-match queue."
        />
        <div className="portal-dashboard-shell">
          <div className="portal-toolbar">
            <div className="portal-search">
              <span>Search dossier, deceased, heir, invoice, or document</span>
              <strong>Dossier 10482 / Jean Dupont / Sophie Martin / death certificate</strong>
            </div>
            <div className="partner-toolbar-actions">
              <NumberedButton number={3} label="Search dossier" target="wf-search" />
              <NumberedButton number={4} label="Add new dossier" target="wf-intake" tone="primary" />
              <NumberedButton number={5} label="Dossier checklist" target="wf-retrieval" />
            </div>
          </div>

          <div className="portal-metrics-grid">
            {dashboardMetrics.map((metric) => (
              <article key={metric.label} className="portal-metric">
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <p>{metric.detail}</p>
              </article>
            ))}
          </div>

          <div className="portal-dashboard-grid">
            <div className="portal-case-table">
              <div className="portal-table-head">
                <span>Overall memorial dossiers</span>
                <strong>Consult the active register of deceased and heirs</strong>
              </div>
              <div className="portal-case-scroll">
                {dossierRows.map((row) => (
                  <div key={row.caseId} className="portal-table-row">
                    <div>
                      <span>{row.caseId}</span>
                      <strong>{row.service}</strong>
                    </div>
                    <div>
                      <span>Deceased</span>
                      <strong>{row.deceased}</strong>
                    </div>
                    <div>
                      <span>Lead heir</span>
                      <strong>{row.heir}</strong>
                    </div>
                    <div>
                      <span>Status / last action</span>
                      <strong className={`portal-status portal-status-${row.tone}`}>{row.status}</strong>
                      <em className="portal-substatus">{row.updated}</em>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="portal-side-stack">
              <article className="portal-side-card">
                <span>Billing ledger</span>
                <strong>Invoices, approvals, and family-facing holds</strong>
                <p>
                  Billing remains visible in the same screen so Borniol can handle finance and
                  dossier review together.
                </p>
              </article>
              <article className="portal-side-card">
                <span>Next operator actions</span>
                <strong>Move directly into the case flow</strong>
                <div className="partner-button-column">
                  <NumberedButton number={3} label="Open search results" target="wf-search" />
                  <NumberedButton number={7} label="Open match review" target="wf-match" />
                  <NumberedButton number={8} label="Release invite" target="wf-release" />
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>

      <section id="wf-search" className="portal-screen partner-focus-screen">
        <div className="portal-screen-label">
          <span>Wireframe 3</span>
          <strong>Search dossier and open case</strong>
        </div>
        <WireframeIntro
          number={3}
          copy="Button 3 opens the search state, where Borniol finds the right dossier and then jumps into the checklist-driven case flow."
        />
        <div className="portal-order-shell">
          <div className="portal-case-table">
            <div className="portal-table-head">
              <span>Active filters</span>
              <strong>Search by case, person, document, or billing signal</strong>
            </div>
            {searchFilters.map((filter) => (
              <div key={filter} className="portal-field">
                <span>Filter</span>
                <strong>{filter}</strong>
              </div>
            ))}
            <div className="partner-toolbar-actions">
              <NumberedButton number={2} label="Dashboard home" target="wf-dashboard" />
              <NumberedButton number={5} label="Open dossier checklist" target="wf-retrieval" />
              <NumberedButton number={7} label="Run match review" target="wf-match" tone="primary" />
            </div>
          </div>

          <div className="portal-side-stack">
            <article className="portal-side-card">
              <span>Search results</span>
              <strong>Jean Dupont query package</strong>
              <ul className="portal-list">
                {searchResults.map((result) => (
                  <li key={result.title}>
                    <strong>{result.label}</strong>
                    {` ${result.title} - ${result.detail}`}
                  </li>
                ))}
              </ul>
            </article>
            <article className="portal-side-card">
              <span>Selected dossier</span>
              <strong>CASE-10482 ready for next step</strong>
              <p>
                CASE-10482 is the live memorial dossier. Borniol should land on the checklist, then
                push the remaining 3 pictures and the unpaid 100 EUR deposit instead of opening a
                second document-heavy workflow.
              </p>
              <div className="partner-button-column">
                <NumberedButton number={4} label="Edit dossier intake" target="wf-intake" />
                <NumberedButton number={6} label="Request pictures" target="wf-pictures" />
                <NumberedButton number={8} label="Release Anchise invite" target="wf-release" />
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="wf-intake" className="portal-screen partner-focus-screen">
        <div className="portal-screen-label">
          <span>Wireframe 4</span>
          <strong>New dossier intake</strong>
        </div>
        <WireframeIntro
          number={4}
          copy="Button 4 is where Borniol types the case and uploads the locked passport packet. Sophie does not upload here."
        />
        <div className="portal-order-shell">
          <div className="portal-order-card">
            <span>New memorial dossier</span>
            <strong>Guide the operator through required first, desirable second</strong>
            <div className="portal-flow-grid">
              {intakeFlowSteps.map((step) => (
                <article key={step.title} className="portal-flow-step">
                  <span>{step.label}</span>
                  <strong>{step.title}</strong>
                  <p>{step.detail}</p>
                </article>
              ))}
            </div>
            <article className="portal-side-card intake-priority-band">
              <span>Primary partner action</span>
              <strong>Borniol selects the service and builds the dossier packet here.</strong>
              <p>
                This intake is the main workflow. Existing records are only attached if already in
                hand; they are not the primary purpose of the portal.
              </p>
            </article>
            <div className="service-select-grid">
              {serviceSelectionCards.map((service) => (
                <article
                  key={service.title}
                  className={`service-select-card${"selected" in service && service.selected ? " service-select-card-selected" : ""}`}
                >
                  <span>{service.label}</span>
                  <strong>{service.title}</strong>
                  <p>{service.detail}</p>
                  <em>{service.state}</em>
                </article>
              ))}
            </div>
            <div className="portal-form-stack">
              {borniolFormSections.map((section) => (
                <article key={section.title} className="portal-form-section">
                  <span>{section.label}</span>
                  <strong>{section.title}</strong>
                  <p>{section.detail}</p>
                  <div className="portal-form-grid">
                    {section.fields.map((field) => (
                      <div key={field.label} className="portal-form-field">
                        <span>{field.label}</span>
                        <strong>{field.value}</strong>
                        <p>{field.helper}</p>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <div className="portal-intake-grid">
              <div className="portal-intake-card">
                <span>Necessary to create the dossier</span>
                <strong>Blocking inputs required before the case can move</strong>
                <ul className="portal-list portal-list-tight">
                  {intakeNecessary.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="portal-intake-card">
                <span>Desirable to accelerate the flow</span>
                <strong>Helpful data that improves later automation and review</strong>
                <ul className="portal-list portal-list-tight">
                  {intakeDesirable.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <article className="portal-side-card service-1-panel">
              <span>Pre-requis Service 1</span>
              <strong>Checklist addition when Service 1 / 1.5 / 1+1.5 is selected</strong>
              <div className="checklist-section">
                {serviceOnePanelRows.map((row) => (
                  <ChecklistRow
                    key={row.label}
                    label={row.label}
                    status={row.status}
                    action={row.action}
                    helper={row.detail}
                    number={"number" in row ? row.number : undefined}
                    target={"number" in row ? "wf-intake" : "wf-retrieval"}
                  />
                ))}
              </div>
              <p className="checklist-note">
                Le solde 400 EUR n'apparait pas ici car il est programme sur succes. Les paiements
                sont en ligne uniquement, et la commission partenaire reste visible au dashboard.
              </p>
            </article>
            <div className="partner-button-row intake-form-footer">
              <NumberedButton number={13} label="Enregistrer brouillon" target="wf-intake" />
              <NumberedButton number={14} label="Creer dossier & notifier" target="wf-retrieval" tone="primary" />
            </div>
          </div>

          <div className="portal-order-summary">
            <article className="portal-side-card">
              <span>Borniol touchpoints</span>
              <strong>This is the only place where Borniol should type and upload</strong>
              <ul className="portal-list">
                {borniolTouchpoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article className="portal-side-card">
              <span>Automation launch point</span>
              <strong>Once Borniol locks the passport, the rest can be system-driven</strong>
              <p>
                For CASE-10482 the link is already open on Sophie&apos;s side, but the automatic match is
                still blocked until the remaining 3 pictures and the 100 EUR payment arrive.
              </p>
              <div className="partner-button-column">
                <NumberedButton number={5} label="Open dossier checklist" target="wf-retrieval" />
                <NumberedButton number={6} label="Send picture request" target="wf-pictures" />
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="wf-retrieval" className="portal-screen partner-focus-screen">
        <div className="portal-screen-label">
          <span>Wireframe 5</span>
          <strong>Case checklist and support docs</strong>
        </div>
        <WireframeIntro
          number={5}
          copy="Button 5 opens the selected dossier checklist. Supporting documents live here too, but the case only moves forward when the full checklist turns green."
        />
        <div className="portal-order-shell">
          <div className="portal-order-card">
            <span>Dossier selectionne</span>
            <strong>CASE-10482 / Jean Dupont / Sophie Martin / Service 2 + Service 1</strong>
            <div className="portal-intake-grid">
              <div className="portal-intake-card">
                <span>Bio</span>
                <strong>En attente - 2 / 5 photos recues</strong>
                <p>Le bio-lock n'est pas encore lance car Sophie n'a pas termine le paquet de 5 images.</p>
              </div>
              <div className="portal-intake-card">
                <span>Checklist</span>
                <strong>9 / 14</strong>
                <p>Le dossier montre 7 items de base verts + contrat mobile et POA deja valides.</p>
              </div>
            </div>
            <article className="portal-side-card checklist-panel">
              <span>Checklist de completude</span>
              <strong>Transmission + activation email attendent la checklist complete</strong>
              <div className="checklist-section">
                <h4>Dossier de base (8 items)</h4>
                {baseChecklistRows.map((row) => (
                  <ChecklistRow
                    key={row.label}
                    label={row.label}
                    status={row.status}
                    action={row.action}
                    target={row.label === "Verrou biometrique" ? "wf-match" : "wf-intake"}
                  />
                ))}
              </div>
              <div className="checklist-section">
                <h4>Pre-requis Service 1 (6 items)</h4>
                {serviceOneChecklistRows.map((row) => (
                  <ChecklistRow
                    key={row.label}
                    label={row.label}
                    status={row.status}
                    action={row.action}
                    target={row.label === "Acompte 100 EUR encaisse" ? "wf-intake" : "wf-retrieval"}
                  />
                ))}
              </div>
              <p className="checklist-note">
                Transmission au fondateur + activation email a Sophie exigent toutes les cases en
                vert sauf le solde 400 EUR. La commande n'est confirmee qu'apres paiement en ligne
                et upload reussi des 5 photos.
              </p>
            </article>
            <div className="partner-toolbar-actions">
              <NumberedButton number={3} label="Search dossier" target="wf-search" />
              <NumberedButton number={4} label="Back to intake" target="wf-intake" />
              <NumberedButton number={6} label="Request pictures" target="wf-pictures" tone="primary" />
            </div>
          </div>

          <div className="portal-order-summary">
            <article className="portal-side-card">
              <span>Supporting records</span>
              <strong>Useful context, but secondary to dossier completeness</strong>
              <ul className="portal-list">
                {retrievalItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div className="portal-support-list">
                {retrievalSources.map((source) => (
                  <div key={source.title} className="portal-support-row">
                    <span>{source.label}</span>
                    <strong>{source.title}</strong>
                    <p>{source.detail}</p>
                  </div>
                ))}
              </div>
            </article>
            <article className="portal-side-card">
              <span>Decision rule</span>
              <strong>Bio-lock helps, but it does not by itself unlock the case</strong>
              <p>
                The dossier becomes transmittable only when the complete checklist is green. The
                400 EUR success balance is visible but non-blocking until success.
              </p>
              <div className="partner-button-column">
                <NumberedButton number={7} label="Run match review" target="wf-match" />
                <NumberedButton number={8} label="Release invite" target="wf-release" />
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="wf-pictures" className="portal-screen partner-focus-screen">
        <div className="portal-screen-label">
          <span>Wireframe 6</span>
          <strong>Request pictures from home</strong>
        </div>
        <WireframeIntro
          number={6}
          copy="Button 6 is Sophie-facing. For CASE-10482, Sophie has uploaded 2 of the 5 pictures, and the last 3 still block the automatic comparison."
        />
        <div className="portal-order-shell">
          <div className="portal-order-card">
            <span>Service 2 evidence package</span>
            <strong>Collect the remaining 3 of 5 pictures from the heir at home</strong>
            <ul className="portal-list">
              {serviceTwoChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="portal-intake-grid">
              {uploadMilestones.map((item) => (
                <div key={item.title} className="portal-intake-card">
                  <span>{item.label}</span>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
            <div className="partner-toolbar-actions">
              <NumberedButton number={4} label="Back to intake" target="wf-intake" />
              <NumberedButton number={5} label="Open dossier checklist" target="wf-retrieval" />
              <NumberedButton number={7} label="Run match review" target="wf-match" tone="primary" />
            </div>
          </div>

          <div className="portal-order-summary">
            <article className="portal-side-card">
              <span>Sophie touchpoints</span>
              <strong>This is the part Sophie completes from home</strong>
              <ul className="portal-list">
                {sophieTouchpoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article className="portal-side-card">
              <span>Release block</span>
              <strong>Pictures stay staged only until the automatic lock finishes</strong>
              <p>
                The current case is blocked by missing uploads, not by a failed biometric result. As
                soon as the fifth image arrives, the automated comparison can begin.
              </p>
              <div className="partner-button-column">
                <NumberedButton number={7} label="Open match review" target="wf-match" />
                <NumberedButton number={8} label="Go to release gate" target="wf-release" />
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="wf-match" className="portal-screen partner-focus-screen">
        <div className="portal-screen-label">
          <span>Wireframe 7</span>
          <strong>Match review</strong>
        </div>
        <WireframeIntro
          number={7}
          copy="Button 7 is mostly an automation monitor. For CASE-10482 it currently shows a blocked state because the 5-picture package is still incomplete."
        />
        <div className="portal-order-shell">
          <div className="portal-order-card">
            <span>Identity confirmation gate</span>
            <strong>Track the picture-to-document match gate</strong>
            <ul className="portal-list">
              {matchChecks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="portal-intake-grid">
              {matchSignals.map((signal) => (
                <div key={signal.title} className="portal-intake-card">
                  <span>{signal.label}</span>
                  <strong>{signal.title}</strong>
                  <p>{signal.detail}</p>
                </div>
              ))}
            </div>
            <div className="partner-toolbar-actions">
              <NumberedButton number={5} label="View dossier checklist" target="wf-retrieval" />
              <NumberedButton number={6} label="Request more pictures" target="wf-pictures" />
              <NumberedButton number={8} label="Release Anchise invite" target="wf-release" tone="primary" />
            </div>
          </div>

          <div className="portal-order-summary">
            <article className="portal-side-card">
              <span>Place du test dans le dossier</span>
              <strong>Le bio-lock est 1 case sur 14, pas la gate entiere</strong>
              <p>
                Anchise auto-run the comparison as soon as Sophie uploads, but the complete dossier
                checklist still governs transmission to the founder and the activation email.
              </p>
              <div className="partner-button-column">
                <NumberedButton number={23} label="Retour a la checklist complete" target="wf-retrieval" />
              </div>
            </article>
            <article className="portal-side-card">
              <span>Automation lane</span>
              <strong>What happens when the automated path is enabled</strong>
              <div className="portal-flow-grid automation-grid">
                {automationLane.map((step) => (
                  <article key={step.title} className="portal-flow-step">
                    <span>{step.label}</span>
                    <strong>{step.title}</strong>
                    <p>{step.detail}</p>
                  </article>
                ))}
              </div>
              <div className="partner-button-column">
                <NumberedButton number={8} label="Open release screen" target="wf-release" />
                <NumberedButton number={2} label="Return to dashboard" target="wf-dashboard" />
              </div>
            </article>
          </div>
        </div>
      </section>

      <section id="wf-release" className="portal-screen partner-focus-screen">
        <div className="portal-screen-label">
          <span>Wireframe 8</span>
          <strong>Release Anchise invite</strong>
        </div>
        <WireframeIntro
          number={8}
          copy="Button 8 is the release gate. For CASE-10482 the Sophie email is still queued, not sent, because the dossier is not fully green yet."
        />
        <div className="portal-order-shell">
          <div className="portal-order-card">
            <span>Release gate</span>
            <strong>Activation remains blocked until the live dossier clears</strong>
            <ul className="portal-list">
              {onboardingSteps.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="portal-intake-grid">
              {releaseChecks.map((item) => (
                <div key={item.title} className="portal-intake-card">
                  <span>{item.label}</span>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              ))}
            </div>
            <div className="partner-toolbar-actions">
              <NumberedButton number={2} label="Dashboard home" target="wf-dashboard" />
              <NumberedButton number={4} label="Add new dossier" target="wf-intake" />
              <NumberedButton number={8} label="Queue invite after green" target="wf-dashboard" tone="primary" />
            </div>
          </div>

          <div className="portal-order-summary">
            <article className="portal-side-card">
              <span>Automated outcome</span>
              <strong>Unlock and Sophie email will still be one automated event chain</strong>
              <p>
                Once CASE-10482 receives the missing 3 pictures, the 100 EUR deposit, and the heir
                ID, Anchise can unlock the case and send Sophie the correct email automatically.
              </p>
            </article>
            <article className="portal-side-card">
              <span>What Sophie will receive</span>
              <strong>A fresh Anchise email flow once the requested services are fully cleared</strong>
              <ul className="portal-list">
                {onboardingSteps.map((step) => (
                  <li key={step}>
                    {step}
                  </li>
                ))}
              </ul>
              <div className="partner-button-column">
                <NumberedButton number={2} label="Back to dashboard" target="wf-dashboard" />
                <NumberedButton number={3} label="Search another dossier" target="wf-search" />
              </div>
            </article>
            <article className="portal-side-card">
              <span>Partner continuity</span>
              <strong>The partner can return to operations immediately</strong>
              <div className="partner-button-column">
                <NumberedButton number={2} label="Back to dashboard" target="wf-dashboard" />
                <NumberedButton number={3} label="Search another dossier" target="wf-search" />
              </div>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
