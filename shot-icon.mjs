import puppeteer from "puppeteer-core"
const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ["--no-sandbox", "--force-device-scale-factor=2"], defaultViewport: { width: 900, height: 200 } })
const p = await b.newPage()
const errs = []
p.on("pageerror", (e) => errs.push(String(e)))
p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()) })
await p.goto("http://localhost:5180/icon-test.html", { waitUntil: "networkidle2" })
await sleep(2500)
const n = await p.evaluate(() => document.querySelectorAll("svg").length)
console.log("SVG 数量:", n, "错误:", errs.length ? errs.join(" | ") : "无")
await p.screenshot({ path: "shots/v32/iconify.png" })
await b.close()
