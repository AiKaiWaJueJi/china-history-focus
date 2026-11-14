import fs from 'node:fs'
const file = 'src/data/fall.southern_northern.json'
const data = JSON.parse(fs.readFileSync(file, 'utf8'))
for (const chapter of Object.values(data)) {
  for (const act of chapter.acts) {
    if (act.art?.startsWith('nbn')) act.art = 'nb' + act.art.slice(3)
  }
}
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
const script = 'scripts/build-nanbei-fall.mjs'
let s = fs.readFileSync(script, 'utf8')
s = s.replace('art: `nb${node.id}_${i + 1}`', 'art: `nb${node.id}_${i + 1}`')
fs.writeFileSync(script, s)
console.log('keys ->', Object.values(data).flatMap((c) => c.acts.map((a) => a.art)).join(','))
