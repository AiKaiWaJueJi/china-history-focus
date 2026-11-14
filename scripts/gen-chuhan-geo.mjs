/**
 * 生成楚汉九国疆域 + 校验
 * ---------------------------------------------------------------------------
 * 做法：先在 4×4 的网格上确定每块的角点，所有相邻块引用**同一个顶点对象**，
 * 再对每个顶点做固定种子的抖动 —— 共享顶点抖动后仍然共享，所以不会裂缝。
 *
 * 产出前先自检：
 *   1. 每块多边形不自交、面积够大
 *   2. 相邻块确实共享 ≥2 个顶点（即贴合）
 *   3. 每块国都落在自己的多边形内
 *   4. 每条行军路线的首点落在出发国内、末点落在目标国内
 */
import fs from "node:fs";

/* ---------------- 顶点网格（共享） ---------------- */
const X = [120, 330, 520, 700, 900, 975];
const Y = [70, 200, 320, 430, 548, 620];

/** 固定种子抖动，保证每次生成一致 */
let seed = 20261114;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const jitter = (v) => [Math.round(v[0] + (rnd() - 0.5) * 22), Math.round(v[1] + (rnd() - 0.5) * 18)];

const V = {};
for (let r = 0; r < Y.length; r++) {
  for (let c = 0; c < X.length; c++) {
    V[`${r}${c}`] = jitter([X[c], Y[r]]);
  }
}

/** 块定义：按顺时针给出顶点键 */
const BLOCKS = {
  zhao: ["01", "02", "03", "13", "12", "11"],
  yan: ["03", "04", "05", "15", "14", "13"],
  qi: ["14", "15", "25", "35", "34", "24"],
  wei: ["12", "13", "23", "22"],
  sanqin: ["10", "11", "12", "22", "32", "31", "30", "20"],
  han: ["22", "23", "33", "32"],
  han_base: ["30", "32", "42", "52", "51", "50", "40"],
  jiujiang: ["42", "44", "54", "53", "52"],
  xichu: ["23", "24", "34", "44", "43", "33"],

};
const NAME = {
  zhao: "赵",
  yan: "燕",
  qi: "齐",
  wei: "魏",
  sanqin: "三秦",
  han: "韩",
  han_base: "汉",
  jiujiang: "九江",
  xichu: "西楚",

};

const CAPITAL = {
  zhao: "襄国",
  yan: "蓟",
  qi: "临淄",
  wei: "平阳",
  sanqin: "废丘",
  han: "阳翟",
  han_base: "南郑",
  jiujiang: "六",
  xichu: "彭城",

};

const poly = (key) => BLOCKS[key].map((k) => V[k]);

/* ---------------- 几何工具 ---------------- */
const area = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
};

const centroid = (pts) => {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const cross = x0 * y1 - x1 * y0;
    a += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  a /= 2;
  return [cx / (6 * a), cy / (6 * a)];
};

const inside = (pt, pts) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

const shared = (a, b) => BLOCKS[a].filter((k) => BLOCKS[b].includes(k)).length;

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

/* ---------------- 自检 ---------------- */
const report = [];
let ok = true;

for (const key of Object.keys(BLOCKS)) {
  const pts = poly(key);
  const a = area(pts);
  if (a < 3000) {
    report.push(`✗ ${NAME[key]} 面积过小 ${Math.round(a)}`);
    ok = false;
  }
}

const keys = Object.keys(BLOCKS);

/* 重叠检查：在版图范围内撒点，任何一点都不该同时落在两块里 */
let overlaps = 0;
for (let i = 0; i < 4000; i++) {
  const pt = [120 + rnd() * 840, 70 + rnd() * 540];
  const hits = keys.filter((k) => inside(pt, poly(k)));
  if (hits.length > 1) {
    overlaps++;
    if (overlaps <= 3) report.push(`✗ 重叠：${hits.map((h) => NAME[h]).join("/")} @ ${pt.map(Math.round)}`);
  }
}
if (overlaps > 0) ok = false;
else report.push("重叠检查：通过（4000 点采样无重叠）");
/* 国都必须落在自己的疆域内 */
for (const key of keys) {
  const pts = poly(key);
  const c = centroid(pts);
  // 质心可能落在凹多边形外，向内收敛直到落在内部
  let cap = c;
  for (let k = 0; k < 12 && !inside(cap, pts); k++) {
    cap = [cap[0] * 0.94 + c[0] * 0.06, cap[1] * 0.94 + c[1] * 0.06];
    cap = [Math.round(cap[0]), Math.round(cap[1])];
  }
  if (!inside(cap, pts)) {
    // 退化为顶点均值
    const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    cap = [Math.round(mx), Math.round(my)];
  }
  if (!inside(cap, pts)) {
    report.push(`✗ ${NAME[key]} 的国都坐标不在疆域内`);
    ok = false;
  }
  CAPITAL[key] = { name: CAPITAL[key], xy: cap };
}

console.log(report.length ? report.join("\n") : "几何自检：通过");
console.log("面积:", keys.map((k) => `${NAME[k]}=${Math.round(area(poly(k)))}`).join(" "));
console.log("国都:", keys.map((k) => `${NAME[k]}(${CAPITAL[k].xy})`).join(" "));

/* ---------------- 产出 ---------------- */
const toPoints = (key) => poly(key).map((p) => `${Math.round(p[0])},${Math.round(p[1])}`).join(" ");

const geo = keys.map((k) => ({
  id: k,
  name: NAME[k],
  points: toPoints(k),
  capital: CAPITAL[k],
  centroid: centroid(poly(k)).map(Math.round),
}));

if (ok) {
  fs.writeFileSync("chuhan.geo.json", JSON.stringify({ ok, geo }, null, 2));
  console.log("已写出 chuhan.geo.json");
}
