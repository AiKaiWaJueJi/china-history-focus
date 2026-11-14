import fs from 'node:fs'
const file = 'src/data/sui.geo.json'
let raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
const geo = JSON.parse(raw)
const dup = new Set(['sui_changan', 'sui_ye', 'sui_jiankang'])
geo.points = geo.points.filter((p) => !dup.has(p.id))
fs.writeFileSync(file, JSON.stringify(geo, null, 2) + '\n', 'utf8')
console.log('points', geo.points.map((p) => p.name).join(','))
