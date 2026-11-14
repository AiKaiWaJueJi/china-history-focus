# 交接文档 · 中国历史多维学习工具

> 写给"下一个我"或接手的人。读完这份文档，不需要翻聊天记录就能继续干活。
> 最后更新：汉朝 27 帝（漢字显示、历史画像）+ 9 张过渡场景图 + 王莽/光武两处段间过渡 + 汉魏禅代 + 三国归晋沙盘 + 三图要地校对之后。

---

## 0. 一句话现状

周、秦、漢三朝都已做到"帝王时间轴 → 收尾过渡页 → 战役沙盘"的完整链路（漢另有两处段间过渡，且过渡页已换成漢朝专属场景图）；**晋朝已做时间轴 + 两处过渡 + 十六国势力沙盘（316—420），南北朝及以后尚未开始**。

---

## 1. 技术栈与启动

- Vite + React 19 + TypeScript + Zustand + framer-motion + react-router v7
- 开发：`npm run dev -- --port 5180`（后台任务；DSH 重启后需重开）
- 构建：`npm run build`（会先跑 `tsc -b`）
- 类型检查：`npx tsc -b --pretty false`

---

## 2. 目录地图

```
src/
  App.tsx                      路由
  core/
    types.ts                   阶段一（朝代主页）类型
    emperorTypes.ts            阶段二（时间轴/沙盘）类型 ← 改这里要小心
  data/
    history.data.json          阶段一的朝代/帝王/事件（主页用）
    index.ts                   阶段一索引
    emperorData.ts             阶段二数据仓库 + 注册表 ← 加朝代在这注册
    emperors.<id>.json         帝王（含 evaluation / posthumousRule）
    segments.<id>.json         时代分段 + 标志点
    lords.<id>.json            诸侯（仅周有）
    endgame.<id>.json          沙盘（周=战国，秦=楚汉，汉=三国；晋不用此文件）
    jin.chronicle.json         晋末十六国势力沙盘（14 区域 × 13 幕，非灭国战）
    fall.<id>.json             过渡章节（收尾）
    fall.<id>.<chapter>.json   过渡章节（段间，如 zhou.dongqian、han.xin、jin.yongjia）
    chuhan.geo.json            楚汉疆域真源（被 chuhanMap.ts 读取）
    sanguo.geo.json            三国疆域真源（被 sanguoMap.ts 读取，带 aliveFrom/aliveTo）
  features/
    gallery/                   朝代主页
    emperor-timeline/          帝王时间轴
    fall/                      过渡页（三幕 + 逐字 + 实拍图）
    endgame/                   沙盘（地图 / 战役路线 / 战报）
public/portraits/*.svg         早期程序化占位画像（周/秦仍用）
public/portraits/han-*.webp    汉朝 27 帝的历史画像（630×780，来自公有领域/历史画像检索）
src/assets/han-*.jpg           汉朝三个过渡章节的 9 张场景图（豆包生成，裁去平台角标）
src/assets/jin-*.jpg           晋朝两处过渡的 6 张器物/场景图（豆包生成，无人、裁角标）
public/portraits/jin-*.svg     晋朝 15 帝的程序化占位画像（本轮明确不找图）
```

> 每张沙盘地图各有真源：战国在 `mapGeometry.ts`（`MAPS` 只有 zhanguo），
> 楚汉在 `chuhan.geo.json + chuhanMap.ts`，三国在 `sanguo.geo.json + sanguoMap.ts`。
> `scripts/legacy/` 是已废弃的九国版 geo 管线（含 `apply-chuhan-geo.mjs`），
> **永远不要运行**——跑了会把楚汉图退回旧区域 id，战报与面积守恒一起坏。

### 路由

| 路径 | 组件 |
|---|---|
| `/` | DynastyGallery |
| `/dynasty/:dynastyId` | DynastyDetail（时间轴） |
| `/dynasty/:dynastyId/fall/:chapter?` | FallStage（chapter 缺省 `fall`） |
| `/dynasty/:dynastyId/endgame` | EndgameStage |

---

## 3. 必须守住的约定

### 3.1 时间轴：一个整数表达一切

`useEndgameStore.index` = "已推进到第几幕"，`0` 是战前。
**所有派生状态（哪些国已归、路线是否播完、是否一统）都从这个整数算出来**，不另存数组。
回退 = 把 index 改小，CSS 过渡自动倒放。
总步数不写死：`EndgameStage` 把 `events.length` 注入 `store.total`（周 6 / 楚汉 7 / 三国 3），
`isFinished` 用 `index === events.length` 判断。

### 3.2 朝代的收尾走哪条路

```ts
// fall.<id>.json
"next": { "kind": "endgame" }                    // 进沙盘（周、秦、汉）
"next": { "kind": "timeline", "page": 4 }        // 回时间轴某页（周·平王东迁、汉·王莽篡汉）
"next": { "kind": "home" }                       // 回主页（备用）
"back": { "page": "last" }                       // 上滚确认后落在哪页
```

> 过渡章节按 URL 的 chapter 取（缺省 `fall`）。汉有三章：`fall`（汉魏禅代）、`xin`（王莽篡汉）、
> `zhongxing`（光武中兴）；后两章是段间过渡，`next.page` 分别指回时间轴的第 4、5 页（0 基）。

### 3.3 末页入口按钮的文案来源

`emperorData.getDynastyClosingLabel()`：
1. 优先取**过渡页副题**（周=周室倾覆、秦=秦亡、汉=汉亡）
2. 没有过渡页才取沙盘副题

> 这里踩过坑：一度错取沙盘副题，导致周显示成"秦灭六国"。

### 3.4 段间过渡（西周→东周、西汉→新→东汉）

`DynastyDetail` 里的 `SEGMENT_INTROS` 支持**一个朝代多处**过渡：

```ts
{
  zhou: { seg_dongzhou: { chapter: 'dongqian', label: '平王东迁' } },
  han: {
    seg_xin: { chapter: 'xin', label: '王莽篡漢' },
    seg_donghan: { chapter: 'zhongxing', label: '光武中兴' },
  },
}
```

触发页不写死：由「目标分段第一位君主所在页」倒推上一页。
`useWheelPaging` 增加 `onLeavePage(from)` 钩子，返回 `true` 表示这次下滑被消费。

> **分页必须按分段切**（`DynastyDetail.pages`）：先把君主按 `segmentId` 分组，再组内每 3 人一页。
> 否则段长不是 3 的倍数时（新朝只有王莽 1 人），王莽会和光武挤在同一页，
> 段间过渡就没有合法插入点，只能错位播放。周（12/25）恰好整除，改造前后分页完全一致。
> 改 `PAGE_SIZE` 或加新朝代时，先确认「段首页」存在。

### 3.5 沙盘地图是可配置的

```ts
interface MapSpec {
  attacker: MapRegion
  regions: MapRegion[]
  rivers: string[]
  empireName?: string   // 第 0 幕合体名，仅声明了才显示
  ariaLabel?: string    // 地图无障碍名
  resetHint?: string    // 悬停攻方第二行：周=六国复其疆 / 楚漢=十八王复其疆
  points?: StrategicPoint[]  // 要地/关隘：只标方位，不参与推演
  successor?: { year: number; name: string }  // 攻方易代（三国 265 魏→晋）
}
```

- `MAPS` 只剩 `{ zhanguo }`；楚漢图在 `features/endgame/chuhanMap.ts`，三国图在 `features/endgame/sanguoMap.ts`，
  由 `EndgameStage` 按 `mapId === 'chuhan' / 'sanguo'` 取
- `MapRegion.aliveFrom / aliveTo` 已启用：`WarringStatesMap` 按当前年份过滤**尚未归入攻方**的势力
  （`currentYear` 由 `preYearValue` 与上一幕的 `yearValue` 推出）。已归入版图的势力不隐藏，否则疆域会缺块；
  未登场的势力画成 `.region-unborn` 虚线幽灵轮廓占位（不可点、无国名），避免开局地图缺一块
- `successor` 只换国号、不换版图：280 年灭吴时攻方显示「晋」，但疆域仍是魏的那一块
- 要地/关隘存在 `MapSpec.points`，楚漢/三国写在 geo JSON 的 `points`，战国写在 `STRATEGIC_POINTS`；
  `verify-map-points.mjs` 与两个几何脚本会校验它们确实落在所属疆域内
- `WarringStatesMap` 接收 `mapSpec`，攻方判定一律用 `mapSpec.attacker.id`，**内部不允许再出现 `'qin'` 这类字面量**（曾写死过，导致楚漢悬停「漢」没有"回到战前"提示）

### 3.6 一役兼灭多国

```json
{ "nationId": "xichu", "alsoCaptures": ["jiujiang"] }
```

`isCaptured()` 会额外检查 `alsoCaptures`。

> 但**能不用就不用**：九江曾靠这条被"顺带归汉"，结果时间轴上看不到它何时亡，最后被删掉了。
> 除非确实同一天灭亡，否则给独立节点。

### 3.6b 终章那个大字（统一者）

沙盘推演到最后一幕，屏幕中央会浮出一个巨大的红色国号。**它不是写死的"秦"**：

```json
// endgame.*.json
"unifiedName": "秦"   // 周之沙盘：秦统一六国
"unifiedName": "漢"   // 楚汉沙盘：汉统一天下（繁体「漢」，739b130 定稿）
"unifiedName": "晋"   // 汉之沙盘：三国归晋（攻方仍是魏，265 已禅晋）
```

`EndgameStage` 渲染 `endgame.unifiedName ?? dynasty.name`。

> 繁体「漢」是刻意的视觉选择，别"顺手"改成简体。统一者字样与下一朝无关，理由见下。

> 注意这是「**谁完成了统一**」，不是「下一朝」。
> 二者现在恰好一致，但汉末的沙盘做到三国归晋，统一者已是晋而下一朝未必同——保持独立字段，不要从 `next.dynastyId` 推。

### 3.7 过渡页的图片处理

`.fall-photo-wrap` 三层：

| 层 | 作用 |
|---|---|
| `.fall-photo` | 四边线性羽化（mask），亮度 0.95 |
| `::after` | 压边渐晕，边缘压成页面底色 |
| `::before` | 背光暗晕，抹平"照片黑 vs 页面灰"的亮度台阶 |

> 曾经三层都是径向，四角被叠成纯黑，图片看不清。**不要改回径向。**

### 3.8 谥法评价

`evaluation: 'good' | 'neutral' | 'bad'` 依据《逸周书·谥法解》，表达的是**制度评价**，不是历史功过。
秦朝因"秦废谥法"，三位全 `neutral`，`posthumousRule` 统一写"秦废谥法，无谥可循"。

汉朝有两处容易误会，都是照制度而非史评：
- 汉桓帝谥"桓"，《谥法》"辟土服远曰桓"是美谥，故 `good`——尽管后世史评不佳；
- 汉灵帝谥"灵"，《谥法》"乱而不损曰灵"是恶谥，故 `bad`；
- 少帝（懿、辩）、孺子婴、王莽无谥，一律 `neutral`，`posthumousRule` 写明"无谥"的缘由。

评价色现在同时用**边框**表达（周、漢及以后所有朝代共用）：
- `good` 金（#c9a227 / 亮 #f0d99b）、`bad` 赤（#a8443a / 亮 #e57a62）、`neutral` 青灰（#6f8b83 / 亮 #a9c8bf）；
- 2px 外框 + 顶部一道评价色光带，悬浮时外发光；历史画像不再把评价色"吃掉"。

---

## 4. 怎么加一个朝代（标准流程）

以"汉"为例：

1. `src/data/emperors.han.json` —— 每位帝王：
   `id / posthumousTitle / personalName / reign / startYear / endYear / segmentId / portrait / events[] / evaluation / posthumousRule`
   - `events` 每条要有 `dimension`（military / political / culture），**每张卡建议 ≤4 条**，横向排不下
2. `src/data/segments.han.json` —— 分段 + 段内标志点
3. （可选）`src/data/fall.han.json` —— 收尾过渡页，三幕 + 出处 + 注
4. `src/data/emperorData.ts` 注册：
   ```ts
   EMPERORS.han = hanRaw
   SEGMENTS.han = segmentsHanRaw
   FALL.han = fallHanRaw      // 只影响末页按钮文案，不提供章节数据
   ```
5. `src/features/fall/FallStage.tsx` 的 `CHAPTERS` 注册章节数据——**漏这步 `/fall` 打不开**：
   ```ts
   han: { fall: fallHanRaw, xin: fallHanXinRaw, zhongxing: fallHanZhongxingRaw }
   ```
   （`fall.<id>.<chapter>.json` 与 URL 里的 chapter 段一一对应）
6. 画像：漢朝用 `public/portraits/han-*.webp`（630×780，历史画像检索所得；来源含《三才图会》系统、百度百科/360百科词条图，均为公有领域或历史插图）。
   其余朝代仍可跑 `node scripts/gen-placeholders.mjs` 生成程序化占位 SVG（漢朝已换成实图，不会再被它覆盖）。
7. 过渡页配图：每個 act 的 `art` 指向 `FallStage.ART` 里的键；漢朝 9 张图在 `src/assets/han-*.jpg`，
   由豆包生成后裁去角标再压缩为 1600×900。新朝代照此加 import + ART + ART_ALT 三项。
8. 若跨时段（如西漢→新→東漢），在 `SEGMENT_INTROS` 加段间过渡
9. 跑测试 + 截图验收

---

## 5. 验收

### 5.1 十六套 UI 脚本（共 359 条断言）

```bash
node verify-gallery.mjs      # 24  主页
node verify-dwell.mjs        #  8  悬停驻留
node verify-timeline.mjs     # 20  时间轴
node verify-dual.mjs         # 33  天子+诸侯双层
node verify-fall.mjs         # 25  周室倾覆过渡页
node verify-dongqian.mjs     # 20  平王东迁段间过渡
node verify-qin.mjs          # 27  秦朝 + 楚漢入口
node verify-chuhan.mjs       # 13  楚漢沙盘
node verify-sandbox-note.mjs #  7  沙盘文案（楚漢攻方提示 / 楚郡·项燕注 / 图例范围）
node verify-endgame.mjs      # 108 战国沙盘（最全）
node verify-han.mjs          # 19  漢朝时间轴（27 帝 / 分页 / 两处段间过渡 / 收尾进三国）
node verify-sanguo.mjs       # 16  三国沙盘（战前四块 / 辽东归魏 / 265 晋代魏 / 终章晋）
node verify-map-points.mjs   #  6  三图要地/关隘方位
node verify-han-visuals.mjs  #  6  漢朝过渡章节配图（新图、1600×900、非旧照片）
node verify-jin.mjs          # 12  晋朝时间轴（15 帝 / 6 页 / 永嘉南渡 / 晋宋禅代 / 入沙盘）
node verify-jin-sandbox.mjs  # 15  十六国沙盘（14 区域 / 316、352、376、398、420 归属 / 行军路线 / 悬停）
```

### 5.2 几何验收（21 条）

```bash
node check-zhanguo-geo.mjs   # 5  战国七雄：同一片大陆 / 不重叠 / 国都 / 关隘 / 秦含巴蜀
node check-chuhan-geo.mjs    # 7  楚漢八块：面积守恒 / 不重叠 / 国都 / 路线 / 节点 / 要地
node check-sanguo-geo.mjs    # 9  三国四块：同上 + 存活区间 + 登场年份
```

**面积守恒**是最狠的一条：楚汉八块（或三国四块）面积之和必须等于同一片大陆。
有空洞或少画一块，这个数立刻对不上。

### 5.3 截图

`puppeteer-core` + Edge（`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`），headless，`page.setCacheEnabled(false)`。
截图存 `shots/vNN/`。

---

## 6. 待办

| 优先级 | 事项 | 备注 |
|---|---|---|
| 高 | **南北朝数据** | 晋末「禅宋」已指向南北朝；十六国沙盘也已收到 420 年，但南北朝帝纪未导入（目前是空态） |
| 中 | 十六国区域为示意分区 | 14 块区域表达归属，不描精确边界；河西诸凉合为一块、河南宋魏拉锯暂系于宋，均见面板注记 |
| 中 | 路线说明文字与地名避让 | `CampaignRoutes.captionAt()` 只避开路线顶点，没避开诸国标签与 `capital` |
| 中 | 三国图面积仍偏魏 | 当前 魏 72% / 蜀 10% / 吴 12% / 辽东 5%，与史实（魏约占一半、吴蜀合占四成）有差距；同一大陆轮廓下难以再分，需重画底板 |
| 低 | 五代十国（及更后朝代） | `aliveFrom/aliveTo` 已在三国图跑通，可直接复用 |
| 低 | 楚漢 / 三国图仅示其要 | 两图均已在战报「史实注记」注明 |

---

## 7. 史实口径（不可回退）

已经修正过的、容易被后人改回去的地方：

- **赵军路线**：上地 → 井陉 + 河内，**不是上党**
- **楚郡**：归《楚世家》，并在楚战报的「史实注记」写明避讳与「楚郡」存疑（梁玉绳《史记志疑》）
- **韩**：删掉苏秦"地不满千里"（年代不合）
- **齐**：改为齐王建发兵守西界 / 王建自燕南攻
- **项燕之死**：保留两说，写在楚战报「史实注记」：《王翦列传》"杀项燕" vs《秦始皇本纪》项燕自杀、立昌平君
- **九鼎**：《周本纪》记"入秦"；"沉于泗水"是晚出传说，页面须写明
- **烽火戏诸侯**：见于《史记》，但先秦无"举烽"之制，注中须标出这一层
- **二王并立**：幽王死后平王与携王并立，《左传·昭公二十六年》与清华简《系年》可证
- **秦十五年**：前221 称帝 → 前207 出降，首尾计十五年
- **秦图西南角**：前 206 前的秦必须含巴蜀（150,470 / 250,560）；旧 polygon 的 400,540 尖角会压进韩/楚并漏掉巴蜀，已删。七块面积之和 = 同一片大陆 433135
- **函谷关**：贴秦东界，坐标 (326,310)，落在秦境内侧；不得画到魏境内
- **晋帝系**：西晋 4 帝（武、惠、怀、愍）+ 东晋 11 帝（元、明、成、康、穆、哀、海西、简文、孝武、安、恭），共 15；司马懿、司马师、司马昭是追尊，不进帝纪
- **永嘉南渡**：311 洛阳陷、317 司马睿称晋王/建康立国，作为西晋→东晋的段间过渡
- **晋宋禅代**：420 恭帝禅位刘裕，作为晋的收尾过渡；下一朝南北朝（数据待做）
- **晋画像**：按本轮要求不找图，15 张全部使用程序化占位 SVG（`public/portraits/jin-*.svg`）
- **十六国沙盘（316—420）**：14 块区域按「区域—势力」逐年换色（含岭南，东晋/宋），12 幕 + 316 开局；不是灭国战，没有攻方/守方。关键节点：319 后赵立、329 后赵灭前赵、337 前燕称王、349 后赵崩、352 前燕入河北/前秦立关中、370 前秦灭前燕、376 前秦统一北方、383 淝水、398 北魏入河北/燕分南北、407 夏与北燕、417 刘裕灭后秦、420 刘宋代晋
- **沙盘地图为无缝分区**：14 块由同一块大陆轮廓做 Voronoi 裁切，边界共享、面积和 == 轮廓面积（432425），不再用会留黑缝的手绘 polygon；区域颜色为低饱和土色系，避免花哨
- **行军路线**：329 洛阳之战、352 慕容儁入邺 + 苻健入关中、370 王猛伐燕、383 淝水、398 北魏取中山、417 刘裕北伐，共 6 幕 7 条；路径为虚线流动 + 箭头 + 光点，完整说明在右侧「行军」栏，地图上不再压长标签
- **悬停高亮**：鼠标移入任一区域，同一政权的所有区域一起高亮（金色边框 + 呼吸灯），其余区域压暗；图例 chip 也可悬停触发
- **352 年的山东、洛阳仍属东晋**：山东为段龛所据，洛阳在东晋手中；前燕要到 356 年后才逐步取之，不能提前涂成前燕
- **398 年的洛阳仍属东晋**：后秦 399 年才取洛阳，故 398 幕中原系于东晋，不能提前涂成后秦
- **420 年的关中属夏**：418 年赫连勃勃取长安，故宋有江南、荆襄、江淮、巴蜀、山东、中原，而关中归夏；河南为宋魏拉锯，图中暂系于宋
- **河西诸凉合并显示**：397 年后后凉、南凉、北凉、西凉并立，单块区域无法分列，图中合为「河西诸凉/北凉」并在注记说明
- **新朝单列**：王莽不入西漢帝系，`seg_xin` 独立一段（1 帝 1 页）；不分列更始、赤眉
- **漢字显示**：漢朝面向用户的所有文案（朝代名、帝号、过渡页、沙盘）一律用「漢」；书名《汉书》《后汉书》保持原字，不改书名
- **汉魏禅代**：220 年曹丕受禅，献帝降为山阳公；`fall.han.json` 注明"禅让程序"这一层
- **三国归晋**：漢末沙盘攻方为魏、统一者写「晋」；265 司马炎受禅，280 灭吴，注在「晋灭吴」战报；280 年攻方国号显示为「晋」
- **辽东**：238 年司马懿平公孙渊，列为三国沙盘首幕；辽东四郡自此入魏
- **三国起点**：战前取 229 年（孙权称帝、三国鼎立正式形成），故开局即见魏、蜀、吴、辽东四块
- **图仅示其要**：三国图只画魏、蜀、吴、辽东四块，其余割据势力不另出块
- **楚漢西部分界**：三秦（关中+陇西北部）与漢（巴蜀+漢中）按约 12.7% / 11.0% 重划，**漢不再是一个角上的小块**；陈仓、废丘随之北移入关中
- **画像与场景图**：漢朝 27 帝画像来自公有领域/历史画像检索（《三才图会》系统等），过渡页 9 张为豆包生成后裁去平台角标的再创作；均为艺术呈现，不是史料证据

---

## 8. PowerShell 操作注意事项

这个项目用 pwsh 改文件，踩过的雷：

1. **here-string**：`@'...'@` 的结束符必须独占一行；`@"..."@` 内 `${}` 会被插值
2. `.Replace()` **替换所有匹配**，不是第一个 —— 改代码片段前先确认唯一性
3. **给 CSS 追加块后，删除时不要用正则切割**。曾把 `endgame.css` 切坏（多一个 `}`），整个沙盘 500 白屏
4. `git checkout -- <file>` 会被安全策略拦（`CC Safety Net`），弃改动用 `git stash push -m ... -- <file>`
5. 中文路径下 `Add-Type`/`System.Drawing` 读图可能报"路径形式不合法"，用 Pillow 更稳
6. `scripts/legacy/` 是九国版楚汉 geo 的废弃管线（含 `apply-chuhan-geo.mjs`），**永远不要运行**；
   当前真源是 `src/data/chuhan.geo.json` + `features/endgame/chuhanMap.ts`
7. 用 PowerShell `Set-Content -Encoding UTF8` 写 JSON 会**带 BOM**，Node 的 `JSON.parse` 会报
   `Unexpected token '﻿'`；改 JSON 一律用 node 脚本（`fs.writeFileSync`），或事后跑一遍去 BOM。

---

## 9. 已知的设计取舍

- **过渡页的三层图片效果**是刻意做重的，为了"照片不像贴图"。改轻会露出矩形边界。
- **每幕文字逐字浮现且必须走完才能翻页**，是用户明确要求；点击页面可跳过打字。
- **沙盘地图是示意图**，不是精确地理。但**面积守恒**和**无重叠**必须成立。
- **画像不是历史写真**：漢朝用检索所得的历史画像，其余朝代仍是程序化占位图（颜色 + 冠式 + 袍形），不要当成史料。
- **画像裁切以头部优先**：纵向尺寸不足时，从顶部锚定裁切（宁可切下摆，不切头冠）；少帝刘辩的全身线描像就是靠这条保住头部的，改裁切参数后要抽查末几页。
- **过渡页 9 张场景图是 AI 生成的艺术再创作**（豆包），不是考古复原；已裁去平台角标，仅作氛围。
- **下滚 = 跳过当前一幕**：进入过渡页后的第一下惯性滚动会被 620ms 冷却吃掉；此后每下滚一次，直接结束当前幕的逐字并进下一幕（最后一幕则显示完、浮出入口）。点击页面仍然只跳过打字、不翻幕。
- **四张线描像统一做暖褐色彩化**（景帝、灵帝、献帝、少帝辩）：这四人没有可靠的彩色历史画像，网上能搜到的多数是剧照或同人图，故保留原线描、统一调成旧纸色，而不是混入影视截图。其余 23 张是彩色历代帝王像。
- **首页不再有「三国」模块**：三国（220—280）这段已由漢末沙盘「三国归晋」承担，主页只保留 12 个朝代模块（周秦汉晋南北朝隋唐五代宋元明清）。若将来要给三国做独立时间轴，才需要把 `history.data.json` 的条目与器物图加回来；不要为了凑数回加。
- **晋朝画像为程序化占位**：15 张全部 `jin-*.svg`，本轮明确不找图；过渡页 6 张为豆包生成的器物/场景图（无人物），裁去角标后压成 1600×900。
- **晋末沙盘是「势力变迁」不是「灭国战」**：`JinChronicleStage` 独立于 `EndgameStage`，路由用 `EndgameRoute` 分流；它只读 `jin.chronicle.json`，不碰 `mapGeometry` 的攻方/捕获模型。改区域归属只改 JSON 的 `control`，每一步必须覆盖全部 14 个区域 id。
