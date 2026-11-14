# 交接文档 · 中国历史多维学习工具

> 写给"下一个我"或接手的人。读完这份文档，不需要翻聊天记录就能继续干活。
> 最后更新：楚汉沙盘完成、地图重构回战国剖分之后。

---

## 0. 一句话现状

周、秦两朝已做到"帝王时间轴 → 收尾过渡页 → 战役沙盘"的完整链路，楚汉沙盘已就位；**汉朝尚未开始**。

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
    endgame.<id>.json          沙盘（周=战国，秦=楚汉）
    fall.<id>.json             过渡章节（收尾）
    fall.<id>.<chapter>.json   过渡章节（段间，如 zhou.dongqian）
    chuhan.geo.json            楚汉疆域（被 chuhanMap.ts 读取）
  features/
    gallery/                   朝代主页
    emperor-timeline/          帝王时间轴
    fall/                      过渡页（三幕 + 逐字 + 实拍图）
    endgame/                   沙盘（地图 / 战役路线 / 战报）
public/portraits/*.svg         程序化生成的画像（420×520）
```

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

### 3.2 朝代的收尾走哪条路

```ts
// fall.<id>.json
"next": { "kind": "endgame" }                    // 进沙盘（周、秦）
"next": { "kind": "timeline", "page": 4 }        // 回时间轴某页（周·平王东迁）
"next": { "kind": "home" }                       // 回主页（备用）
"back": { "page": "last" }                       // 上滚确认后落在哪页
```

### 3.3 末页入口按钮的文案来源

`emperorData.getDynastyClosingLabel()`：
1. 优先取**过渡页副题**（周=周室倾覆、秦=秦亡）
2. 没有过渡页才取沙盘副题

> 这里踩过坑：一度错取沙盘副题，导致周显示成"秦灭六国"。

### 3.4 段间过渡（西周 → 东周）

`DynastyDetail` 里的 `SEGMENT_INTROS`：

```ts
{ zhou: { seg_dongzhou: { chapter: 'dongqian', label: '平王东迁' } } }
```

触发页不写死：由「目标分段第一位君主所在页」倒推上一页。
`useWheelPaging` 增加 `onLeavePage(from)` 钩子，返回 `true` 表示这次下滑被消费。

### 3.5 沙盘地图是可配置的

```ts
interface MapSpec { attacker: MapRegion; regions: MapRegion[]; rivers: string[] }
```

- `MAPS = { zhanguo, chuhan }`
- `EndgameStage`：`endgame.mapId === 'chuhan' ? CHUHAN_MAP : MAPS[mapId]`
- `WarringStatesMap` 接收 `mapSpec`，**内部不允许再出现 `QIN_REGION` 这类硬编码**（曾经写死过"秦"字和攻方判定）

### 3.6 一役兼灭多国

```json
{ "nationId": "xichu", "alsoCaptures": ["jiujiang"] }
```

`isCaptured()` 会额外检查 `alsoCaptures`。

> 但**能不用就不用**：九江曾靠这条被"顺带归汉"，结果时间轴上看不到它何时亡，最后被删掉了。
> 除非确实同一天灭亡，否则给独立节点。

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
   FALL.han = fallHanRaw      // 有收尾过渡才注册
   ```
5. 画像：`public/portraits/han-*.svg`（420×520，程序化风格，参照现有文件）
6. 若跨时段（如西汉→新→东汉），在 `SEGMENT_INTROS` 加段间过渡
7. 跑测试 + 截图验收

---

## 5. 验收

### 5.1 九套 UI 脚本（共 278 条断言）

```bash
node verify-gallery.mjs      # 24  主页
node verify-dwell.mjs        #  8  悬停驻留
node verify-timeline.mjs     # 20  时间轴
node verify-dual.mjs         # 33  天子+诸侯双层
node verify-fall.mjs         # 25  周室倾覆过渡页
node verify-dongqian.mjs     # 20  平王东迁段间过渡
node verify-qin.mjs          # 27  秦朝 + 楚汉入口
node verify-chuhan.mjs       # 13  楚汉沙盘
node verify-endgame.mjs      # 108 战国沙盘（最全）
```

### 5.2 几何验收（6 条）

```bash
node check-chuhan-geo.mjs
```

**面积守恒**是最狠的一条：八块面积之和必须等于战国全图面积。
有空洞或少画一块，这个数立刻对不上。

### 5.3 截图

`puppeteer-core` + Edge（`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`），headless，`page.setCacheEnabled(false)`。
截图存 `shots/vNN/`。

---

## 6. 待办

| 优先级 | 事项 | 备注 |
|---|---|---|
| 高 | **汉朝数据** | 西汉 12 帝 + 新朝 + 东汉 14 帝；画像缺 26 张，需按现有程序化规则补 |
| 中 | 路线说明文字与地名避让 | `CampaignRoutes.captionAt()` 只避开国名，没避开 `capital` |
| 中 | 汉（楚汉图）那块偏小 | 需要重新剖分西南角 |
| 低 | 五代十国的"陆续登场" | `MapRegion` 已预留 `aliveFrom/aliveTo`，地图尚未使用 |
| 低 | 楚汉只有 8 块 | 十八王中仅示其要，战报里应注明"图仅示其要者" |

---

## 7. 史实口径（不可回退）

已经修正过的、容易被后人改回去的地方：

- **赵军路线**：上地 → 井陉 + 河内，**不是上党**
- **楚郡**：归《楚世家》，并注明避讳问题
- **韩**：删掉苏秦"地不满千里"（年代不合）
- **齐**：改为齐王建发兵守西界 / 王建自燕南攻
- **项燕之死**：保留两说
- **九鼎**：《周本纪》记"入秦"；"沉于泗水"是晚出传说，页面须写明
- **烽火戏诸侯**：见于《史记》，但先秦无"举烽"之制，注中须标出这一层
- **二王并立**：幽王死后平王与携王并立，《左传·昭公二十六年》与清华简《系年》可证
- **秦十五年**：前221 称帝 → 前207 出降，首尾计十五年

---

## 8. PowerShell 操作注意事项

这个项目用 pwsh 改文件，踩过的雷：

1. **here-string**：`@'...'@` 的结束符必须独占一行；`@"..."@` 内 `${}` 会被插值
2. `.Replace()` **替换所有匹配**，不是第一个 —— 改代码片段前先确认唯一性
3. **给 CSS 追加块后，删除时不要用正则切割**。曾把 `endgame.css` 切坏（多一个 `}`），整个沙盘 500 白屏
4. `git checkout -- <file>` 会被安全策略拦（`CC Safety Net`），弃改动用 `git stash push -m ... -- <file>`
5. 中文路径下 `Add-Type`/`System.Drawing` 读图可能报"路径形式不合法"，用 Pillow 更稳

---

## 9. 已知的设计取舍

- **过渡页的三层图片效果**是刻意做重的，为了"照片不像贴图"。改轻会露出矩形边界。
- **每幕文字逐字浮现且必须走完才能翻页**，是用户明确要求；点击页面可跳过打字。
- **沙盘地图是示意图**，不是精确地理。但**面积守恒**和**无重叠**必须成立。
- **画像不是历史写真**，是程序化占位图（颜色 + 冠式 + 袍形），不要当成史料。
