"use client";

type ScreenId =
  | "heir-invite"
  | "heir-welcome"
  | "heir-upload"
  | "heir-service"
  | "heir-wait"
  | "heir-activate";

type TaskStatus = "done" | "pending" | "na";

type InteractionItem = {
  number: number;
  label: string;
  wireframe: string;
  target: ScreenId;
  detail: string;
};

type TimelineStep = {
  label: string;
  title: string;
  detail: string;
  tone: "complete" | "current" | "locked";
};

type DetailCard = {
  label: string;
  title: string;
  detail: string;
};

type ServiceTask = {
  label: string;
  detail: string;
  action: string;
  status: TaskStatus;
  target: ScreenId;
};

const interactionMap: ReadonlyArray<InteractionItem> = [
  {
    number: 1,
    label: "Open secure invite",
    wireframe: "Wireframe H1",
    target: "heir-invite",
    detail: "Email link into a temporary Anchise room"
  },
  {
    number: 2,
    label: "Review task board",
    wireframe: "Wireframe H2",
    target: "heir-welcome",
    detail: "See the case, requested services, and pending steps"
  },
  {
    number: 3,
    label: "Upload 5 pictures",
    wireframe: "Wireframe H3",
    target: "heir-upload",
    detail: "Home upload into Anchise-controlled staged space"
  },
  {
    number: 4,
    label: "Complete Service 1 extras",
    wireframe: "Wireframe H4",
    target: "heir-service",
    detail: "Online deposit and heir document uploads when needed"
  },
  {
    number: 5,
    label: "Waiting for verification",
    wireframe: "Wireframe H5",
    target: "heir-wait",
    detail: "Automatic match, payment, and dossier gate status"
  },
  {
    number: 6,
    label: "Activate Anchise space",
    wireframe: "Wireframe H6",
    target: "heir-activate",
    detail: "Choose a password only after the dossier is green"
  }
] as const;

const heirStatusPills = [
  "Lead heir: Sophie Martin",
  "Demo service: Service 2 + Service 1",
  "No full account before verification"
] as const;

const heirHighlights = [
  "One secure link instead of a full signup flow",
  "Exactly 5 pictures uploaded from home for Service 2",
  "100 EUR online only if Service 1 is part of the order",
  "Full Anchise access appears only after the dossier gate is green"
] as const;

const caseSummaryCards: ReadonlyArray<DetailCard> = [
  {
    label: "Case reference",
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
    detail: "Invite opened from sophie@email.com on April 15, 2026 at 14:18."
  },
  {
    label: "Current live blocker",
    title: "Waiting for the full 5-picture package",
    detail: "The passport packet is locked, but the case cannot move until Sophie finishes the home upload."
  },
  {
    label: "Services ordered",
    title: "Service 2 + Service 1",
    detail: "Picture unlock first, then Service 1 recovery tasks once payment and heir documents are complete."
  },
  {
    label: "Anchise staged space",
    title: "1.8 GB projected / 200 GB available",
    detail: "The family sees the projected footprint before larger transfers expand the dossier."
  }
];

const caseTimelineSteps: ReadonlyArray<TimelineStep> = [
  {
    label: "Completed",
    title: "Dossier opened and passport packet locked",
    detail: "Borniol entered the case, locked the passport, and attached the death certificate on April 15, 2026.",
    tone: "complete"
  },
  {
    label: "Completed",
    title: "Secure heir invite delivered and opened",
    detail: "Sophie opened the Anchise case link the same afternoon, so the heir-side room is now live.",
    tone: "complete"
  },
  {
    label: "Current",
    title: "Home pictures still in progress",
    detail: "2 of the 5 required memorial pictures are already in. 3 more are needed before the automatic match can run.",
    tone: "current"
  },
  {
    label: "Locked next",
    title: "Service 1 deposit and remaining heir packet",
    detail: "The 100 EUR online deposit and the last heir documents still need to be cleared for Service 1.",
    tone: "locked"
  },
  {
    label: "Locked next",
    title: "Automatic dossier verification",
    detail: "Anchise will compare the 5-picture set to the locked passport and then check the full dossier gate.",
    tone: "locked"
  },
  {
    label: "Locked next",
    title: "Anchise activation and password creation",
    detail: "The real family workspace appears only after every blocking item is green.",
    tone: "locked"
  }
];

const inviteCards: ReadonlyArray<DetailCard> = [
  {
    label: "From",
    title: "Anchise x Henri de Borniol",
    detail: "Sent by the Neuilly-sur-Seine branch after the passport packet was locked on April 15, 2026."
  },
  {
    label: "Subject",
    title: "Secure memorial upload for Jean Dupont - CASE-10482",
    detail: "No general account yet. The link opens only Sophie Martin's case-specific room."
  },
  {
    label: "Access window",
    title: "Temporary staged access until April 18, 2026",
    detail: "Only the required upload and payment tasks are visible at this stage."
  }
];

const welcomeCards: ReadonlyArray<DetailCard> = [
  {
    label: "Deceased dossier",
    title: "Jean Dupont",
    detail: "Passport and death certificate are already locked by Borniol."
  },
  {
    label: "Requested services",
    title: "Service 2 + Service 1",
    detail: "Service 2 needs 5 pictures. Service 1 adds the 100 EUR deposit and heir support documents."
  },
  {
    label: "Next action",
    title: "Finish the remaining 3 home pictures",
    detail: "2 of 5 pictures are already staged. The last 3 are the main blocker before automation can continue."
  },
  {
    label: "Reserved space",
    title: "Projected staged footprint: 1.8 GB / 200 GB",
    detail: "Anchise shows the expected size before bigger transfers expand the case."
  }
];

const welcomeRules = [
  "Anchise keeps this space under Anchise control until the dossier is fully approved.",
  "Only lightweight metadata and the required uploads appear first; the full workspace waits until activation.",
  "If the projected upload exceeded available space, Sophie would see the warning before the transfer begins.",
  "Duplicate content is not stored twice, and later imports continue incrementally from zero."
] as const;

const uploadRules = [
  "Upload exactly 5 clear pictures from home.",
  "At least one picture must show the same face quality needed for the passport comparison.",
  "No full memorial workspace is opened yet; this is a controlled upload room only.",
  "Submitting the 5th picture starts the automatic picture-to-passport and picture-to-picture checks."
] as const;

const uploadSlots: ReadonlyArray<DetailCard> = [
  {
    label: "Photo 1",
    title: "Received - primary face reference",
    detail: "Uploaded April 15, 2026 at 14:26. Good lighting and front-facing enough for the first pass."
  },
  {
    label: "Photo 2",
    title: "Received - secondary angle",
    detail: "Uploaded April 15, 2026 at 14:31. Useful for the cross-image consistency check."
  },
  {
    label: "Photo 3",
    title: "Missing",
    detail: "Still needed. A natural home image would strengthen the memorial identification set."
  },
  {
    label: "Photo 4",
    title: "Missing",
    detail: "Still needed. A closer portrait would improve confidence against the passport anchor."
  },
  {
    label: "Photo 5",
    title: "Missing",
    detail: "Still needed. The fifth upload is what triggers the automated comparison run."
  }
];

const serviceTasks: ReadonlyArray<ServiceTask> = [
  {
    label: "Acompte 100 EUR",
    detail: "Required online before the Service 1 order is considered confirmed.",
    action: "Pay now",
    status: "pending",
    target: "heir-service"
  },
  {
    label: "POA signee",
    detail: "Upload the signed power of attorney from home.",
    action: "View",
    status: "done",
    target: "heir-service"
  },
  {
    label: "Piece d'identite de l'heritiere",
    detail: "Upload the heir ID document needed for Service 1 handling.",
    action: "Upload",
    status: "pending",
    target: "heir-service"
  },
  {
    label: "Livret de famille / notoriete",
    detail: "Upload the supporting family authority document if applicable.",
    action: "View",
    status: "done",
    target: "heir-service"
  },
  {
    label: "Carte SIM remise a Borniol",
    detail: "Visible here for transparency, but handled physically with the partner.",
    action: "View note",
    status: "na",
    target: "heir-wait"
  }
];

const waitCards: ReadonlyArray<DetailCard> = [
  {
    label: "Upload status",
    title: "5 pictures received on April 15, 2026 at 16:04",
    detail: "Anchise now has the full home package and keeps it in staged space."
  },
  {
    label: "Payment status",
    title: "100 EUR online deposit confirmed at 16:08",
    detail: "This card appears because Service 1 is part of the same dossier."
  },
  {
    label: "Automation",
    title: "Passport and cross-picture comparison running at 16:09",
    detail: "The system compares the 5 pictures to the locked passport and to each other."
  },
  {
    label: "Case gate",
    title: "Waiting for final dossier green light",
    detail: "Activation still waits for the whole checklist, not the biometric lock alone."
  }
];

const waitRules = [
  "Sophie does not need to chase Borniol once the uploads and payment are complete.",
  "Normal passes continue automatically without another manual step from the heir.",
  "Only failed or ambiguous results come back for exception handling.",
  "The activation email is sent only after the dossier checklist is green."
] as const;

const activationCards: ReadonlyArray<DetailCard> = [
  {
    label: "Activation email",
    title: "Sent to sophie@email.com on April 16, 2026 at 09:14",
    detail: "No second sign-up form. The case email itself opens the activation step."
  },
  {
    label: "Password step",
    title: "Choose password on first visit",
    detail: "This is the first time Sophie creates credentials for Anchise."
  },
  {
    label: "Anchise space",
    title: "Memorial workspace unlocked for Sophie Martin",
    detail: "The staged room becomes the full family space only after approval."
  },
  {
    label: "Incremental storage",
    title: "Unique files only",
    detail: "Anchise continues from zero with incremental downloads and keeps no duplicate copies."
  }
];

const activationSteps = [
  "Open the activation email sent after the full dossier gate clears.",
  "Choose a password and enter the Anchise memorial workspace immediately.",
  "See the approved case materials in Anchise-controlled cloud space, not scattered across email threads.",
  "If Service 1 also produced recovered account leads, the follow-up can appear in the same workspace."
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

function StatusRow({
  label,
  status,
  action,
  target,
  helper
}: {
  label: string;
  status: TaskStatus;
  action: string;
  target: ScreenId;
  helper: string;
}) {
  const symbol = status === "done" ? "+" : status === "pending" ? "!" : "-";

  return (
    <div className="checklist-row">
      <div className="checklist-main">
        <span className={`checklist-dot checklist-dot-${status}`}>{symbol}</span>
        <div className="checklist-copy">
          <strong>{label}</strong>
          <p>{helper}</p>
        </div>
      </div>
      <button type="button" className="checklist-action-link" onClick={() => scrollTo(target)}>
        <span>{action}</span>
      </button>
    </div>
  );
}

export function HeirPortalShell() {
  return (
    <main className="heir-page">
      <section className="heir-brand-strip">
        <div className="heir-status-row">
          {heirStatusPills.map((item) => (
            <span key={item} className="heir-status-pill">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="heir-hero">
        <div className="heir-hero-copy">
          <span className="eyebrow partner-eyebrow">Anchise | Heir experience</span>
          <h1>A calm, one-link family flow for Sophie before the full Anchise account exists.</h1>
          <p>
            The heir side should feel one-click simple: receive the secure link, upload the home
            pictures, complete any Service 1 extras, wait while automation runs, then create a
            password only once the dossier is truly ready.
          </p>
        </div>
        <div className="heir-hero-note">
          <span>Experience principles</span>
          <strong>Simple for Sophie, controlled by Anchise, and cheap to operate until approval.</strong>
          <div className="heir-chip-row">
            {heirHighlights.map((item) => (
              <span key={item} className="heir-chip">
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="heir-map">
        <div className="partner-map-header">
          <div>
            <span className="eyebrow partner-eyebrow">Interaction Map</span>
            <h2>Every heir-side step has its own destination</h2>
          </div>
          <p>
            This flow starts with a secure invite and ends only when Sophie has a real Anchise
            password and a live memorial workspace.
          </p>
        </div>
        <div className="partner-map-grid">
          {interactionMap.map((item) => (
            <button
              key={item.number}
              type="button"
              className="partner-map-button heir-map-button"
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

      <section className="portal-screen partner-focus-screen">
        <div className="portal-screen-label">
          <span>Real case</span>
          <strong>CASE-10482 / Sophie Martin / Jean Dupont</strong>
        </div>
        <WireframeIntro
          number={0}
          copy="The six heir screens below are not abstract anymore. They now follow one concrete dossier as it moves from invite to activation."
        />
        <div className="portal-order-card">
          <span>Live dossier snapshot</span>
          <strong>One real heir case across time, with today's blockers clearly visible</strong>
          <div className="portal-intake-grid">
            {caseSummaryCards.map((card) => (
              <div key={card.title} className="portal-intake-card">
                <span>{card.label}</span>
                <strong>{card.title}</strong>
                <p>{card.detail}</p>
              </div>
            ))}
          </div>
          <div className="wireframe-steps">
            {caseTimelineSteps.map((step) => (
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

      <section id="heir-invite" className="portal-screen partner-focus-screen">
        <div className="portal-screen-label">
          <span>Wireframe H1</span>
          <strong>Secure invite email</strong>
        </div>
        <WireframeIntro
          number={1}
          copy="Button 1 is the first heir touchpoint. Sophie opens a case-specific invite, not a generic signup page."
        />
        <div className="portal-order-shell">
          <div className="portal-order-card">
            <span>Invite preview</span>
            <strong>The email opens a temporary Anchise room for this memorial dossier</strong>
            <div className="portal-intake-grid">
              {inviteCards.map((card) => (
                <div key={card.title} className="portal-intake-card">
                  <span>{card.label}</span>
                  <strong>{card.title}</strong>
                  <p>{card.detail}</p>
                </div>
              ))}
            </div>
            <div className="partner-toolbar-actions">
              <NumberedButton number={1} label="Open secure invite" target="heir-welcome" tone="primary" />
              <NumberedButton number={2} label="Review task board" target="heir-welcome" />
              <NumberedButton number={3} label="Upload 5 pictures" target="heir-upload" />
            </div>
          </div>

          <div className="portal-order-summary">
            <article className="portal-side-card heir-storage-card">
              <span>What Sophie gets first</span>
              <strong>A limited task room, not the full memorial workspace yet</strong>
              <ul className="portal-list">
                <li>Only the case tasks that matter now are visible.</li>
                <li>No extra email verification loop is required in the mock.</li>
                <li>The full Anchise account appears only after the dossier gate is green.</li>
              </ul>
            </article>
            <article className="portal-side-card">
              <span>Why this matters</span>
              <strong>Low friction for the family, controlled risk for Anchise</strong>
              <p>
                The heir sees a calm, direct action path while Anchise keeps the underlying cloud
                space staged, auditable, and under platform control.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section id="heir-welcome" className="portal-screen partner-focus-screen">
        <div className="portal-screen-label">
          <span>Wireframe H2</span>
          <strong>Heir task board</strong>
        </div>
        <WireframeIntro
          number={2}
          copy="Button 2 opens the heir dashboard: one place to understand the case, the requested service, the staged space, and the next required action."
        />
        <div className="portal-order-shell">
          <div className="portal-order-card">
            <span>Welcome Sophie</span>
            <strong>Review the memorial case before sending anything</strong>
            <div className="portal-intake-grid">
              {welcomeCards.map((card) => (
                <div key={card.title} className="portal-intake-card">
                  <span>{card.label}</span>
                  <strong>{card.title}</strong>
                  <p>{card.detail}</p>
                </div>
              ))}
            </div>
            <div className="partner-toolbar-actions">
              <NumberedButton number={3} label="Upload 5 pictures" target="heir-upload" tone="primary" />
              <NumberedButton number={4} label="Service 1 extras" target="heir-service" />
              <NumberedButton number={5} label="Waiting status" target="heir-wait" />
            </div>
          </div>

          <div className="portal-order-summary">
            <article className="portal-side-card heir-storage-card">
              <span>Anchise-controlled staged space</span>
              <strong>The family sees the shape of the space before the bigger uploads happen</strong>
              <ul className="portal-list">
                {welcomeRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </article>
            <article className="portal-side-card">
              <span>What is not unlocked yet</span>
              <strong>No full memorial account, no broad storage browser, no confusion</strong>
              <p>
                This task board deliberately stays narrow so Sophie can finish the critical actions
                without seeing the entire Anchise product too early.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section id="heir-upload" className="portal-screen partner-focus-screen">
        <div className="portal-screen-label">
          <span>Wireframe H3</span>
          <strong>Upload 5 pictures from home</strong>
        </div>
        <WireframeIntro
          number={3}
          copy="Button 3 is the main heir task. Sophie uploads exactly 5 pictures here, and the 5th upload triggers the automatic comparison."
        />
        <div className="portal-order-shell">
          <div className="portal-order-card">
            <span>Service 2 upload room</span>
            <strong>Collect the 5-picture memorial package in Anchise-controlled space</strong>
            <ul className="portal-list">
              {uploadRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <article className="portal-form-section">
              <span>Picture slots</span>
              <strong>Five uploads, each with a clear role in the automated check</strong>
              <div className="portal-form-grid">
                {uploadSlots.map((slot) => (
                  <div key={slot.title} className="portal-form-field">
                    <span>{slot.label}</span>
                    <strong>{slot.title}</strong>
                    <p>{slot.detail}</p>
                  </div>
                ))}
              </div>
            </article>
            <div className="partner-toolbar-actions">
              <NumberedButton number={2} label="Back to task board" target="heir-welcome" />
              <NumberedButton number={4} label="Service 1 extras" target="heir-service" />
              <NumberedButton number={5} label="Waiting status" target="heir-wait" tone="primary" />
            </div>
          </div>

          <div className="portal-order-summary">
            <article className="portal-side-card heir-storage-card">
              <span>Before the transfer</span>
              <strong>Projected upload size remains visible before Sophie commits</strong>
              <ul className="portal-list">
                <li>Projected upload now: 1.8 GB of the reserved 200 GB envelope.</li>
                <li>Anchise stores only new content hashes and ignores duplicates.</li>
                <li>The staged room can grow later, but the family sees the warning first.</li>
              </ul>
            </article>
            <article className="portal-side-card">
              <span>Automatic follow-on</span>
              <strong>The comparison starts without more family effort</strong>
              <p>
                Once the 5th picture lands, Anchise can immediately compare the set to the locked
                passport and to itself, then move the case toward activation if policy passes.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section id="heir-service" className="portal-screen partner-focus-screen">
        <div className="portal-screen-label">
          <span>Wireframe H4</span>
          <strong>Service 1 extras</strong>
        </div>
        <WireframeIntro
          number={4}
          copy="Button 4 is conditional. Sophie sees it only when Service 1 or 1.5 was selected alongside the memorial flow."
        />
        <div className="portal-order-shell">
          <div className="portal-order-card">
            <span>Conditional heir tasks</span>
            <strong>Online payment and heir documents for Service 1</strong>
            <article className="portal-side-card service-1-panel">
              <span>Visible in this demo</span>
              <strong>Service 2 + Service 1 means Sophie still has a few extra home tasks</strong>
              <div className="checklist-section">
                {serviceTasks.map((task) => (
                  <StatusRow
                    key={task.label}
                    label={task.label}
                    status={task.status}
                    action={task.action}
                    target={task.target}
                    helper={task.detail}
                  />
                ))}
              </div>
              <p className="checklist-note">
                The order becomes truly confirmed only after the online deposit and the required
                uploads are complete. Physical SIM handoff still stays with Borniol.
              </p>
            </article>
            <div className="partner-toolbar-actions">
              <NumberedButton number={3} label="Back to pictures" target="heir-upload" />
              <NumberedButton number={4} label="Stay on Service 1 extras" target="heir-service" />
              <NumberedButton number={5} label="Waiting status" target="heir-wait" tone="primary" />
            </div>
          </div>

          <div className="portal-order-summary">
            <article className="portal-side-card">
              <span>If Service 1 was not ordered</span>
              <strong>This panel disappears completely</strong>
              <p>
                For a Service 2-only case, Sophie would move from the picture upload directly into
                the waiting state without seeing payment or heir document requirements.
              </p>
            </article>
            <article className="portal-side-card">
              <span>Partner-managed items</span>
              <strong>Sophie sees the status, but does not have to understand the back office</strong>
              <p>
                Borniol and the founder keep ownership of the dossier logic; the heir view only
                exposes the exact actions the family must perform from home.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section id="heir-wait" className="portal-screen partner-focus-screen">
        <div className="portal-screen-label">
          <span>Wireframe H5</span>
          <strong>Waiting for verification</strong>
        </div>
        <WireframeIntro
          number={5}
          copy="Button 5 is the calm holding state: Sophie can see that uploads and payment are in, and Anchise is handling the rest."
        />
        <div className="portal-order-shell">
          <div className="portal-order-card">
            <span>Automatic review state</span>
            <strong>The family should feel informed without being pulled into the back office</strong>
            <div className="portal-intake-grid">
              {waitCards.map((card) => (
                <div key={card.title} className="portal-intake-card">
                  <span>{card.label}</span>
                  <strong>{card.title}</strong>
                  <p>{card.detail}</p>
                </div>
              ))}
            </div>
            <div className="partner-toolbar-actions">
              <NumberedButton number={3} label="Review uploads" target="heir-upload" />
              <NumberedButton number={4} label="Review Service 1 extras" target="heir-service" />
              <NumberedButton number={6} label="Go to activation" target="heir-activate" tone="primary" />
            </div>
          </div>

          <div className="portal-order-summary">
            <article className="portal-side-card heir-storage-card">
              <span>What happens automatically</span>
              <strong>Anchise now drives the sensitive steps</strong>
              <ul className="portal-list">
                {waitRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </article>
            <article className="portal-side-card">
              <span>If something fails</span>
              <strong>The family should receive one clear request, not a maze of statuses</strong>
              <p>
                In an exception path, Anchise should ask for only the missing item, such as a
                replacement picture, instead of exposing the entire internal checklist.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section id="heir-activate" className="portal-screen partner-focus-screen">
        <div className="portal-screen-label">
          <span>Wireframe H6</span>
          <strong>Activate Anchise space</strong>
        </div>
        <WireframeIntro
          number={6}
          copy="Button 6 is the first real account step. Sophie chooses a password only after the checklist and automation path have cleared."
        />
        <div className="portal-order-shell">
          <div className="portal-order-card">
            <span>Activation moment</span>
            <strong>From staged family room to full Anchise memorial workspace</strong>
            <div className="portal-intake-grid">
              {activationCards.map((card) => (
                <div key={card.title} className="portal-intake-card">
                  <span>{card.label}</span>
                  <strong>{card.title}</strong>
                  <p>{card.detail}</p>
                </div>
              ))}
            </div>
            <ul className="portal-list">
              {activationSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
            <div className="partner-toolbar-actions">
              <NumberedButton number={2} label="Back to task board" target="heir-welcome" />
              <NumberedButton number={5} label="Back to waiting" target="heir-wait" />
              <NumberedButton number={6} label="Create password" target="heir-activate" tone="primary" />
            </div>
          </div>

          <div className="portal-order-summary">
            <article className="portal-side-card heir-storage-card">
              <span>Anchise-controlled cloud space</span>
              <strong>The digital footprint now lives in one approved family workspace</strong>
              <ul className="portal-list">
                <li>The staged upload room graduates into the real memorial space.</li>
                <li>Unique files stay once; duplicates are still not stored twice.</li>
                <li>Later downloads can continue incrementally from nothing.</li>
              </ul>
            </article>
            <article className="portal-side-card heir-password-card">
              <span>First login principle</span>
              <strong>No extra complexity after the green light</strong>
              <p>
                Once the system is confident, Sophie should feel that the hard part is already
                behind her: open the email, choose the password, and enter Anchise.
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
