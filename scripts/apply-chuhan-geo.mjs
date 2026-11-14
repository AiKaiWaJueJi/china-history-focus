/**
 * 把校验通过的几何写进 mapGeometry.ts，并修正楚汉沙盘的数据：
 *   1. 删除「天下」节点（分封幕）
 *   2. 保留九江，由「垓下」一幕兼并入汉（alsoCaptures）
 *   3. 每条行军路线首点吸附到出发国质心、末点吸附到目标国质心
 */
import fs from "node:fs";

const geo = JSON.parse(fs.readFileSync("chuhan.geo.json", "utf8")).geo;
const byId = Object.fromEntries(geo.map((g) => [g.id, g]));

/* ---------- 1) 生成 mapGeometry 的楚汉段 ---------- */
const region = (id, name, extra = "") => {
  const g = byId[id];
  return `  {
    id: '${id}',
    name: '${name}',
    points: '${g.points}',
    label: [${g.centroid[0]}, ${g.centroid[1] + 42}],
    capital: { name: '${g.capital.name}', x: ${g.capital.xy[0]}, y: ${g.capital.xy[1]} },${extra}
  },`;
};

const section = `
/* ========================================================================== */
/* 楚汉之争（前 206 年项羽分封之后的势力分布）                                  */
/* ========================================================================== */
/*
 * 疆域按 **前 206 年分封** 的实际范围划定，由 scripts/gen-chuhan-geo.mjs 生成并自检：
 *   · 九块共用同一组顶点，相邻块严丝合缝（4000 点采样无重叠）
 *   · 每块国都落在自己的多边形内
 * 汉据巴蜀汉中，隔秦岭与三秦相望；项羽王梁楚九郡，英布王九江。
 */
export interface MapRegion {
  id: string
  name: string
  points: string
  label: [number, number]
  capital?: { name: string; x: number; y: number }
  /** 该势力在推演时间轴上的存续区间（负数＝公元前） */
  aliveFrom?: number
  aliveTo?: number
}

${region("han_base", "汉", `\n    aliveFrom: -206,\n    aliveTo: -202,`)}
${region("sanqin", "三秦")}
${region("wei", "魏")}
${region("han", "韩")}
${region("yan", "燕")}
${region("zhao", "赵")}
${region("qi", "齐")}
${region("xichu", "西楚")}
${region("jiujiang", "九江")}

export const HAN_BASE = CHUHAN_REGIONS.find((r) => r.id === 'han_base')!

/** 一张沙盘地图所需的全部几何 */
export interface MapSpec {
  /** 进攻方（始终高亮，不参与"被吞并"） */
  attacker: MapRegion
  /** 被逐一吞并的势力 */
  regions: MapRegion[]
  /** 装饰性水道 */
  rivers: string[]
}

export const ZHANGUO_MAP: MapSpec = {
  attacker: QIN_REGION,
  regions: SIX_STATES,
  rivers: RIVERS,
}

export const CHUHAN_MAP: MapSpec = {
  attacker: HAN_BASE,
  regions: CHUHAN_REGIONS.filter((r) => r.id !== 'han_base'),
  rivers: [
    'M 80,268 C 200,250 280,232 360,254 C 450,278 520,262 600,278 C 700,298 820,276 960,300',
    'M 300,500 C 400,486 470,502 560,514 C 660,528 740,516 850,530',
  ],
}

export const MAPS: Record<string, MapSpec> = {
  zhanguo: ZHANGUO_MAP,
  chuhan: CHUHAN_MAP,
}
`;

/* CHUHAN_REGIONS 先声明再被引用，调整顺序：把数组定义插到 HAN_BASE 之前 */
const regionsArray = `export const CHUHAN_REGIONS: MapRegion[] = [
${region("han_base", "汉", `\n    aliveFrom: -206,\n    aliveTo: -202,`)}
${region("sanqin", "三秦")}
${region("wei", "魏")}
${region("han", "韩")}
${region("yan", "燕")}
${region("zhao", "赵")}
${region("qi", "齐")}
${region("xichu", "西楚")}
${region("jiujiang", "九江")}
]
`;

const finalSection = section
  .replace(new RegExp(`\\\$\\{region\\("han_base".*?\\n\\n`, "s"), "")
  .replace("export const HAN_BASE = CHUHAN_REGIONS.find((r) => r.id === 'han_base')!", regionsArray + "\nexport const HAN_BASE = CHUHAN_REGIONS.find((r) => r.id === 'han_base')!");

const mapPath = "src/features/endgame/mapGeometry.ts";
const mapSrc = fs.readFileSync(mapPath, "utf8");
const cut = mapSrc.indexOf("/* ==========================================================================");
const tailIdx = mapSrc.indexOf("/* ==========================================================================", cut + 10);
const head = mapSrc.slice(0, tailIdx >= 0 ? tailIdx : cut);
fs.writeFileSync(mapPath, head + finalSection.trimStart(), "utf8");
console.log("已重写 mapGeometry 楚汉段");

/* ---------- 2) 数据：删「天下」、补 alsoCaptures、吸附路线端点 ---------- */
const dataPath = "src/data/endgame.chuhan.json";
const j = JSON.parse(fs.readFileSync(dataPath, "utf8"));

j.events = j.events.filter((e) => e.nationId !== "dissolve");
j.events.forEach((e, i) => {
  e.order = i + 1;
});

const chu = j.events.find((e) => e.nationId === "xichu");
if (chu && !chu.alsoCaptures) chu.alsoCaptures = ["jiujiang"];

const centroid = (id) => byId[id].centroid;
const ATTACKER = centroid("han_base");

for (const e of j.events) {
  const target = centroid(e.nationId) ?? ATTACKER;
  for (const c of e.campaigns ?? []) {
    if (!c.points?.length) continue;
    // 首点：秦/汉的出发地一律从汉境出发；敌方路线从目标国出发
    const start = c.side === "enemy" ? target : ATTACKER;
    c.points[0] = { x: +(start[0] / 10).toFixed(1), y: +(start[1] / 6.4).toFixed(1) };
    const last = c.points[c.points.length - 1];
    if (c.side === "enemy") {
      // 敌方溃走：终点留在自己境内偏外侧
      c.points[c.points.length - 1] = { x: last.x, y: last.y };
    } else {
      c.points[c.points.length - 1] = { x: +(target[0] / 10).toFixed(1), y: +(target[1] / 6.4).toFixed(1) };
    }
  }
}

fs.writeFileSync(dataPath, JSON.stringify(j, null, 2) + "\n", "utf8");
console.log("已更新 endgame.chuhan.json：事件数 =", j.events.length);
