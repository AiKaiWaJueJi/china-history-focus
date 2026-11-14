/**
 * 战国七雄示意版图（无缝嵌合版）
 * ===========================================================================
 * 与上一版的区别：上一版七块各自独立，中间留有空隙，看起来像漂浮的拼图。
 * 这一版按**平面剖分**重写：相邻两块共用完全相同的顶点坐标，
 * 七块严丝合缝地拼成一整块"大陆"，只在交界处留一道描边。
 *
 * 剖分顶点（相邻块严格共享，改一处必须同步改邻块，否则会裂缝）：
 *   N1..N16  外轮廓
 *   M1..M10  内部交点
 *
 * 相对方位仍依史：秦据西陲、赵在河北、燕居东北、齐处东滨、
 * 魏韩纵横中原、楚有南方。
 */

export interface MapRegion {
  id: string
  name: string
  /** SVG polygon 顶点（相邻区域共享边界点） */
  points: string
  /** 标签位置 */
  label: [number, number]
  /** 国都（示意坐标，落在该国轮廓内） */
  capital?: { name: string; x: number; y: number }
}

/* -------------------------------------------------------------------------- */
/* 外轮廓与内部交点（供核对用，实际几何写在下面各区域的 points 里）              */
/* -------------------------------------------------------------------------- */

/** 六国（按被灭顺序，order 与 endgame.events 对齐） */
export const SIX_STATES: MapRegion[] = [
  {
    id: 'han',
    name: '韩',
    // M3 → M9 → M10 → M4
    points: '350,430 560,400 580,470 320,520',
    label: [412, 468],
    capital: { name: '新郑', x: 512, y: 438 },
  },
  {
    id: 'zhao',
    name: '赵',
    // N2 → N3 → N4 → M5 → M6 → M2 → M1
    points: '250,80 430,60 620,62 650,175 700,250 330,300 350,180',
    label: [470, 160],
    capital: { name: '邯郸', x: 500, y: 232 },
  },
  {
    id: 'wei',
    name: '魏',
    // M2 → M6 → M8 → M9 → M3
    points: '330,300 700,250 760,420 560,400 350,430',
    label: [530, 320],
    capital: { name: '大梁', x: 640, y: 302 },
  },
  {
    id: 'chu',
    name: '楚',
    // M8 → N9 → N10 → N11 → N12 → N13 → N14 → M4 → M10 → M9
    points:
      '760,420 930,470 840,545 700,600 540,622 380,610 250,560 320,520 580,470 560,400',
    label: [600, 520],
    capital: { name: '寿春', x: 720, y: 500 },
  },
  {
    id: 'yan',
    name: '燕',
    // N4 → N5 → N6 → N7 → M7 → M5
    points: '620,62 800,70 950,90 980,230 790,205 650,175',
    label: [790, 122],
    capital: { name: '蓟', x: 860, y: 130 },
  },
  {
    id: 'qi',
    name: '齐',
    // M5 → M7 → N7 → N8 → N9 → M8 → M6
    points: '650,175 790,205 980,230 985,380 930,470 760,420 700,250',
    label: [852, 300],
    capital: { name: '临淄', x: 888, y: 330 },
  },
]

/** 秦：西陲，始终为"秦色" */
export const QIN_REGION: MapRegion = {
  id: 'qin',
  name: '秦',
  // N1 → N2 → M1 → M2 → M3 → M4 → N14 → N15 → N16
  points: '60,130 250,80 350,180 330,300 350,430 320,520 250,470 150,400 90,360',
  label: [200, 330],
  capital: { name: '咸阳', x: 250, y: 402 },
}

export const ALL_REGIONS: MapRegion[] = [QIN_REGION, ...SIX_STATES]

/** 装饰性水道（黄河 / 长江），只做氛围，不参与交互 */
export const RIVERS: string[] = [
  'M 80,268 C 200,250 280,232 360,254 C 450,278 520,262 600,278 C 700,298 820,276 960,300',
  'M 300,500 C 400,486 470,502 560,514 C 660,528 740,516 850,530',
]

/* -------------------------------------------------------------------------- */
/* 地缘战略点                                                                  */
/* -------------------------------------------------------------------------- */

export type StrategicKind = 'pass' | 'battle' | 'city' | 'granary'

export interface StrategicPoint {
  id: string
  name: string
  kind: StrategicKind
  /** 所属国家（用于 hover 联动：悬停某国时只点亮该国的点） */
  regionId: string
  /** 与版图同一坐标系（viewBox 1000×640） */
  x: number
  y: number
  /** 战略价值，一句话 */
  description: string
}

/**
 * 秦灭六国不只是版图吞并，更是关隘、粮道、决战地的争夺。
 * 这些点标的是"为什么这块地形重要"，而不是"这里发生了什么事"。
 */
export const STRATEGIC_POINTS: StrategicPoint[] = [
  {
    id: 'sp_hangu',
    name: '函谷关',
    kind: 'pass',
    regionId: 'qin',
    x: 342,
    y: 302,
    description: '秦之东大门，一夫当关万夫莫开。六国合纵屡至而不得入，秦据此进退自如。',
  },
  {
    id: 'sp_jingxing',
    name: '井陉',
    kind: 'pass',
    regionId: 'zhao',
    x: 448,
    y: 168,
    description: '太行八陉之一。前229年王翦由此东出，绕开赵军正面，直下邯郸。',
  },
  {
    id: 'sp_changping',
    name: '长平',
    kind: 'battle',
    regionId: 'zhao',
    x: 470,
    y: 250,
    description: '前260年秦赵决战处，赵卒四十余万降而被坑，赵国自此不复为强国。',
  },
  {
    id: 'sp_handan',
    name: '邯郸',
    kind: 'city',
    regionId: 'zhao',
    x: 556,
    y: 196,
    description: '赵都，河北之枢。前228年城破，赵王迁被俘，秦尽取赵地。',
  },
  {
    id: 'sp_bashu',
    name: '巴蜀粮仓',
    kind: 'granary',
    regionId: 'qin',
    x: 232,
    y: 470,
    description: '李冰治水所成"天府"。秦取巴蜀后粮秣不竭，是东进六十万大军的底气。',
  },
]


/* ========================================================================== */
/* 楚汉之争（前206—前202）                                                     */
/* ========================================================================== */
/*
 * 复用战国图的地理骨架：同一片土地，只是势力换了人。
 * 关键改动只有两处：
 *   1. 「秦」变成「汉」的对手盘——三秦（雍、塞、翟）据关中；
 *   2. 西南角新增「巴蜀·汉中」，作为刘邦的根基。
 *      历史上汉中与关中隔秦岭，画成一块独立区域正合地理。
 */
/* ========================================================================== */
/* 楚汉之争（前 206 年项羽分封之后的势力分布）                                  */
/* ========================================================================== */
/*
 * 与战国图的关系：同一片地理基底，但**疆域按前 206 年分封重画**。
 *
 * 三条与史实相关的改动：
 *   1. 汉据巴蜀、汉中，隔秦岭与关中相望——画成与三秦、西楚共享边线的一块，
 *      不再是漂浮的六边形；
 *   2. 项羽王梁楚九郡，都彭城；英布为九江王，据淮南。
 *      故把原先笼统的「楚」按淮水一线拆为「西楚」与「九江」；
 *   3. 赵、燕、齐、魏、韩沿用其地，边界按分封后的实际控制区微调。
 */
export interface MapRegion {
  id: string
  name: string
  points: string
  label: [number, number]
  capital?: { name: string; x: number; y: number }
  /**
   * 该势力在推演时间轴上的存续区间（负数＝公元前）。
   * 楚汉各国都是前 206 年一次性分封，故缺省不填；
   * 五代十国那种"陆续登场"的朝代必须填，地图按当前年份决定是否渲染。
   */
  aliveFrom?: number
  aliveTo?: number
}

/** 汉：巴蜀 · 汉中，紧贴三秦与西楚的西南边缘（共享顶点 72,340 / 150,470 / 250,560 / 380,610） */
export const HAN_BASE: MapRegion = {
  id: 'han_base',
  name: '汉',
  points: '72,340 150,470 250,560 380,610 320,520 250,470 150,400',
  label: [178, 512],
  capital: { name: '南郑', x: 168, y: 470 },
  aliveFrom: -206,
  aliveTo: -202,
}

/** 三秦：雍（章邯）、塞（司马欣）、翟（董翳）分王关中 */
export const GUANZHONG_REGION: MapRegion = {
  id: 'guanzhong',
  name: '三秦',
  // 西南侧让出汉的边界（72,340 → 150,470 → 250,560）
  points: '60,130 250,80 350,180 330,300 350,430 320,520 250,470 150,400 90,360',
  label: [196, 336],
  capital: { name: '废丘', x: 248, y: 404 },
  aliveFrom: -206,
  aliveTo: -205,
}

/** 西楚：项羽自王，梁楚九郡，都彭城 */
export const XICHU_REGION: MapRegion = {
  id: 'chu',
  name: '西楚',
  points: '560,400 580,470 760,420 930,470 840,545 700,600 620,560 520,520 470,460',
  label: [720, 486],
  capital: { name: '彭城', x: 742, y: 470 },
  aliveFrom: -206,
  aliveTo: -202,
}

/** 九江：英布所王，据淮南 */
export const JIUJIANG_REGION: MapRegion = {
  id: 'jiujiang',
  name: '九江',
  points: '520,520 620,560 700,600 840,545 780,596 640,626 500,612 430,566',
  label: [636, 570],
  capital: { name: '六', x: 660, y: 566 },
  aliveFrom: -206,
  aliveTo: -203,
}

export const CHUHAN_REGIONS: MapRegion[] = [
  GUANZHONG_REGION,
  { ...SIX_STATES.find((r) => r.id === 'wei')!, capital: { name: '平阳', x: 640, y: 302 }, aliveFrom: -206, aliveTo: -205 },
  { ...SIX_STATES.find((r) => r.id === 'han')!, name: '韩', capital: { name: '阳翟', x: 512, y: 438 }, aliveFrom: -206, aliveTo: -205 },
  { ...SIX_STATES.find((r) => r.id === 'zhao')!, capital: { name: '襄国', x: 500, y: 232 }, aliveFrom: -206, aliveTo: -204 },
  { ...SIX_STATES.find((r) => r.id === 'qi')!, capital: { name: '临淄', x: 888, y: 330 }, aliveFrom: -206, aliveTo: -203 },
  { ...SIX_STATES.find((r) => r.id === 'yan')!, capital: { name: '蓟', x: 860, y: 130 }, aliveFrom: -206, aliveTo: -204 },
  XICHU_REGION,
  JIUJIANG_REGION,
]

/** 一张沙盘地图所需的全部几何 */
export interface MapSpec {
  /** 进攻方（始终高亮，不参与"被吞并"） */
  attacker: MapRegion
  /** 被逐一吞并的势力 */
  regions: MapRegion[]
  /** 装饰性水道 */
  rivers: string[]
  /** 第 0 幕「一统」时显示的合体名（如「秦」）；缺省等于 attacker.name */
  empireName?: string
}

export const ZHANGUO_MAP: MapSpec = {
  attacker: QIN_REGION,
  regions: SIX_STATES,
  rivers: RIVERS,
}

export const CHUHAN_MAP: MapSpec = {
  attacker: HAN_BASE,
  regions: CHUHAN_REGIONS,
  rivers: [
    'M 80,268 C 200,250 280,232 360,254 C 450,278 520,262 600,278 C 700,298 820,276 960,300',
    'M 300,500 C 400,486 470,502 560,514 C 660,528 740,516 850,530',
  ],
  // 前 206 年之前，这片土地只有一个名字
  empireName: '秦',
}

export const MAPS: Record<string, MapSpec> = {
  zhanguo: ZHANGUO_MAP,
  chuhan: CHUHAN_MAP,
}