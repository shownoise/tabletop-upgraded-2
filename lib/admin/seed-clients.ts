// Seed voor de 5 testklanten uit docs/kwaliteit/testklanten.md. Wordt via
// POST /api/admin/clients { seed: [...] } geladen wanneer de admin op
// "Testklanten inladen" klikt.

import type { AdminClient } from "./clients"

export const TESTKLANTEN_SEED: AdminClient[] = [
  {
    id: "test_onderwijs_zuid_kennemerland",
    name: "Stichting Onderwijs Zuid-Kennemerland",
    sector: "primair onderwijs — basisscholen",
    employees: 350,
    itArrangement:
      "Kantoor volledig in Microsoft 365. Leerlingadministratie (ParnasSys) in cloud. 2 NAS-servers per locatie. IT uitbesteed aan MSP (WestNet ICT) met 08:00–17:00 SLA + piket. Interne ICT-coördinator zonder security-mandaat.",
    crownJewels: "Leerlingdossiers (bijzondere persoonsgegevens), personeelsadministratie, financiële/RvT-documenten",
    crisisTeamRoles: ["ceo", "hr_lead", "it_manager", "legal"],
    regimeId: "nl_avg_nis2",
    isTestClient: true,
    notes: "Rollen NIET bezet: CISO, head_of_comms, cfo, ops_manager (bij bestuurder). Test: verzint wizard een CISO die er niet is?",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "test_vermeulen_metaal",
    name: "Vermeulen Metaal BV",
    sector: "metaalproductie — plaatbewerking + assemblage (defensie-toelevering)",
    employees: 120,
    itArrangement:
      "On-prem ERP (SAP Business One) met MRP-koppeling naar OT (CNC + robotcell). Kantoor in Microsoft 365. VPN naar hoofdvestiging. Cyberpartner op abonnement (piket). Geen dedicated CISO.",
    crownJewels: "Productieplanning + open orders (uur-stilstand ~€15k), CAD-tekeningen klanten (defensie-toelevering), personeelsadmin, financiële admin",
    crisisTeamRoles: ["ceo", "cfo", "ops_manager", "it_manager", "legal"],
    regimeId: "nl_avg_nis2",
    isTestClient: true,
    notes: "NIS2 belangrijke entiteit Annex II vervaardiging. Rollen NIET bezet: CISO, hr_lead (bij ops), head_of_comms (bij ceo). Test: OT/IT-convergentie in verhaal?",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "test_ggz_waterhof",
    name: "GGZ De Waterhof",
    sector: "ambulante geestelijke gezondheidszorg (jeugd + volwassenen)",
    employees: 480,
    itArrangement:
      "Hybride: EPD (User) in private cloud bij zorg-ISV, kantoor Microsoft 365, MFA verplicht sinds 2024, roosterplanning aparte SaaS. Externe MSP voor devices. Interne security-adviseur (0,4 fte).",
    crownJewels: "EPD (bijzondere persoonsgegevens categorie gezondheid), roosterplanning (crisisdienst), medicatievoorschriften, financiële admin",
    crisisTeamRoles: ["ceo", "ciso", "cfo", "legal", "head_of_comms", "hr_lead", "ops_manager", "it_manager"],
    regimeId: "nl_avg_nis2",
    isTestClient: true,
    notes: "Alle 8 rollen bezet. NEN 7510-gecertificeerd, IGJ-toezicht. Duurste kroonjuwelen (categorie gezondheid). Als wizard hier geen rijk dilemma produceert, ligt het niet aan de klant.",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "test_vandermeer_vermogensbeheer",
    name: "Van der Meer Vermogensbeheer",
    sector: "financiële dienstverlening — vermogensbeheer",
    employees: 68,
    itArrangement:
      "Volledig cloud (Microsoft 365 + portfolio-management SaaS + brokerage-platform). Extern SOC via MSSP 24/7. Zeer sterke identity (MFA + PAM + conditional access). Dedicated CISO. DORA-conform sinds jan 2025.",
    crownJewels: "Klantportefeuilles (transactiebevoegdheden), KYC/AML-dossiers, live orderplatform, klantcommunicatie",
    crisisTeamRoles: ["ceo", "ciso", "cfo", "legal", "head_of_comms", "hr_lead", "ops_manager", "it_manager"],
    regimeId: "nl_avg_nis2",
    isTestClient: true,
    notes: "AFM-vergunning, DORA (4u/24u/72u), NIS2 belangrijke entiteit financiële markten, MiFID II. DORA + AFM + NIS2 samen — kloppen de meldplichten?",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "test_cloudbrick",
    name: "Cloudbrick B.V.",
    sector: "IT-dienstverlening — MSP voor MKB",
    employees: 85,
    itArrangement:
      "Eigen SOC (16/5 + piket 24/7). PSA (Autotask) + RMM (Datto) multi-tenant. Volledig cloud + private hosting (TransIP, Leaseweb). Zeer sterke interne security.",
    crownJewels: "Klantomgevingen — privileged access naar 180 klanten (supply-chain-risico), klantendata in PSA/RMM, service-desk credentials, eigen source code",
    crisisTeamRoles: ["ceo", "ciso", "cfo", "legal", "hr_lead", "ops_manager", "it_manager"],
    regimeId: "nl_avg_nis2",
    isTestClient: true,
    notes: "NIS2 belangrijke entiteit ICT-dienstverlening. Rollen NIET bezet: head_of_comms. Compromise treft 180 klanten — test supply-chain scenarios en klantcommunicatie-cascade.",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]
