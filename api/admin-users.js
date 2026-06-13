const { createClient } = require('@supabase/supabase-js')

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Metodo non consentito' })

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { email, nome, password, ruolo } = req.body
  if (!email || !password)
    return res.status(400).json({ error: 'Email e password obbligatorie' })

  try {
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true
      })
    if (authError) return res.status(400).json({ error: authError.message })

    await supabaseAdmin.from('profili').insert({
      id: authData.user.id,
      email,
      nome: nome || '',
      ruolo: ruolo || 'utente',
      attivo: true
    })

    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
