import type { ScenarioGraph } from "./types"
import { EYE_SECURITY_RETAINER } from "./types"

// Simple story — minimalistisch voorbeeld voor de opgeruimde builder.
// 3 rondes, elk met 1 situatie + 2-3 injects + 1 decision. Vier outcomes
// (afhankelijk van laatste decision). Gebruikt alleen de kern-velden die
// in de nieuwe builder-UI zichtbaar zijn: title, situation, timer, importance,
// visibility, targetRoles, outcomeVector, debrief-noot.

export function simpleStoryExample(): ScenarioGraph {
  const now = Date.now()
  const id = (p: string) => `${p}_${Math.random().toString(36).slice(2, 8)}`

  const startId = id("start")
  const r1 = id("round"), r2 = id("round"), r3 = id("round")
  const inj_r1a = id("inj"), inj_r1b = id("inj")
  const inj_r2a = id("inj"), inj_r2b = id("inj"), inj_r2c = id("inj")
  const inj_r3 = id("inj")
  const dec_r1 = id("dec"), dec_r2 = id("dec"), dec_r3 = id("dec")
  // Optie-ids expliciet zodat we edge-sourceHandles kunnen zetten voor branching.
  const opt_r1_a = "r1-retainer", opt_r1_b = "r1-wachten", opt_r1_c = "r1-isoleren"
  const opt_r2_a = "r2-melden",   opt_r2_b = "r2-wachten", opt_r2_c = "r2-melden-proactief"
  const opt_r3_a = "r3-herstel",  opt_r3_b = "r3-betalen", opt_r3_c = "r3-mix"
  const out_good = id("out"), out_mixed = id("out"), out_bad = id("out")

  return {
    id: id("graph"),
    name: "Ransomware — kleine story",
    version: 1,
    scenarioType: "ransomware_double_extortion",
    createdAt: now,
    updatedAt: now,
    irRetainerName: EYE_SECURITY_RETAINER.name,
    irRetainerProfile: EYE_SECURITY_RETAINER,
    nodes: [
      { id: startId, type: "start", position: { x: 40, y: 200 }, data: { kind: "start" } },

      // ── R1 — Detectie ──
      {
        id: r1, type: "round", position: { x: 200, y: 160 },
        data: {
          kind: "round",
          title: "R1 — Detectie",
          situation_update:
            "Om 03:00 op zondag ziet de MDR-provider verdachte activiteit op meerdere endpoints. " +
            "De scope is onduidelijk. Wachten tot ochtend of nu escaleren?",
          timerMinutes: 12,
        },
      },
      {
        id: inj_r1a, type: "inject", position: { x: 260, y: 380 },
        data: {
          kind: "inject",
          type: "alert", channel: "siem", urgency: "high",
          title: "MDR-alert — lateral movement",
          content: "MDR meldt encoded PowerShell op 3 endpoints + off-hours logins. Nog geen encryptie.",
          source: "MDR", senderName: "MDR SOC on-call",
          importance: "crucial",
        },
      },
      {
        id: inj_r1b, type: "inject", position: { x: 440, y: 380 },
        data: {
          kind: "inject",
          type: "internal", channel: "phone", urgency: "medium",
          title: "Servicedesk — vreemde bestandsextensies",
          content: "Twee medewerkers melden dat ze bestanden niet meer kunnen openen op de share.",
          source: "Servicedesk", senderName: "Servicedesk avond",
          importance: "crucial",
        },
      },
      {
        id: dec_r1, type: "decision", position: { x: 620, y: 160 },
        data: {
          kind: "decision",
          prompt: "Wat doe je nu?",
          measuredBy: "participant_choice",
          advancesGraph: false,
          options: [
            {
              id: opt_r1_a,
              label: "Bel de IR-retainer direct — nu escaleren",
              outcomeVector: { CONT: 2, FOR: 2, BC: 0, JUR: 0, VER: 1, KOS: -1 },
              lessonLearned: "24/7-retainer bestaat om 03:00 gebeld te worden. Snelheid + bewijsbehoud combineert.",
            },
            {
              id: opt_r1_b,
              label: "Wachten tot ochtend, intern beoordelen",
              outcomeVector: { CONT: -2, FOR: 0, BC: 1, JUR: -1, VER: 0, KOS: 0 },
              lessonLearned: "Wachten geeft de aanvaller uren voorsprong. Verspreiding blijft onopgemerkt.",
            },
            {
              id: opt_r1_c,
              label: "Alleen isoleren, retainer niet inschakelen",
              outcomeVector: { CONT: 1, FOR: -1, BC: -1, JUR: 0, VER: 0, KOS: 0 },
              lessonLearned: "Isolatie zonder forensiek verliest bewijs — melding wordt later moeilijker.",
            },
          ],
        },
      },

      // ── R2 — Exfiltratie ──
      {
        id: r2, type: "round", position: { x: 800, y: 160 },
        data: {
          kind: "round",
          title: "R2 — Exfiltratie",
          situation_update:
            "T+6u: forensiek bevestigt 400 GB uitgaand verkeer richting onbekende host. " +
            "Persoonsgegevens zitten daarbij. De losgeldnote is binnen.",
          timerMinutes: 15,
        },
      },
      {
        id: inj_r2a, type: "inject", position: { x: 860, y: 380 },
        data: {
          kind: "inject",
          type: "regulatory", channel: "email", urgency: "high",
          title: "Legal — AVG-klok tikt (72u)",
          content: "Persoonsgegevens exfiltreerd → AVG-melding binnen 72 uur verplicht. NIS2 24u early warning ook.",
          senderName: "Legal Counsel",
          importance: "crucial",
          targetRoles: ["legal"],
          visibility: "exclusive",
        },
      },
      {
        id: inj_r2b, type: "inject", position: { x: 1040, y: 380 },
        data: {
          kind: "inject",
          type: "executive", channel: "phone", urgency: "critical",
          title: "Ransom note — 5 BTC",
          content: "Aanvallers eisen 5 BTC binnen 48u. Bij niet-betaling: publicatie van 400 GB op leaksite.",
          senderName: "Onbekend",
          importance: "crucial",
        },
      },
      {
        id: inj_r2c, type: "inject", position: { x: 1220, y: 380 },
        data: {
          kind: "inject",
          type: "media", channel: "phone", urgency: "medium",
          title: "Journalist belt HR-lijn",
          content: "Vakblad-journalist vraagt of medewerkers naar huis zijn gestuurd. Wil binnen 2 uur reactie.",
          senderName: "Journalist NL-Cyber",
          importance: "info",
          targetRoles: ["hr_lead"],
          correctRoute: "head_of_comms",
          visibility: "exclusive",
        },
      },
      {
        id: dec_r2, type: "decision", position: { x: 1400, y: 160 },
        data: {
          kind: "decision",
          prompt: "Meldplicht + comms — wat doe je?",
          measuredBy: "participant_choice",
          advancesGraph: false,
          options: [
            {
              id: opt_r2_a,
              label: "NIS2 24u early warning + AP-melding voorbereiden",
              outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 2, VER: 1, KOS: -1 },
              lessonLearned: "Op tijd melden bouwt vertrouwen — de klok tikt tegen je.",
            },
            {
              id: opt_r2_b,
              label: "Wachten op scope, later melden",
              outcomeVector: { CONT: 0, FOR: 1, BC: 0, JUR: -2, VER: -1, KOS: 0 },
              lessonLearned: "Deadlines zijn hard. Te laat = boete + reputatieschade.",
            },
            {
              id: opt_r2_c,
              label: "Melden + proactieve verklaring voor pers",
              outcomeVector: { CONT: 0, FOR: 0, BC: 0, JUR: 2, VER: 2, KOS: -1 },
              lessonLearned: "Proactief communiceren neemt de wind uit de zeilen van speculatie.",
            },
          ],
        },
      },

      // ── R3 — Herstel of losgeld ──
      {
        id: r3, type: "round", position: { x: 1580, y: 160 },
        data: {
          kind: "round",
          title: "R3 — Herstel of losgeld",
          situation_update:
            "T+30u: backups zijn deels versleuteld. Herstel duurt naar schatting 4 dagen. " +
            "Aanvallers hebben deadline verlengd naar 72u.",
          timerMinutes: 15,
        },
      },
      {
        id: inj_r3, type: "inject", position: { x: 1640, y: 380 },
        data: {
          kind: "inject",
          type: "technical", channel: "teams", urgency: "high",
          title: "Backup-status",
          content: "Van 12 backup-sets zijn er 4 encrypted. Overige 8 zijn week-oud en getest.",
          senderName: "Backup lead",
          importance: "crucial",
        },
      },
      {
        id: dec_r3, type: "decision", position: { x: 1820, y: 160 },
        data: {
          kind: "decision",
          prompt: "Herstellen of betalen?",
          measuredBy: "participant_choice",
          advancesGraph: true,
          options: [
            {
              id: opt_r3_a,
              label: "Clean-room herbouw uit oude backups (4 dagen)",
              outcomeVector: { CONT: 2, FOR: 2, BC: -2, JUR: 1, VER: 1, KOS: -2 },
              lessonLearned: "Herstel duurt lang maar houdt onderhandelingspositie sterk.",
            },
            {
              id: opt_r3_b,
              label: "Betalen — snelste terugkeer naar productie",
              outcomeVector: { CONT: -1, FOR: 0, BC: 2, JUR: -2, VER: -2, KOS: -2 },
              lessonLearned: "Betaling geeft geen garantie én zet target op je rug. Zelden de winnende zet.",
            },
            {
              id: opt_r3_c,
              label: "Mix: onderhandelen + parallel herstellen",
              outcomeVector: { CONT: 1, FOR: 1, BC: 1, JUR: 0, VER: 0, KOS: -1 },
              lessonLearned: "Tijd kopen door onderhandeling geeft ademruimte voor forensiek + backup-restore.",
            },
          ],
        },
      },

      // ── Outcomes ──
      {
        id: out_good, type: "outcome", position: { x: 2020, y: 60 },
        data: {
          kind: "outcome",
          key: "goed",
          label: "Contained met integriteit",
          narrative:
            "Zes weken later blijkt de aanpak succesvol. Toezichthouder is tevreden met de meldingen; " +
            "klanten waarderen de proactieve communicatie. Herstel duurde langer maar bewijs is bruikbaar " +
            "voor politie-onderzoek. Aanvaller geïdentificeerd binnen 3 maanden.",
          lessonLearned: "Snelheid + integriteit + transparantie is het referentiepad.",
        },
      },
      {
        id: out_mixed, type: "outcome", position: { x: 2020, y: 220 },
        data: {
          kind: "outcome",
          key: "gemengd",
          label: "Gedeeltelijk succes",
          narrative:
            "Losgeld is betaald, systemen zijn snel terug. Maar 2 maanden later blijkt dat de sleutels " +
            "niet volledig werken — 15% van de data blijft weg. Klantvertrouwen daalt licht.",
          lessonLearned: "Betalen is een gok. Snelheid nu = tijd + geld verlies later.",
        },
      },
      {
        id: out_bad, type: "outcome", position: { x: 2020, y: 380 },
        data: {
          kind: "outcome",
          key: "slecht",
          label: "Cascaded failure",
          narrative:
            "Te laat gemeld, boete van 1,2% wereldwijde omzet. Persaandacht wekenlang. " +
            "Twee grote klanten stappen over. Aandeelhouders roepen extern advies in.",
          lessonLearned: "Deadlines zijn deadlines. Compliance eerst, dan techniek.",
        },
      },
    ],
    edges: [
      { id: id("e"), source: startId, target: r1, type: "sequence" },
      { id: id("e"), source: r1, target: inj_r1a, type: "inject" },
      { id: id("e"), source: r1, target: inj_r1b, type: "inject" },
      { id: id("e"), source: r1, target: dec_r1, type: "sequence" },
      { id: id("e"), source: dec_r1, target: r2, type: "sequence" },
      { id: id("e"), source: r2, target: inj_r2a, type: "inject" },
      { id: id("e"), source: r2, target: inj_r2b, type: "inject" },
      { id: id("e"), source: r2, target: inj_r2c, type: "inject" },
      { id: id("e"), source: r2, target: dec_r2, type: "sequence" },
      { id: id("e"), source: dec_r2, target: r3, type: "sequence" },
      { id: id("e"), source: r3, target: inj_r3, type: "inject" },
      { id: id("e"), source: r3, target: dec_r3, type: "sequence" },
      // Branching op dec_r3 — sourceHandle = optionId → 3 outcomes
      { id: id("e"), source: dec_r3, target: out_good,  sourceHandle: opt_r3_a, type: "branch" },
      { id: id("e"), source: dec_r3, target: out_mixed, sourceHandle: opt_r3_c, type: "branch" },
      { id: id("e"), source: dec_r3, target: out_bad,   sourceHandle: opt_r3_b, type: "branch" },
    ],
  }
}
