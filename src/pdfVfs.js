// VFS dei font per pdfmake (0.2.x).
//
// `pdfmake/build/vfs_fonts.js` è uno script legacy che fa
//   this.pdfMake = this.pdfMake || {}; this.pdfMake.vfs = { ...font base64... };
// Non ha export ESM né marcatori CommonJS, quindi Rollup/Vite lo tratta come
// ESM e rimappa il `this` di primo livello a `undefined` → crash a runtime.
//
// Lo importiamo come testo grezzo (`?raw`) ed estraiamo l'oggetto VFS, che è
// un object-literal con sole chiavi/stringhe → JSON valido. Nessun eval.

import raw from "pdfmake/build/vfs_fonts.js?raw";

function extractVfs(src) {
  const marker = src.indexOf(".vfs");
  const start = src.indexOf("{", marker);
  const end = src.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("pdfVfs: impossibile individuare l'oggetto VFS in vfs_fonts.js");
  }
  return JSON.parse(src.slice(start, end + 1));
}

export const vfs = extractVfs(raw);
