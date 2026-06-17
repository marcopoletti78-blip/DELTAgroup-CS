/**
 * SecurityIcon.jsx
 * Icone operative per PPS / sicurezza eventi.
 *
 * Uso consigliato:
 * 1) Copia la cartella /icons in /public/icons/security
 * 2) Importa SECURITY_ICONS e usa <SecurityIcon id="police-post" />
 */

import React from "react";

export const SECURITY_ICONS = [
  {
    "id": "police-post",
    "label": "Postazione Polizia",
    "category": "Operativo",
    "color": "#0057B8",
    "foreground": "#FFFFFF",
    "svg": "/icons/security/police-post.svg",
    "isoRef": null,
    "recommendedUse": "Punto fisso o mobile della polizia / responsabile ordine pubblico."
  },
  {
    "id": "fire-post",
    "label": "Postazione Pompieri",
    "category": "Operativo",
    "color": "#E30613",
    "foreground": "#FFFFFF",
    "svg": "/icons/security/fire-post.svg",
    "isoRef": null,
    "recommendedUse": "Mezzo/presidio pompieri o accesso riservato ai soccorsi antincendio."
  },
  {
    "id": "ambulance-post",
    "label": "Postazione Ambulanza",
    "category": "Operativo",
    "color": "#006BB6",
    "foreground": "#FFFFFF",
    "svg": "/icons/security/ambulance-post.svg",
    "isoRef": null,
    "recommendedUse": "Ambulanza, punto sanitario avanzato, percorso prioritario sanitario."
  },
  {
    "id": "emergency-exit",
    "label": "Uscita sicurezza",
    "category": "ISO 7010 / Safe condition",
    "color": "#00A651",
    "foreground": "#FFFFFF",
    "svg": "/icons/security/emergency-exit.svg",
    "isoRef": "E001/E002 - DA VERIFICARE su licenza grafica",
    "recommendedUse": "Vie di fuga e uscite d'emergenza."
  },
  {
    "id": "first-aid",
    "label": "Primo soccorso",
    "category": "ISO 7010 / Safe condition",
    "color": "#00A651",
    "foreground": "#FFFFFF",
    "svg": "/icons/security/first-aid.svg",
    "isoRef": "E003 - DA VERIFICARE su licenza grafica",
    "recommendedUse": "Punto primo soccorso o materiale sanitario."
  },
  {
    "id": "assembly-point",
    "label": "Punto di raccolta",
    "category": "ISO 7010 / Safe condition",
    "color": "#00A651",
    "foreground": "#FFFFFF",
    "svg": "/icons/security/assembly-point.svg",
    "isoRef": "E007 - DA VERIFICARE su licenza grafica",
    "recommendedUse": "Punto raccolta in caso di evacuazione."
  },
  {
    "id": "danger-warning",
    "label": "Pericolo / Attenzione",
    "category": "Warning",
    "color": "#FFD400",
    "foreground": "#111111",
    "svg": "/icons/security/danger-warning.svg",
    "isoRef": null,
    "recommendedUse": "Pericoli generici, aree sensibili, punti critici da presidiare."
  },
  {
    "id": "command-post",
    "label": "Posto comando",
    "category": "Coordinamento",
    "color": "#263238",
    "foreground": "#FFFFFF",
    "svg": "/icons/security/command-post.svg",
    "isoRef": null,
    "recommendedUse": "Direzione evento, capo impiego, centrale operativa, regia sicurezza."
  },
  {
    "id": "radio-channel",
    "label": "Radio / Canale operativo",
    "category": "Comunicazioni",
    "color": "#003C88",
    "foreground": "#FFFFFF",
    "svg": "/icons/security/radio-channel.svg",
    "isoRef": null,
    "recommendedUse": "Canale radio, check radio, punto comunicazioni."
  },
  {
    "id": "cctv",
    "label": "Videosorveglianza",
    "category": "Tecnico",
    "color": "#0B3A53",
    "foreground": "#FFFFFF",
    "svg": "/icons/security/cctv.svg",
    "isoRef": null,
    "recommendedUse": "Telecamere, punti ciechi, sorveglianza video."
  },
  {
    "id": "barrier",
    "label": "Transenna / Barriera",
    "category": "Perimetro",
    "color": "#F28C28",
    "foreground": "#FFFFFF",
    "svg": "/icons/security/barrier.svg",
    "isoRef": null,
    "recommendedUse": "Transenne, barriere, chiusure fisiche, canalizzazione flussi."
  },
  {
    "id": "gate-entrance",
    "label": "Entrata / Accesso",
    "category": "Accessi",
    "color": "#0057B8",
    "foreground": "#FFFFFF",
    "svg": "/icons/security/gate-entrance.svg",
    "isoRef": null,
    "recommendedUse": "Entrata principale, varchi, controllo biglietti, checkpoint."
  },
  {
    "id": "vip-area",
    "label": "Area VIP",
    "category": "Aree speciali",
    "color": "#6A1B9A",
    "foreground": "#FFFFFF",
    "svg": "/icons/security/vip-area.svg",
    "isoRef": null,
    "recommendedUse": "Area VIP, accessi premium, ospiti protetti."
  },
  {
    "id": "evacuation-route",
    "label": "Percorso evacuazione",
    "category": "Evacuazione",
    "color": "#00A651",
    "foreground": "#FFFFFF",
    "svg": "/icons/security/evacuation-route.svg",
    "isoRef": null,
    "recommendedUse": "Direzioni di deflusso, percorso evacuazione, corridoi liberi."
  },
  {
    "id": "fire-extinguisher",
    "label": "Estintore",
    "category": "Antincendio",
    "color": "#E30613",
    "foreground": "#FFFFFF",
    "svg": "/icons/security/fire-extinguisher.svg",
    "isoRef": null,
    "recommendedUse": "Estintori, materiale antincendio, punto intervento fuoco."
  },
  {
    "id": "aed",
    "label": "Defibrillatore AED",
    "category": "ISO 7010 / Safe condition",
    "color": "#00A651",
    "foreground": "#FFFFFF",
    "svg": "/icons/security/aed.svg",
    "isoRef": "E010 - DA VERIFICARE su licenza grafica",
    "recommendedUse": "Defibrillatore automatico esterno."
  },
  {
    "id": "info-point",
    "label": "Info point",
    "category": "Pubblico",
    "color": "#1976D2",
    "foreground": "#FFFFFF",
    "svg": "/icons/security/info-point.svg",
    "isoRef": null,
    "recommendedUse": "Informazioni al pubblico, help desk, punto accoglienza."
  },
  {
    "id": "security-staff",
    "label": "Agente sicurezza",
    "category": "Personale",
    "color": "#263238",
    "foreground": "#FFFFFF",
    "svg": "/icons/security/security-staff.svg",
    "isoRef": null,
    "recommendedUse": "Posizione agente, pattuglia, steward, presidio fisso."
  },
  {
    "id": "lost-child",
    "label": "Bambino smarrito",
    "category": "Pubblico / Safety",
    "color": "#F9A825",
    "foreground": "#111111",
    "svg": "/icons/security/lost-child.svg",
    "isoRef": null,
    "recommendedUse": "Punto gestione minori smarriti o persone vulnerabili."
  },
  {
    "id": "restricted-area",
    "label": "Area vietata / Solo autorizzati",
    "category": "Accessi",
    "color": "#C62828",
    "foreground": "#FFFFFF",
    "svg": "/icons/security/restricted-area.svg",
    "isoRef": null,
    "recommendedUse": "Backstage, aree tecniche, accessi non autorizzati."
  },
  {
    "id": "traffic-control",
    "label": "Gestione traffico",
    "category": "Viabilità",
    "color": "#F57C00",
    "foreground": "#FFFFFF",
    "svg": "/icons/security/traffic-control.svg",
    "isoRef": null,
    "recommendedUse": "Deviazioni, controllo traffico, accesso veicoli soccorso."
  },
  {
    "id": "parking-emergency",
    "label": "Parcheggio mezzi soccorso",
    "category": "Viabilità",
    "color": "#0057B8",
    "foreground": "#FFFFFF",
    "svg": "/icons/security/parking-emergency.svg",
    "isoRef": null,
    "recommendedUse": "Stallo riservato a polizia, pompieri, ambulanza o mezzi operativi."
  },
  {
    "id": "medical-room",
    "label": "Locale sanitario",
    "category": "Sanitario",
    "color": "#00A651",
    "foreground": "#FFFFFF",
    "svg": "/icons/security/medical-room.svg",
    "isoRef": null,
    "recommendedUse": "Infermeria, sala medica, punto trattamento non pubblico."
  }
];

export function SecurityIcon({
  id,
  size = 48,
  label,
  className = "",
  style = {},
  imgProps = {},
}) {
  const icon = SECURITY_ICONS.find((item) => item.id === id);
  if (!icon) return null;

  return (
    <img
      src={icon.svg}
      width={size}
      height={size}
      alt={label || icon.label}
      title={label || icon.label}
      className={className}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        ...style,
      }}
      {...imgProps}
    />
  );
}

export function SecurityIconPicker({ selectedId, onSelect }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {SECURITY_ICONS.map((icon) => (
        <button
          key={icon.id}
          type="button"
          onClick={() => onSelect?.(icon.id)}
          className={[
            "rounded-xl border p-3 text-center transition",
            selectedId === icon.id
              ? "border-blue-700 ring-2 ring-blue-300"
              : "border-slate-200 hover:border-slate-400",
          ].join(" ")}
        >
          <SecurityIcon id={icon.id} size={44} />
          <div className="mt-2 text-xs font-semibold">{icon.label}</div>
          <div className="text-[10px] text-slate-500">{icon.category}</div>
        </button>
      ))}
    </div>
  );
}
