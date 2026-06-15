export default async function handler(req, res) {
  const token = process.env.TODOIST_API_TOKEN
  if (!token) return res.status(500).json({ error: 'Token mancante' })

  const response = await fetch(
    'https://api.todoist.com/api/v1/tasks?project_id=6grHf6MfqvGHHrp9',
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const data = await response.json()
  const tasks = (data.results || []).filter(t => !t.checked)

  const gruppi = {}
  const altro = []

  tasks.forEach(task => {
    const match = task.content.match(/^([A-Z][A-Z0-9\-]+):\s*(.+)/)
    if (match) {
      const prefisso = match[1]
      const testo = match[2]
      if (!gruppi[prefisso]) gruppi[prefisso] = []
      gruppi[prefisso].push(testo)
    } else {
      altro.push(task.content)
    }
  })

  const oggi = new Date().toLocaleDateString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  })

  let testo = `🗼 Torre di Controllo — ${oggi}\n`

  Object.keys(gruppi).sort().forEach(p => {
    testo += `\n📁 ${p}\n`
    gruppi[p].forEach(t => { testo += `• ${t}\n` })
  })

  if (altro.length > 0) {
    testo += `\n📁 ALTRO\n`
    altro.forEach(t => { testo += `• ${t}\n` })
  }

  res.setHeader('Access-Control-Allow-Origin', '*')
  res.status(200).json({ text: testo })
}
