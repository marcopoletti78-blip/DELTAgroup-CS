# Security Icon Pack — PPS / Web App

Generato il 2026-06-17 14:05.

## Contenuto

- `icons/*.svg`: SVG standalone 64×64.
- `securityIcons.manifest.json`: anagrafica icone per popolare il picker.
- `SecurityIcon.jsx`: componente React usando file SVG in `/public/icons/security`.
- `SecurityIconInline.jsx`: componente React inline, senza dipendere dalla cartella public.
- `preview.html`: anteprima visuale.
- `security-icons.css`: token colore e stile base.

## Uso consigliato nella web app

### Variante A — assets statici

1. Copia i file SVG in:
   `public/icons/security/`

2. Copia `SecurityIcon.jsx` in:
   `src/components/SecurityIcon.jsx`

3. Usa:

```jsx
import { SecurityIcon, SECURITY_ICONS } from "./components/SecurityIcon";

<SecurityIcon id="police-post" size={48} />
```

### Variante B — inline

Usa `SecurityIconInline.jsx` quando vuoi evitare percorsi statici:

```jsx
import { SecurityIconInline } from "./components/SecurityIconInline";

<SecurityIconInline id="ambulance-post" size={48} />
```

## Note operative

- `police-post`, `fire-post`, `ambulance-post` sono icone operative originali, non loghi ufficiali.
- Per ambulance/sanità è stata evitata la croce rossa su fondo bianco.
- Le icone ISO-like sono utili per UI/PPS, ma per segnaletica legale reale va verificata la grafica ufficiale e la licenza applicabile.
