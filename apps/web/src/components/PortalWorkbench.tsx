"use client";

import { useState } from "react";

import { HeirPortalShell } from "./HeirPortalShell.js";
import { PartnerPortalShell } from "./PartnerPortalShell.js";

type Surface = "heir" | "partner";

const fullCaseCards = [
  {
    label: "Shared dossier",
    title: "CASE-10482 / HDB-NEUILLY-2026-0415",
    detail: "Jean Dupont / Sophie Martin / Service 2 + Service 1"
  },
  {
    label: "Current blocker",
    title: "3 pictures still missing",
    detail: "The passport packet is locked, but the biometric gate cannot close until the 5-picture set is complete."
  },
  {
    label: "Service 1 state",
    title: "Deposit pending, heir ID pending",
    detail: "POA and notoriete are already in; the order is still not fully confirmed."
  },
  {
    label: "Anchise space",
    title: "1.8 GB projected / 200 GB available",
    detail: "The staged family room stays under Anchise control until the full checklist turns green."
  }
] as const;

const fullCaseTimeline = [
  {
    label: "Partner side",
    title: "Borniol opened and locked the dossier",
    detail: "Case intake, passport lock, death certificate, and heir email are already in."
  },
  {
    label: "Heir side",
    title: "Sophie opened the secure invite",
    detail: "The family sees only the tasks that matter before activation."
  },
  {
    label: "Current live state",
    title: "Pictures 2 / 5, payment pending, activation blocked",
    detail: "Both surfaces now reflect the same blocker state for the same dossier."
  },
  {
    label: "Future state",
    title: "Automatic verification then activation",
    detail: "Once the full set and payment clear, Anchise can complete the dossier gate and release the real workspace."
  }
] as const;

const surfaceCopy: Record<Surface, { eyebrow: string; title: string; detail: string }> = {
  heir: {
    eyebrow: "Current build focus",
    title: "Heir experience",
    detail: "Sophie-facing flow from secure invite to password creation and live Anchise space."
  },
  partner: {
    eyebrow: "Current build focus",
    title: "Partner portal",
    detail: "Borniol-facing operations flow from dossier creation to release and activation."
  }
};

export function PortalWorkbench() {
  const [activeSurface, setActiveSurface] = useState<Surface>("heir");
  const activeCopy = surfaceCopy[activeSurface];

  return (
    <div className="prototype-switch-shell">
      <section className="prototype-switch-bar">
        <div className="prototype-switch-header">
          <div>
            <span>{activeCopy.eyebrow}</span>
            <strong>{activeCopy.title}</strong>
          </div>
          <p>{activeCopy.detail}</p>
        </div>
        <div className="prototype-switch-actions">
          <button
            type="button"
            className={`prototype-switch-button${activeSurface === "heir" ? " prototype-switch-button-active" : ""}`}
            onClick={() => setActiveSurface("heir")}
          >
            Heir side
          </button>
          <button
            type="button"
            className={`prototype-switch-button${activeSurface === "partner" ? " prototype-switch-button-active" : ""}`}
            onClick={() => setActiveSurface("partner")}
          >
            Partner side
          </button>
        </div>
      </section>

      <section className="full-case-board">
        <div className="prototype-switch-header">
          <div>
            <span>Full case</span>
            <strong>One dossier, two surfaces, one shared state</strong>
          </div>
          <p>
            The partner and heir prototypes below now follow the same memorial case from Borniol
            intake to Sophie activation.
          </p>
        </div>
        <div className="full-case-grid">
          {fullCaseCards.map((card) => (
            <article key={card.title} className="portal-intake-card">
              <span>{card.label}</span>
              <strong>{card.title}</strong>
              <p>{card.detail}</p>
            </article>
          ))}
        </div>
        <div className="wireframe-steps">
          {fullCaseTimeline.map((step, index) => (
            <article
              key={step.title}
              className={`wireframe-step ${index < 2 ? "wireframe-step-complete" : index === 2 ? "wireframe-step-current" : "wireframe-step-locked"}`}
            >
              <div className="wireframe-step-meta">
                <span>{step.label}</span>
                <strong>{step.title}</strong>
              </div>
              <p>{step.detail}</p>
            </article>
          ))}
        </div>
      </section>

      {activeSurface === "heir" ? <HeirPortalShell /> : <PartnerPortalShell />}
    </div>
  );
}
