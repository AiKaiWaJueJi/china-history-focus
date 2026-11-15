/**
 * make-sandbox-geo.mjs —— 七朝沙盘版图生成器（真实省界底板版）
 * ===========================================================================
 * 旧版：「同一块大陆轮廓 + 政权种子点 Voronoi」——边界是等距垂线，
 *       既不像山河，也和史实疆域无关（用户口径：「无意义模块」），已废弃。
 *
 * 新版：底板 = 真实中国省界（scripts/data/china-provinces-100000.json，
 *       经 build-china-base.mjs 投影简化成 35 个「地理单元」）。
 *       每个政权 = 若干地理单元的并集，疆域按史料指定；
 *       相邻政权共用同一套省界，因此天然不重叠、无缺块、面积守恒。
 *
 * 用法：node scripts/make-sandbox-geo.mjs [id...]
 * 前置：node scripts/build-china-base.mjs
 * 输出：src/data/<id>.geo.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { ANCIENT_MAPS } from './lib/ancient-maps.mjs'
import {
  unionRings,
  ringArea,
  pointInRing,
  city,
  riverPath,
  labelSize,
  placeLabels,
  pickPointOffset,
} from './lib/geo-lib.mjs'

const base = JSON.parse(readFileSync('scripts/data/china-cells.json', 'utf8'))
const CELL = Object.fromEntries(base.cells.map((c) => [c.id, c]))
/** 单元组：写省名 / 旧名时自动展开成子单元（见 build-china-base.mjs 的 GROUPS） */
const GROUPS = base.groups ?? {}
const expand = (ids) => ids.flatMap((id) => GROUPS[id] ?? [id])
const ALL_CELLS = base.cells.map((c) => c.id)
const BASE_TOTAL = base.total

/* -------------------------------------------------------------------------- */
/* 河流（经度, 纬度）：只做氛围与地理参照，不参与推演                          */
/* -------------------------------------------------------------------------- */
const RIVERS = {
  huanghe: [
    [100.2, 36.3], [103.8, 36.1], [105.5, 37.5], [106.9, 39.1], [107.6, 40.7],
    [109.8, 40.6], [110.6, 39.0], [110.7, 37.0], [110.4, 34.7], [112.5, 34.9],
    [114.2, 35.0], [116.2, 35.4], [118.1, 36.7], [119.2, 37.8],
  ],
  changjiang: [
    [97.0, 32.5], [99.2, 29.5], [100.3, 27.4], [102.7, 26.2], [104.5, 28.8],
    [106.6, 29.6], [109.5, 31.0], [111.3, 30.7], [114.3, 30.6], [116.0, 29.7],
    [118.4, 31.6], [119.5, 32.1], [121.6, 31.6],
  ],
  huaihe: [
    [113.4, 32.4], [115.0, 32.5], [116.8, 32.6], [118.4, 33.0], [119.3, 33.4], [120.4, 34.1],
  ],
  hanshui: [
    [106.5, 33.1], [108.5, 32.9], [110.6, 32.6], [112.1, 32.0], [112.7, 31.0], [114.3, 30.6],
  ],
  xiangjiang: [[111.4, 26.3], [112.2, 27.3], [112.9, 28.3], [113.1, 29.2]],
  ganjiang: [[114.6, 27.6], [115.5, 28.4], [116.0, 29.2]],
  minjiang: [[116.9, 26.6], [118.0, 26.6], [119.3, 26.1]],
}

/* -------------------------------------------------------------------------- */
/* 七盘沙盘                                                                   */
/* -------------------------------------------------------------------------- */
const MAPS = {
  /* ---------------- 隋：唐统一战争 618—624 ---------------- */
  'sui-unify': {
    dynastyId: 'sui',
    note:
      '隋亡之后群雄并立：唐据关中、河东、巴蜀，次第削平定杨、郑、夏、梁、吴（618—624）。' +
      '版图按今省界示意：唐含陕晋川渝与陇右，郑为河南，夏为河北山东，梁为荆湖岭南，吴为江淮江浙闽赣。' +
      '突厥、吐谷浑、高句丽、南中诸部为背景，不参与推演。',
    attacker: { id: 'tang', name: '唐', cells: ['shaanxi_north', 'shaanxi_s', 'shanxi_south', 'sichuan', 'chongqing'], capital: '长安' },
    regions: [
      { id: 'xqin', name: '西秦', cells: ['gansu', 'ningxia'], capital: '兰州' },
      { id: 'dingyang', name: '定杨', cells: ['shanxi_n'], capital: '马邑' },
      { id: 'zheng', name: '郑', cells: ['henan'], capital: '洛阳' },
      { id: 'xia', name: '夏', cells: ['hebei_south', 'shandong'], capital: '洺州' },
      { id: 'liang', name: '梁', cells: ['hubei', 'hunan', 'guangdong', 'guangxi'], capital: '江陵' },
      { id: 'song', name: '宋', cells: ['jiangsu_n', 'jiangsu_s', 'anhui_n', 'anhui_s', 'zhejiang', 'fujian', 'jiangxi', 'shanghai'], capital: '丹阳' },
      { id: 'youzhou', name: '罗艺', cells: ['hebei_n', 'beijing', 'tianjin'], backdrop: true },
      { id: 'tujue', name: '东突厥', cells: ['neimenggu'], backdrop: true },
      { id: 'xibei', name: '吐谷浑', cells: ['xinjiang', 'qinghai', 'xizang'], backdrop: true },
      { id: 'gaogouli', name: '高句丽', cells: ['liaoning', 'jilin', 'heilongjiang'], backdrop: true },
      { id: 'xinan', name: '南中诸部', cells: ['yunnan', 'guizhou'], backdrop: true },
    ],
    points: [
      { id: 'sp_tongguan', name: '潼关', kind: 'pass', regionId: 'tang', city: '潼关' },
      { id: 'sp_hulaoguan', name: '虎牢', kind: 'pass', regionId: 'zheng', city: '虎牢' },
      { id: 'sp_jinyang', name: '晋阳', kind: 'city', regionId: 'tang', city: '太原' },
      { id: 'sp_baibi', name: '柏壁', kind: 'battle', regionId: 'tang', city: '柏壁' },
      { id: 'sp_qinzhou', name: '秦州', kind: 'battle', regionId: 'xqin', city: '秦州' },
    ],
    rivers: ['huanghe', 'changjiang', 'huaihe'],
  },

  /* ---------------- 唐：梁晋争霸 907—923 ---------------- */
  'tang-wudai': {
    dynastyId: 'tang',
    note:
      '唐亡之年（907），晋据河东与梁争中原；燕据幽州、岐据关中、前蜀据两川、吴据江淮，' +
      '另有吴越、楚、闽、南汉、荆南并立（907—923）。版图按今省界示意，淮南苏北归梁、江南归吴。',
    attacker: { id: 'jin', name: '晋', cells: ['shanxi_n', 'shanxi_south'], capital: '太原' },
    regions: [
      { id: 'houliang', name: '后梁', cells: ['henan', 'shandong', 'anhui_n', 'jiangsu_n', 'hebei_south'], capital: '汴州' },
      { id: 'yan', name: '燕', cells: ['hebei_n', 'beijing', 'tianjin'], capital: '幽州' },
      { id: 'qi', name: '岐', cells: ['shaanxi_north', 'gansu', 'ningxia'], capital: '凤翔' },
      { id: 'qianshu', name: '前蜀', cells: ['sichuan', 'chongqing', 'shaanxi_s'], capital: '成都' },
      { id: 'wu', name: '吴', cells: ['jiangsu_s', 'anhui_s', 'jiangxi', 'shanghai'], capital: '广陵' },
      { id: 'wuyue', name: '吴越', cells: ['zhejiang'], capital: '杭州', backdrop: true },
      { id: 'nanhan', name: '南汉', cells: ['guangdong', 'guangxi'], capital: '广州', backdrop: true },
      { id: 'min', name: '闽', cells: ['fujian'], capital: '福州', backdrop: true },
      { id: 'chu', name: '楚', cells: ['hunan'], capital: '潭州', backdrop: true },
      { id: 'jingnan', name: '荆南', cells: ['hubei'], capital: '江陵', backdrop: true },
      { id: 'qidan', name: '契丹', cells: ['neimenggu', 'liaoning', 'jilin', 'heilongjiang'], backdrop: true },
      { id: 'dali', name: '大理', cells: ['yunnan', 'guizhou'], backdrop: true },
      { id: 'tubo', name: '吐蕃', cells: ['qinghai', 'xizang', 'xinjiang'], backdrop: true },
    ],
    points: [
      { id: 'sp_shangdang', name: '潞州', kind: 'pass', regionId: 'jin', city: '上党' },
      { id: 'sp_baixiang', name: '柏乡', kind: 'battle', regionId: 'houliang', city: '柏乡' },
      { id: 'sp_tongguan2', name: '潼关', kind: 'pass', regionId: 'qi', city: '潼关' },
      { id: 'sp_jianmen', name: '剑门', kind: 'pass', regionId: 'qianshu', city: '剑门' },
    ],
    rivers: ['huanghe', 'changjiang', 'huaihe', 'hanshui'],
  },

  /* ---------------- 五代：宋收列国 955—979 ---------------- */
  'fd-song': {
    dynastyId: 'five_dynasties',
    note:
      '自宋承周祚、至灭北汉（960—979）：宋据中原与淮南（淮南是后周世宗 955—958 所取，已归宋），' +
      '南唐、后蜀、南汉、北汉、吴越、荆南、楚各据一方。版图按今省界示意：「荆南」一并含楚地（963 同岁入宋）。',
    /*
      战前取 960 年（陈桥兵变之后，与上一段过渡页接得上）：此时后周已取淮南（955—958），
      故淮南（苏北、皖北）归宋；南唐只余江南。
    */
    attacker: { id: 'song', name: '宋', cells: ['henan', 'shandong', 'shaanxi_north', 'hebei_south', 'jiangsu_n', 'anhui_n'], capital: '汴州' },
    regions: [
      { id: 'nantang', name: '江南', cells: ['jiangsu_s', 'anhui_s', 'jiangxi', 'fujian', 'shanghai'], capital: '金陵' },
      { id: 'houshu', name: '后蜀', cells: ['sichuan', 'chongqing', 'shaanxi_s'], capital: '成都' },
      { id: 'nanhan', name: '南汉', cells: ['guangdong', 'guangxi'], capital: '广州' },
      { id: 'jingnan', name: '荆南', cells: ['hubei', 'hunan'], capital: '江陵' },
      { id: 'beihan', name: '北汉', cells: ['shanxi_south'], capital: '太原' },
      { id: 'wuyue', name: '吴越', cells: ['zhejiang'], capital: '杭州' },
      { id: 'qidan', name: '辽', cells: ['beijing', 'tianjin', 'hebei_n', 'shanxi_n', 'liaoning', 'jilin', 'heilongjiang', 'neimenggu'], backdrop: true },
      { id: 'dali', name: '大理', cells: ['yunnan', 'guizhou'], backdrop: true },
      { id: 'xixia', name: '西夏', cells: ['ningxia', 'gansu'], backdrop: true },
      { id: 'tubo', name: '吐蕃', cells: ['xizang', 'qinghai', 'xinjiang'], backdrop: true },
    ],
    points: [
      { id: 'sp_jianmen2', name: '剑门', kind: 'pass', regionId: 'houshu', city: '剑门' },
      { id: 'sp_caishi', name: '采石', kind: 'pass', regionId: 'nantang', city: '采石' },
      { id: 'sp_zezhou', name: '泽州', kind: 'battle', regionId: 'beihan', city: '泽州' },
      { id: 'sp_xiangyang', name: '襄阳', kind: 'pass', regionId: 'jingnan', city: '襄阳' },
    ],
    rivers: ['huanghe', 'changjiang', 'huaihe', 'hanshui', 'ganjiang'],
  },

  /* ---------------- 宋：元灭宋 1273—1279 ---------------- */
  'song-yuan': {
    dynastyId: 'song',
    note:
      '襄阳既破，元军顺汉水入江、顺江东下：临安出降、四川陷落、崖山蹈海（1273—1279）。' +
      '版图按今省界示意：元取淮河以北及云贵，宋存四川、荆湖、江浙、闽广四区（当年元已并大理，故不单列）。',
    attacker: { id: 'yuan', name: '元', cells: ['hebei_n', 'hebei_south', 'beijing', 'tianjin', 'shanxi_n', 'shanxi_south', 'shandong', 'henan', 'shaanxi_north', 'shaanxi_s', 'gansu', 'ningxia', 'neimenggu', 'liaoning', 'jilin', 'heilongjiang', 'xinjiang', 'xizang', 'qinghai', 'yunnan', 'guizhou', 'jiangsu_n', 'anhui_n'], capital: '大都' },
    regions: [
      { id: 'sichuan', name: '四川', cells: ['sichuan', 'chongqing'], capital: '重庆' },
      { id: 'jinghu', name: '荆湖', cells: ['hubei', 'hunan'], capital: '江陵' },
      { id: 'linan', name: '临安', cells: ['jiangsu_s', 'zhejiang', 'anhui_s', 'jiangxi', 'fujian', 'shanghai'], capital: '临安' },
      { id: 'minguang', name: '闽广', cells: ['guangdong', 'guangxi'], capital: '广州' },
    ],
    points: [
      { id: 'sp_xiangyang', name: '襄阳', kind: 'battle', regionId: 'jinghu', city: '襄阳' },
      { id: 'sp_ezhou', name: '鄂州', kind: 'city', regionId: 'jinghu', city: '武昌' },
      { id: 'sp_yashan', name: '崖山', kind: 'battle', regionId: 'minguang', city: '崖山' },
      { id: 'sp_jianmen3', name: '剑门', kind: 'pass', regionId: 'sichuan', city: '剑门' },
      { id: 'sp_luzhou', name: '泸州', kind: 'city', regionId: 'sichuan', city: '泸州' },
    ],
    rivers: ['huanghe', 'changjiang', 'huaihe', 'hanshui', 'xiangjiang', 'ganjiang'],
  },

  /* ---------------- 元：明北伐 1368—1382 ---------------- */
  'yuan-ming': {
    dynastyId: 'yuan',
    note:
      '洪武元年前后北伐：先取山东、河南，直下大都，再平山西、陕西，1371 降明夏，1382 平云南（1368—1382）。' +
      '版图按今省界示意：关中是元将李思齐、张良弼所据，仍系于元（旧版单列「关中」为无意义模块，已并入）。',
    attacker: { id: 'ming', name: '明', cells: ['jiangsu_n', 'jiangsu_s', 'anhui_n', 'anhui_s', 'zhejiang', 'jiangxi', 'shanghai', 'fujian', 'guangdong', 'guangxi', 'hubei', 'hunan'], capital: '应天' },
    regions: [
      { id: 'yuan', name: '元', cells: ['hebei_n', 'hebei_south', 'beijing', 'tianjin', 'shanxi_n', 'shanxi_south', 'shandong', 'henan', 'neimenggu', 'liaoning', 'jilin', 'heilongjiang'], capital: '大都' },
      { id: 'shaanxi', name: '陕甘', cells: ['shaanxi_north', 'shaanxi_s', 'gansu', 'ningxia'], capital: '奉元' },
      { id: 'xifan', name: '西番诸部', cells: ['xinjiang', 'qinghai', 'xizang'], backdrop: true },
      { id: 'xia', name: '夏', cells: ['sichuan', 'chongqing'], capital: '重庆' },
      { id: 'liang', name: '梁王', cells: ['yunnan', 'guizhou'], capital: '中庆' },
    ],
    points: [
      { id: 'sp_jining', name: '济宁', kind: 'battle', regionId: 'yuan', city: '济州' },
      { id: 'sp_henan', name: '汴梁', kind: 'battle', regionId: 'yuan', city: '汴州' },
      { id: 'sp_taiyuan2', name: '太原', kind: 'battle', regionId: 'yuan', city: '太原' },
      { id: 'sp_xiaoguan', name: '萧关', kind: 'pass', regionId: 'shaanxi', city: '萧关' },
      { id: 'sp_tongzhou', name: '通州', kind: 'city', regionId: 'ming', city: '扬州' },
    ],
    rivers: ['huanghe', 'changjiang', 'huaihe', 'hanshui'],
  },

  /* ---------------- 明：清兵入关 1644—1646 ---------------- */
  'ming-qing': {
    dynastyId: 'ming',
    note:
      '甲申之年：大顺入京、清兵入关、南明立于金陵、大西据蜀（1644—1646）。' +
      '版图按今省界示意：清据东北与漠南，大顺据华北关中，南明据江淮以南，大西据巴蜀，卫拉特诸部为背景。',
    attacker: { id: 'qing', name: '清', cells: ['liaoning', 'jilin', 'heilongjiang', 'neimenggu'], capital: '盛京' },
    regions: [
      { id: 'dashun', name: '大顺', cells: ['shaanxi_north', 'shaanxi_s', 'shanxi_n', 'shanxi_south', 'henan', 'hebei_south', 'hebei_n', 'beijing', 'tianjin', 'shandong', 'gansu', 'ningxia'], capital: '西安' },
      { id: 'nanming', name: '南明', cells: ['jiangsu_n', 'jiangsu_s', 'anhui_n', 'anhui_s', 'zhejiang', 'jiangxi', 'fujian', 'shanghai', 'hubei', 'hunan', 'guangdong', 'guangxi', 'yunnan', 'guizhou'], capital: '南京' },
      { id: 'daxi', name: '大西', cells: ['sichuan', 'chongqing'], capital: '成都' },
      { id: 'weila', name: '卫拉特', cells: ['xinjiang', 'qinghai', 'xizang'], backdrop: true },
    ],
    points: [
      { id: 'sp_ningyuan', name: '宁远', kind: 'city', regionId: 'qing', city: '宁远' },
      { id: 'sp_beijing', name: '北京', kind: 'city', regionId: 'dashun', city: '北京' },
      { id: 'sp_yangzhou', name: '扬州', kind: 'battle', regionId: 'nanming', city: '扬州' },
      { id: 'sp_tongguan3', name: '潼关', kind: 'pass', regionId: 'dashun', city: '潼关' },
      { id: 'sp_jianmen4', name: '剑门', kind: 'pass', regionId: 'daxi', city: '剑门' },
    ],
    rivers: ['huanghe', 'changjiang', 'huaihe'],
  },

  /* ---------------- 清：辛亥革命 1911—1912 ---------------- */
  'qing-xinhai': {
    dynastyId: 'qing',
    note:
      '武昌首义后十余省相继独立，袁世凯北洋军南下，南北议和，清帝退位（1911—1912）。' +
      '版图按今省界示意：革命军据长江以南，北洋据豫鲁，清廷据华北、西北与东北，川滇单列（旧版「独立各省」语义含混，已并入革命军）。',
    attacker: { id: 'geming', name: '革命军', cells: ['hubei', 'hunan', 'jiangxi'], capital: '武昌' },
    regions: [
      { id: 'qingting', name: '清廷', cells: ['hebei_n', 'hebei_south', 'beijing', 'tianjin', 'shanxi_n', 'shanxi_south', 'shaanxi_north', 'gansu', 'ningxia', 'neimenggu', 'liaoning', 'jilin', 'heilongjiang', 'xinjiang', 'xizang', 'qinghai'], capital: '北京' },
      { id: 'dongnan', name: '东南', cells: ['jiangsu_n', 'jiangsu_s', 'anhui_n', 'anhui_s', 'zhejiang', 'shanghai', 'fujian', 'guangdong', 'guangxi'], capital: '南京' },
      { id: 'beiyang', name: '北洋', cells: ['henan', 'shandong'], capital: '彰德' },
      { id: 'chuandian', name: '川滇', cells: ['sichuan', 'chongqing', 'yunnan', 'guizhou', 'shaanxi_s'], capital: '成都' },
    ],
    points: [
      { id: 'sp_hankou', name: '汉口', kind: 'battle', regionId: 'geming', city: '汉口' },
      { id: 'sp_yuezhou', name: '岳州', kind: 'city', regionId: 'geming', city: '岳州' },
      { id: 'sp_bianzhou', name: '汴州', kind: 'city', regionId: 'beiyang', city: '汴州' },
      { id: 'sp_shanhaiguan', name: '山海关', kind: 'pass', regionId: 'qingting', city: '山海关' },
      { id: 'sp_hukou', name: '湖口', kind: 'pass', regionId: 'geming', city: '九江' },
    ],
    rivers: ['huanghe', 'changjiang', 'huaihe', 'hanshui'],
  },
}

/* -------------------------------------------------------------------------- */
/* 生成                                                                        */
/* -------------------------------------------------------------------------- */
const fmtRing = (ring) => ring.map((p) => `${p[0]},${p[1]}`).join(' ')
const fmtRivers = (names) => names.map((n) => {
  if (!RIVERS[n]) throw new Error(`未知河流：${n}`)
  return riverPath(RIVERS[n])
})

/* 四个古战场（周/秦/汉/晋）：与七盘同一套生成流程，只是疆域来自 ancient-maps.mjs */
Object.assign(MAPS, ANCIENT_MAPS)

const wanted = process.argv.slice(2)
const todo = wanted.length ? wanted : Object.keys(MAPS)

let failed = false
for (const id of todo) {
  const spec = MAPS[id]
  if (!spec) {
    console.error(`未知沙盘：${id}`)
    failed = true
    continue
  }

  /* 1. 单元必须不重不漏 */
  const used = new Map()
  for (const r of [spec.attacker, ...spec.regions]) {
    r.cells = expand(r.cells)
    for (const c of r.cells) {
      if (!CELL[c]) throw new Error(`${id}: 未知单元 ${c}`)
      if (used.has(c)) throw new Error(`${id}: 单元 ${c} 被 ${used.get(c)} 与 ${r.id} 重复占用`)
      used.set(c, r.id)
    }
  }
  const missing = ALL_CELLS.filter((c) => !used.has(c))
  if (missing.length) throw new Error(`${id}: 有单元没分配：${missing.join(',')}`)

  /* 2. 逐区并集 */
  const build = (r, isAttacker) => {
    const { ring, extraArea } = unionRings(r.cells.map((c) => CELL[c].rings[0]))
    if (!ring || ring.length < 3) throw new Error(`${id}: ${r.id} 并集失败`)
    if (extraArea > 1) {
      throw new Error(
        `${id}: ${r.id} 的疆域不连片（另有 ${extraArea.toFixed(0)} 的碎片被丢弃）——` +
          `请拆成两个政权或调整单元分配`,
      )
    }
    const area = ringArea(ring)
    // 背景势力不标国都：它们不参与推演；太小的小国（如定杨只有雁门以北）也只留国名，
    // 否则「国名 + 国都」两块文字必然压在一起
    // 单元切细之后（韩只剩河南西 883、魏只剩大梁 1360）门槛要放低，否则小国没有国都
    const capital = r.capital && !r.backdrop && area >= 700 ? city(r.capital) : null
    return {
      id: r.id,
      name: r.name,
      points: fmtRing(ring),
      labelSize: labelSize(area, 14, isAttacker ? 34 : 32),
      _ring: ring,
      _area: area,
      _capital: capital ? { name: r.capital, x: capital[0], y: capital[1] } : null,
    }
  }

  const attacker = build(spec.attacker, true)
  const regions = spec.regions.map((r) => build(r, false))

  /*
    2b. 国名选址：国都（16px）与要地（12px）是钉死的地理位置，先占位；
    再按面积从大到小给国名挑一块不重叠、且尽量靠内的位置。
  */
  const all = [attacker, ...regions]
  const fixedBlocks = []
  for (const r of all) {
    if (r._capital) {
      // 国都文字画在圆点**下方 21px**（见 WarringStatesMap 的 capital-label），障碍块要跟着下移
      fixedBlocks.push({
        x: r._capital.x,
        y: r._capital.y + 21,
        w: r._capital.name.length * 16 * 1.12,
        h: 21,
      })
    }
  }
  /*
    2c. 要地先定（它们钉在城市上，只能调标签方位），并进障碍表；
        再给国名选址 —— 这样国名不会压到关隘上。
  */
  const points = spec.points.map((p) => {
    const [x, y] = city(p.city)
    const owner = all.find((r) => r.id === p.regionId)
    const ok = owner && pointInRing([x, y], owner._ring)
    if (!ok) console.error(`  ⚠ ${id}: 要地 ${p.name}(${p.city}) 不在 ${p.regionId} 境内`)
    const off = pickPointOffset([x, y], p.name, fixedBlocks)
    const halfW = (p.name.length * 12 * 1.12) / 2
    fixedBlocks.push({
      x: off.anchor === 'start' ? x + off.dx + halfW : off.anchor === 'end' ? x + off.dx - halfW : x + off.dx,
      y: y + off.dy,
      w: p.name.length * 12 * 1.12,
      h: 16,
    })
    return {
      id: p.id,
      name: p.name,
      kind: p.kind,
      regionId: p.regionId,
      x,
      y,
      dx: off.dx,
      dy: off.dy,
      anchor: off.anchor,
      description: p.description ?? '',
    }
  })

  /* 2d. 国名选址：避开国都与要地，并尽量贴着国都 */
  const labelMap = placeLabels(
    all.map((r) => ({
      ring: r._ring,
      name: r.name,
      size: r.labelSize,
      area: r._area,
      anchor: r._capital ? [r._capital.x, r._capital.y] : undefined,
      ref: r,
    })),
    fixedBlocks,
  )
  for (const [item, pos] of labelMap) {
    item.ref.label = pos
    // 放不下时 placeLabels 会缩字号，这里要把实际用的字号写回输出
    item.ref.labelSize = Math.round(item.size * 10) / 10
  }

  /* 3. 面积、重叠、国都、要地 */
  const total = all.reduce((s, r) => s + ringArea(r._ring), 0)
  const areaOk = Math.abs(total - BASE_TOTAL) / BASE_TOTAL < 0.002

  let seed = 20261115
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296), seed / 4294967296)
  let overlaps = 0
  for (let i = 0; i < 30000; i++) {
    const pt = [rnd() * 1000, rnd() * 640]
    let hits = 0
    for (const r of all) if (pointInRing(pt, r._ring)) hits++
    if (hits > 1) overlaps++
  }

  const badCap = all.filter((r) => r._capital && !pointInRing([r._capital.x, r._capital.y], r._ring))
  const out = {
    dynastyId: spec.dynastyId,
    note: spec.note,
    attacker: {
      id: attacker.id,
      name: attacker.name,
      points: attacker.points,
      label: attacker.label,
      labelSize: attacker.labelSize,
      ...(attacker._capital ? { capital: attacker._capital } : {}),
    },
    regions: regions.map((r) => ({
      id: r.id,
      name: r.name,
      points: r.points,
      label: r.label,
      labelSize: r.labelSize,
      ...(r._capital ? { capital: r._capital } : {}),
      ...(spec.regions.find((x) => x.id === r.id)?.backdrop ? { neutral: true } : {}),
      ...(spec.regions.find((x) => x.id === r.id)?.aliveTo
        ? { aliveTo: spec.regions.find((x) => x.id === r.id).aliveTo }
        : {}),
    })),
    rivers: fmtRivers(spec.rivers),
    points,
    ...(spec.successor ? { successor: spec.successor } : {}),
  }

  writeFileSync(`src/data/${id}.geo.json`, JSON.stringify(out, null, 2) + '\n', 'utf8')
  // 坐标取 0.1 位小数，相邻块交界处会有极细的舍入重叠（3 万个采样点里 1—2 个），可接受
  const status = areaOk && overlaps <= 5 && badCap.length === 0 ? '✓' : '⚠'
  console.log(
    `${id}: ${all.length} 块，面积和 ${total.toFixed(0)}/${BASE_TOTAL}，重叠采样 ${overlaps}，` +
      `国都异常 ${badCap.length}，要地 ${points.length} ${status}`,
  )
  if (badCap.length) console.error('   国都不在境内：', badCap.map((r) => `${r.id}·${r._capital.name}`).join(','))
  if (!areaOk) console.error(`   面积和偏差过大：${total} vs ${BASE_TOTAL}`)
}

if (failed) process.exitCode = 1
