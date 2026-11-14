/**
 * check-chuhan-geo.mjs —— 楚汉沙盘的几何验收
 * ---------------------------------------------------------------------------
 * 断言的是"图上画的东西是否符合史地与数据约束"，不是像素：
 *   1. 九块疆域无重叠（对每块多边形做点采样）
 *   2. 每块国都落在自己的疆域内
 *   3. 每条行军路线的首点落在出发国内、末点落在目标国内
 *   4. 战前不再有「天下」节点，节点数 = 7
 */
import fs from "node:fs";

const geoJson = JSON.parse(fs.readFileSync("chuhan.geo.json", "utf8"));
const geo = Object.fromEntries(geoJson.geo.map((g) => [g.id, g]));
const data = JSON.parse(fs.readFileSync("src/data/endgame.chuhan.json", "utf8"));

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " :: " + detail : ""}`);
};

const parse = (s) => s.split(" ").map((p) => p.split(",").map(Number));

const inside = (pt, pts) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

/* ---------- 1) 无重叠 ---------- */
let overlaps = 0;
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296), seed / 4294967296);
for (let i = 0; i < 6000; i++) {
  const pt = [110 + rnd() * 880, 50 + rnd() * 590];
  const hits = Object.values(geo).filter((g) => inside(pt, parse(g.points)));
  if (hits.length > 1) overlaps++;
}
check("九块疆域无重叠（6000 点采样）", overlaps === 0, `重叠点 ${overlaps}`);

/* ---------- 2) 国都在境内 ---------- */
const outside = Object.values(geo).filter((g) => !inside(g.capital.xy, parse(g.points)));
check(
  "每块国都都在自己疆域内",
  outside.length === 0,
  outside.length ? outside.map((g) => g.name).join(",") : "9/9",
);

/* ---------- 3) 行军路线首尾落点 ---------- */
const HAN = "han_base";
const bad = [];
for (const e of data.events) {
  const target = geo[e.nationId];
  if (!target) {
    bad.push(`${e.target}: 没有对应疆域`);
    continue;
  }
  const tPts = parse(target.points);
  const hPts = parse(geo[HAN].points);
  for (const c of e.campaigns ?? []) {
    if (!c.points?.length) continue;
    const toXY = (p) => [p.x * 10, p.y * 6.4];
    const first = toXY(c.points[0]);
    const last = toXY(c.points[c.points.length - 1]);
    const firstOk = c.side === "enemy" ? inside(first, tPts) : inside(first, hPts);
    const lastOk = inside(last, tPts);
    if (!firstOk) bad.push(`${e.target}·${c.general} 起点不在出发国境内`);
    if (!lastOk) bad.push(`${e.target}·${c.general} 终点不在 ${target.name} 境内`);
  }
}
check("行军路线首尾都落在对应疆域内", bad.length === 0, bad.slice(0, 3).join(" / ") || "全部通过");

/* ---------- 4) 节点数 ---------- */
check("已删除「天下」节点", !data.events.some((e) => e.nationId === "dissolve"), String(data.events.length));
check("节点数为 7（三秦→西楚）", data.events.length === 7, String(data.events.length));
check(
  "节点年份依史序",
  data.events.map((e) => e.yearValue).join(",") === "-206,-205,-205,-204,-204,-203,-202",
  data.events.map((e) => e.year).join(" "),
);

const failed = results.filter((r) => !r.pass);
console.log(`\n===== ${results.length - failed.length}/${results.length} passed =====`);
if (failed.length) process.exitCode = 1;
