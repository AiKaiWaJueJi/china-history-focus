import { readFileSync, writeFileSync } from "node:fs"
const FILE = "src/data/emperors.qin.json"
const d = JSON.parse(readFileSync(FILE, "utf8"))
for (const e of d.emperors) {
  e.evaluation = "neutral"
  e.posthumousRule = "秦废谥法，无谥可循"
}
writeFileSync(FILE, JSON.stringify(d, null, 2) + "\n", "utf8")
console.log("qin updated:", d.emperors.length)
