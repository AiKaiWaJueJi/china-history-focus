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
  /**
   * 该势力在推演时间轴上的存续区间（负数＝公元前）。
   * 一次分封就位的地图（战国 / 楚汉）可不填；
   * 五代十国、三国那种"陆续登场"的朝代必须填，地图按当前年份决定是否渲染。
   */
  aliveFrom?: number
  aliveTo?: number
  /** 不可吞并的边患（如突厥），不参与终章一统 */
  neutral?: boolean
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
  // 西南角必须包含巴蜀（150,470 / 250,560），否则会与韩/楚重叠并在西南缺一块
  points: '60,130 250,80 350,180 330,300 350,430 320,520 250,560 150,470 72,340',
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
    x: 326,
    y: 310,
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
  /** 地图的无障碍名称；缺省按攻方生成 */
  ariaLabel?: string
  /** SVG viewBox；缺省 1000×640。南北朝收尾用 1000×480 以贴合宽屏容器 */
  viewBox?: string
  /** 悬停攻方时的第二行文案（缺省「六国复其疆」） */
  resetHint?: string
  /** 要地/关隘：只做方位注记，不参与推演 */
  points?: StrategicPoint[]
  /**
   * 攻方易代：某年之后，攻方在地图上的国号改为 name。
   * 三国归晋用得上——265 年司马炎受魏禅，此后灭吴的是晋军，
   * 但疆域未变，所以只换国号、不换版图。
   */
  successor?: { year: number; name: string }
}

export const ZHANGUO_MAP: MapSpec = {
  attacker: QIN_REGION,
  regions: SIX_STATES,
  rivers: RIVERS,
  ariaLabel: '战国七雄版图',
  resetHint: '六国复其疆',
  points: STRATEGIC_POINTS,
}

export const MAPS: Record<string, MapSpec> = {
  zhanguo: ZHANGUO_MAP,
}

/* ---------- 南北朝收尾：北周/隋 → 北齐 → 陈；突厥为不可吞并的边患 ---------- */
export const SUI_MAP: MapSpec = {
  attacker: {
    id: 'beizhou',
    name: '北周',
    points: '0,165 480,155 480,480 0,480',
    label: [210, 340],
    capital: { name: '长安', x: 320, y: 340 },
  },
  regions: [
    {
      id: 'qi',
      name: '北齐',
      points: '480,155 760,175 1000,160 1000,330 760,345 480,320',
      label: [760, 250],
      capital: { name: '邺', x: 760, y: 255 },
    },
    {
      id: 'chen',
      name: '陈',
      points: '480,320 760,345 1000,330 1000,480 480,480',
      label: [760, 410],
      capital: { name: '建康', x: 820, y: 415 },
    },
    {
      id: 'tujue',
      name: '突厥',
      neutral: true,
      points: '0,0 1000,0 1000,160 760,175 480,155 0,165',
      label: [470, 90],
    },
  ],
  rivers: ['M 470,455 C 560,500 660,500 760,470'],
  ariaLabel: '南北朝收尾版图（北周/北齐/陈/突厥）',
  viewBox: '0 0 1000 480',
  resetHint: '三国复其疆',
  empireName: '隋',
  successor: { year: 577, name: '隋' },
  points: [
    { id: 'sui_luoyang', name: '洛阳', kind: 'city', regionId: 'qi', x: 560, y: 285, description: '577 年周军东出' },
    { id: 'sui_jinyang', name: '晋阳', kind: 'city', regionId: 'qi', x: 640, y: 200, description: '北齐军事重镇' },
    { id: 'sui_yangtze', name: '长江', kind: 'pass', regionId: 'chen', x: 760, y: 370, description: '589 年隋军渡江' },
  ],
}

MAPS.sui = SUI_MAP


