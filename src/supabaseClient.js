import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Se le variabili d'ambiente non sono presenti (es. dev locale senza .env, o
// deploy senza env configurate), NON facciamo lanciare createClient: altrimenti
// l'eccezione parte all'import e impedisce a tutta l'app di montarsi (landing e
// modulo CS inclusi, che con Supabase non hanno nulla a che fare).
// In quel caso esponiamo uno stub: ogni query si risolve con un errore gestibile,
// mostrato a video dalla UI (PpsList / PpsWizard), invece di un crash globale.
function makeStub(reason) {
  const result = { data: null, error: { message: reason } }
  const chain = {
    from() { return chain },
    select() { return chain },
    insert() { return chain },
    update() { return chain },
    delete() { return chain },
    eq() { return chain },
    order() { return chain },
    single() { return chain },
    // thenable: await su qualsiasi punto della catena risolve con l'errore
    then(resolve) { return Promise.resolve(result).then(resolve) },
  }
  return chain
}

const missing = !supabaseUrl || !supabaseKey

if (missing) {
  console.error(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY mancanti: ' +
    'le funzioni PPS non saranno disponibili (il resto dell\'app funziona).'
  )
}

export const supabase = missing
  ? makeStub('Supabase non configurato: variabili VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY mancanti.')
  : createClient(supabaseUrl, supabaseKey)
