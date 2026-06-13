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
    const response = await fetch(
      `${process.env.VITE_SUPABASE_URL}/auth/v1/admin/users`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
        },
        body: JSON.stringify({ email, password, email_confirm: true })
      }
    )
    const userData = await response.json()
    if (!response.ok)
      return res.status(400).json({ error: userData.msg || userData.error })

    const userId = userData.id

    await supabaseAdmin.from('profili').insert({
      id: userId,
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
