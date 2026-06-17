/**
 * SecurityIconInline.jsx
 * Variante inline: non richiede file SVG nella cartella public.
 * Utile se la tua web app salva le annotazioni in JSON con id icona.
 */

import React from "react";

export const SECURITY_ICON_META = [
  {
    "id": "police-post",
    "label": "Postazione Polizia",
    "category": "Operativo",
    "color": "#0057B8",
    "foreground": "#FFFFFF",
    "isoRef": null,
    "recommendedUse": "Punto fisso o mobile della polizia / responsabile ordine pubblico."
  },
  {
    "id": "fire-post",
    "label": "Postazione Pompieri",
    "category": "Operativo",
    "color": "#E30613",
    "foreground": "#FFFFFF",
    "isoRef": null,
    "recommendedUse": "Mezzo/presidio pompieri o accesso riservato ai soccorsi antincendio."
  },
  {
    "id": "ambulance-post",
    "label": "Postazione Ambulanza",
    "category": "Operativo",
    "color": "#006BB6",
    "foreground": "#FFFFFF",
    "isoRef": null,
    "recommendedUse": "Ambulanza, punto sanitario avanzato, percorso prioritario sanitario."
  },
  {
    "id": "emergency-exit",
    "label": "Uscita sicurezza",
    "category": "ISO 7010 / Safe condition",
    "color": "#00A651",
    "foreground": "#FFFFFF",
    "isoRef": "E001/E002 - DA VERIFICARE su licenza grafica",
    "recommendedUse": "Vie di fuga e uscite d'emergenza."
  },
  {
    "id": "first-aid",
    "label": "Primo soccorso",
    "category": "ISO 7010 / Safe condition",
    "color": "#00A651",
    "foreground": "#FFFFFF",
    "isoRef": "E003 - DA VERIFICARE su licenza grafica",
    "recommendedUse": "Punto primo soccorso o materiale sanitario."
  },
  {
    "id": "assembly-point",
    "label": "Punto di raccolta",
    "category": "ISO 7010 / Safe condition",
    "color": "#00A651",
    "foreground": "#FFFFFF",
    "isoRef": "E007 - DA VERIFICARE su licenza grafica",
    "recommendedUse": "Punto raccolta in caso di evacuazione."
  },
  {
    "id": "danger-warning",
    "label": "Pericolo / Attenzione",
    "category": "Warning",
    "color": "#FFD400",
    "foreground": "#111111",
    "isoRef": null,
    "recommendedUse": "Pericoli generici, aree sensibili, punti critici da presidiare."
  },
  {
    "id": "command-post",
    "label": "Posto comando",
    "category": "Coordinamento",
    "color": "#263238",
    "foreground": "#FFFFFF",
    "isoRef": null,
    "recommendedUse": "Direzione evento, capo impiego, centrale operativa, regia sicurezza."
  },
  {
    "id": "radio-channel",
    "label": "Radio / Canale operativo",
    "category": "Comunicazioni",
    "color": "#003C88",
    "foreground": "#FFFFFF",
    "isoRef": null,
    "recommendedUse": "Canale radio, check radio, punto comunicazioni."
  },
  {
    "id": "cctv",
    "label": "Videosorveglianza",
    "category": "Tecnico",
    "color": "#0B3A53",
    "foreground": "#FFFFFF",
    "isoRef": null,
    "recommendedUse": "Telecamere, punti ciechi, sorveglianza video."
  },
  {
    "id": "barrier",
    "label": "Transenna / Barriera",
    "category": "Perimetro",
    "color": "#F28C28",
    "foreground": "#FFFFFF",
    "isoRef": null,
    "recommendedUse": "Transenne, barriere, chiusure fisiche, canalizzazione flussi."
  },
  {
    "id": "gate-entrance",
    "label": "Entrata / Accesso",
    "category": "Accessi",
    "color": "#0057B8",
    "foreground": "#FFFFFF",
    "isoRef": null,
    "recommendedUse": "Entrata principale, varchi, controllo biglietti, checkpoint."
  },
  {
    "id": "vip-area",
    "label": "Area VIP",
    "category": "Aree speciali",
    "color": "#6A1B9A",
    "foreground": "#FFFFFF",
    "isoRef": null,
    "recommendedUse": "Area VIP, accessi premium, ospiti protetti."
  },
  {
    "id": "evacuation-route",
    "label": "Percorso evacuazione",
    "category": "Evacuazione",
    "color": "#00A651",
    "foreground": "#FFFFFF",
    "isoRef": null,
    "recommendedUse": "Direzioni di deflusso, percorso evacuazione, corridoi liberi."
  },
  {
    "id": "fire-extinguisher",
    "label": "Estintore",
    "category": "Antincendio",
    "color": "#E30613",
    "foreground": "#FFFFFF",
    "isoRef": null,
    "recommendedUse": "Estintori, materiale antincendio, punto intervento fuoco."
  },
  {
    "id": "aed",
    "label": "Defibrillatore AED",
    "category": "ISO 7010 / Safe condition",
    "color": "#00A651",
    "foreground": "#FFFFFF",
    "isoRef": "E010 - DA VERIFICARE su licenza grafica",
    "recommendedUse": "Defibrillatore automatico esterno."
  },
  {
    "id": "info-point",
    "label": "Info point",
    "category": "Pubblico",
    "color": "#1976D2",
    "foreground": "#FFFFFF",
    "isoRef": null,
    "recommendedUse": "Informazioni al pubblico, help desk, punto accoglienza."
  },
  {
    "id": "security-staff",
    "label": "Agente sicurezza",
    "category": "Personale",
    "color": "#263238",
    "foreground": "#FFFFFF",
    "isoRef": null,
    "recommendedUse": "Posizione agente, pattuglia, steward, presidio fisso."
  },
  {
    "id": "lost-child",
    "label": "Bambino smarrito",
    "category": "Pubblico / Safety",
    "color": "#F9A825",
    "foreground": "#111111",
    "isoRef": null,
    "recommendedUse": "Punto gestione minori smarriti o persone vulnerabili."
  },
  {
    "id": "restricted-area",
    "label": "Area vietata / Solo autorizzati",
    "category": "Accessi",
    "color": "#C62828",
    "foreground": "#FFFFFF",
    "isoRef": null,
    "recommendedUse": "Backstage, aree tecniche, accessi non autorizzati."
  },
  {
    "id": "traffic-control",
    "label": "Gestione traffico",
    "category": "Viabilità",
    "color": "#F57C00",
    "foreground": "#FFFFFF",
    "isoRef": null,
    "recommendedUse": "Deviazioni, controllo traffico, accesso veicoli soccorso."
  },
  {
    "id": "parking-emergency",
    "label": "Parcheggio mezzi soccorso",
    "category": "Viabilità",
    "color": "#0057B8",
    "foreground": "#FFFFFF",
    "isoRef": null,
    "recommendedUse": "Stallo riservato a polizia, pompieri, ambulanza o mezzi operativi."
  },
  {
    "id": "medical-room",
    "label": "Locale sanitario",
    "category": "Sanitario",
    "color": "#00A651",
    "foreground": "#FFFFFF",
    "isoRef": null,
    "recommendedUse": "Infermeria, sala medica, punto trattamento non pubblico."
  }
];

const ICON_BODIES = {
  "police-post": "    <path d=\"M32 13l16 6v10c0 10.5-6.5 18.2-16 22-9.5-3.8-16-11.5-16-22V19l16-6z\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M32 23l2.8 5.6 6.2.9-4.5 4.3 1.1 6.1L32 37l-5.6 2.9 1.1-6.1-4.5-4.3 6.2-.9L32 23z\" stroke-width=\"1.5\"/>",
  "fire-post": "    <rect x=\"13\" y=\"30\" width=\"32\" height=\"13\" rx=\"2\" stroke-width=\"3\" fill=\"none\"/>\n    <path d=\"M45 34h6l3 5v4h-9z\" fill=\"none\" stroke-width=\"3\"/>\n    <circle cx=\"22\" cy=\"46\" r=\"3\" fill=\"none\" stroke-width=\"3\"/>\n    <circle cx=\"45\" cy=\"46\" r=\"3\" fill=\"none\" stroke-width=\"3\"/>\n    <path d=\"M30 13c5 5 0 9 5 13 3-4 7 2 7 6 0 6-5 10-10 10s-10-4-10-10c0-6 6-9 8-19z\" stroke-width=\"1.5\"/>",
  "ambulance-post": "    <rect x=\"11\" y=\"28\" width=\"32\" height=\"14\" rx=\"2\" stroke-width=\"3\" fill=\"none\"/>\n    <path d=\"M43 32h7l4 5v5H43z\" fill=\"none\" stroke-width=\"3\"/>\n    <circle cx=\"21\" cy=\"46\" r=\"3\" fill=\"none\" stroke-width=\"3\"/>\n    <circle cx=\"45\" cy=\"46\" r=\"3\" fill=\"none\" stroke-width=\"3\"/>\n    <path d=\"M27 19v14M20 26h14\" fill=\"none\" stroke-width=\"5\"/>\n    <path d=\"M47 20v10M42 25h10M43.5 21.5l7 7M50.5 21.5l-7 7\" fill=\"none\" stroke-width=\"2\"/>",
  "emergency-exit": "    <path d=\"M16 14h17v36H16z\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M39 32h12M46 25l7 7-7 7\" fill=\"none\" stroke-width=\"4\"/>\n    <circle cx=\"30\" cy=\"24\" r=\"3\"/>\n    <path d=\"M29 28l-7 8 8 2 4 8M31 30l7 5\" fill=\"none\" stroke-width=\"4\"/>",
  "first-aid": "    <rect x=\"16\" y=\"16\" width=\"32\" height=\"32\" rx=\"5\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M32 22v20M22 32h20\" fill=\"none\" stroke-width=\"7\"/>",
  "assembly-point": "    <circle cx=\"32\" cy=\"23\" r=\"4\"/>\n    <path d=\"M25 46v-8c0-4 3-7 7-7s7 3 7 7v8\" fill=\"none\" stroke-width=\"4\"/>\n    <circle cx=\"19\" cy=\"32\" r=\"3\"/>\n    <circle cx=\"45\" cy=\"32\" r=\"3\"/>\n    <path d=\"M14 47v-6c0-3 2-5 5-5M50 47v-6c0-3-2-5-5-5\" fill=\"none\" stroke-width=\"3.5\"/>\n    <path d=\"M15 17l8 2-6 6M49 17l-8 2 6 6\" fill=\"none\" stroke-width=\"3\"/>",
  "danger-warning": "    <path d=\"M32 13l22 39H10l22-39z\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M32 27v11\" fill=\"none\" stroke-width=\"5\"/>\n    <circle cx=\"32\" cy=\"45\" r=\"2.8\"/>",
  "command-post": "    <rect x=\"14\" y=\"16\" width=\"36\" height=\"24\" rx=\"3\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M22 47h20M32 40v7\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M24 27h7l3-5 4 10 3-5h5\" fill=\"none\" stroke-width=\"3.5\"/>",
  "radio-channel": "    <rect x=\"20\" y=\"21\" width=\"23\" height=\"31\" rx=\"4\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M27 21v-8h10v8M27 31h9M28 40h7\" fill=\"none\" stroke-width=\"4\"/>\n    <circle cx=\"38\" cy=\"40\" r=\"2\"/>\n    <path d=\"M47 19c4 4 4 10 0 14M52 14c7 7 7 17 0 24\" fill=\"none\" stroke-width=\"3\"/>",
  "cctv": "    <path d=\"M15 24l29-8 4 13-29 8-4-13z\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M31 34v8l-9 8M31 42h12\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M45 16l5-5M49 28l7 2\" fill=\"none\" stroke-width=\"3\"/>",
  "barrier": "    <rect x=\"11\" y=\"25\" width=\"42\" height=\"14\" rx=\"2\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M18 39v11M46 39v11M18 25l12 14M32 25l12 14M46 25l7 8\" fill=\"none\" stroke-width=\"4\"/>",
  "gate-entrance": "    <path d=\"M17 51V16h30v35M24 51V24h16v27\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M11 34h19M23 27l7 7-7 7\" fill=\"none\" stroke-width=\"4\"/>",
  "vip-area": "    <path d=\"M15 45h34l3-23-12 8-8-14-8 14-12-8 3 23z\" fill=\"none\" stroke-width=\"4\"/>\n    <circle cx=\"32\" cy=\"16\" r=\"3\"/>\n    <circle cx=\"12\" cy=\"22\" r=\"3\"/>\n    <circle cx=\"52\" cy=\"22\" r=\"3\"/>",
  "evacuation-route": "    <path d=\"M15 48h12l10-32h12\" fill=\"none\" stroke-width=\"5\"/>\n    <path d=\"M43 10l8 6-8 6\" fill=\"none\" stroke-width=\"4\"/>\n    <circle cx=\"20\" cy=\"19\" r=\"4\"/>\n    <path d=\"M22 24l8 5-6 8 8 7M23 29l-8 6\" fill=\"none\" stroke-width=\"4\"/>",
  "fire-extinguisher": "    <path d=\"M29 18h9M33 18v7M28 25h12v25c0 3-2 5-6 5s-6-2-6-5V25z\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M40 27c7 0 9 4 9 8v7M25 33h18\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M25 15l12-3\" fill=\"none\" stroke-width=\"3\"/>",
  "aed": "    <path d=\"M32 49s-17-10-17-22c0-6 4-10 9-10 4 0 7 2 8 5 1-3 4-5 8-5 5 0 9 4 9 10 0 12-17 22-17 22z\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M35 21l-8 12h7l-5 11 10-14h-7l3-9z\" stroke-width=\"1\"/>",
  "info-point": "    <circle cx=\"32\" cy=\"32\" r=\"20\" fill=\"none\" stroke-width=\"4\"/>\n    <circle cx=\"32\" cy=\"22\" r=\"2.8\"/>\n    <path d=\"M32 31v13\" fill=\"none\" stroke-width=\"6\"/>",
  "security-staff": "    <circle cx=\"24\" cy=\"22\" r=\"6\"/>\n    <path d=\"M13 50v-7c0-7 5-12 11-12 4 0 7 1 10 4\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M42 30l11 4v7c0 7-4 12-11 15-7-3-11-8-11-15v-7l11-4z\" fill=\"none\" stroke-width=\"3.5\"/>\n    <path d=\"M38 42l3 3 7-8\" fill=\"none\" stroke-width=\"3.5\"/>",
  "lost-child": "    <circle cx=\"24\" cy=\"22\" r=\"5\"/>\n    <circle cx=\"39\" cy=\"28\" r=\"4\"/>\n    <path d=\"M16 50v-8c0-6 4-10 8-10s8 4 8 10v8M34 50v-6c0-4 2-7 5-7s5 3 5 7v6\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M48 18c0-4 3-7 7-5 2 1 2 4 0 6l-3 3v3M52 31h.1\" fill=\"none\" stroke-width=\"3\"/>",
  "restricted-area": "    <circle cx=\"32\" cy=\"32\" r=\"20\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M18 46l28-28\" fill=\"none\" stroke-width=\"5\"/>\n    <path d=\"M22 31h20\" fill=\"none\" stroke-width=\"5\"/>",
  "traffic-control": "    <path d=\"M25 51h14l-5-31h-4l-5 31z\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M22 51h20M28 31h8M27 41h10\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M40 19h12M47 12l7 7-7 7\" fill=\"none\" stroke-width=\"4\"/>",
  "parking-emergency": "    <rect x=\"15\" y=\"12\" width=\"34\" height=\"40\" rx=\"5\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M27 43V22h9c5 0 8 3 8 7s-3 7-8 7h-9\" fill=\"none\" stroke-width=\"5\"/>",
  "medical-room": "    <rect x=\"13\" y=\"29\" width=\"38\" height=\"13\" rx=\"2\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M17 29v-7h15c5 0 8 3 8 7M16 42v7M48 42v7\" fill=\"none\" stroke-width=\"4\"/>\n    <path d=\"M25 13v12M19 19h12\" fill=\"none\" stroke-width=\"5\"/>"
};

export function SecurityIconInline({
  id,
  size = 48,
  title,
  bg,
  fg,
  className = "",
  style = {},
}) {
  const icon = ICON_BODIES[id];
  const meta = SECURITY_ICON_META.find((item) => item.id === id);
  if (!icon || !meta) return null;

  const background = bg || meta.color;
  const foreground = fg || meta.foreground || "#FFFFFF";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={title || meta.label}
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title || meta.label}</title>
      <rect x="4" y="4" width="56" height="56" rx="12" fill={background} />
      <g
        fill={foreground}
        stroke={foreground}
        strokeLinecap="round"
        strokeLinejoin="round"
        dangerouslySetInnerHTML={{ __html: icon }}
      />
    </svg>
  );
}
