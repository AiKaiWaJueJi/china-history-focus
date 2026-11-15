# 中国历史 · 多维学习工具

一个把「朝代 → 帝王 → 战役」串起来的历史学习站点：主页看十二朝，点进去是**帝王时间轴**，
翻到末页下滑是**收尾过渡页**（三幕逐字浮现），演完进**沙盘**——在地图上按年份推演灭国战或统一战，最后回到下一朝。

技术栈：Vite + React 19 + TypeScript + Zustand + framer-motion + react-router v7。
无后端，数据全在 `src/data/*.json`。

---

## 现在能玩什么

| 朝代 | 时间轴 | 并行结构 | 收尾过渡 | 沙盘 | 下一站 |
|---|---|---|---|---|---|
| 周 | 37 君 / 分段轴 + 诸侯层 | — | 九鼎入秦 | 战国（秦灭六国） | 秦 |
| 秦 | 3 帝 | — | 秦亡 | 楚汉（秦亡到汉立） | 漢 |
| 漢 | 27 帝 / 两处段间过渡 | — | 汉魏禅代 | 三国归晋 | 晋 |
| 晋 | 15 帝 / 6 页 | — | 晋宋禅代 | 十六国势力变迁 | 南北朝 |
| 南北朝 | 54 帝 | 五行并行 · 8 页 | 8 个易代节点 | 周灭齐 → 隋代周 → 灭陈 | 隋 |
| 隋 | 3 帝 | — | 江都之变 | 唐统一战争 | 唐 |
| 唐 | 21 帝 / 9 页 | — | 朱温篡唐 | 梁晋争霸 | 五代 |
| 五代十国 | 14 帝（中原） | **9 行并行 · 5 页** | 陈桥兵变 | 宋收列国 | 宋 |
| 宋 | 18 帝 | — | 崖山 | 元灭宋 | 元 |
| 元 | 11 帝 | — | 红巾北伐 | 明北伐 | 明 |
| 明 | 16 帝 | — | 甲申之变 | 清兵入关 | 清 |
| 清 | 12 帝 | — | 清帝退位 | 辛亥革命 | 主页 |

> 时间轴/过渡页/沙盘三类页面共用一套交互：滚轮或 ← → 翻页，ESC 返回，末页继续下滑进入下一段。

---

## 启动

```bash
npm install
npm run dev -- --port 5180      # http://localhost:5180
npm run build                   # 先跑 tsc -b，再 vite build
npx tsc -b --pretty false       # 只做类型检查
```

> dev server 是普通后台进程，**机器/DSH 重启后要重新起**。端口 5180 是各验收脚本的默认地址，
> 换端口时给脚本传 `APP_URL`。

---

## 验收

26 个脚本、约 660 条断言，全部跑一遍约 8 分钟（需要 dev server 在跑）：

> 一条命令跑全量：`node scripts/run-all-verify.mjs`（几何 4 套 + UI 22 套，逐套汇总）。

```bash
# UI：21 套 545 条
node verify-gallery.mjs      # 24   主页
node verify-dwell.mjs        #  8   悬停驻留
node verify-timeline.mjs     # 20   时间轴
node verify-dual.mjs         # 33   天子 + 诸侯双层
node verify-fall.mjs         # 25   周室倾覆过渡页
node verify-dongqian.mjs     # 20   平王东迁段间过渡
node verify-qin.mjs          # 27   秦朝 + 楚漢入口
node verify-chuhan.mjs       # 13   楚漢沙盘
node verify-sandbox-note.mjs #  7   沙盘文案口径
node verify-endgame.mjs      # 108  战国沙盘（最全）
node verify-han.mjs          # 19   漢朝时间轴
node verify-sanguo.mjs       # 16   三国沙盘
node verify-map-points.mjs   #  6   三图要地/关隘方位
node verify-han-visuals.mjs  #  6   漢朝过渡配图
node verify-jin.mjs          # 12   晋朝时间轴
node verify-jin-sandbox.mjs  # 17   十六国沙盘
node verify-nanbei.mjs       # 45   南北朝 8 页分页
node verify-nanbei-end.mjs   # 15   南北朝收尾沙盘
node verify-frame.mjs        # 60   七朝骨架（隋唐宋元明清）
node verify-wudai.mjs        # 15   五代十国并行时间轴
node verify-sandbox.mjs      # 91   七朝沙盘（底板/疆域/要地/路线 + UI）
node verify-segment-intro.mjs # 84   段间过渡（周秦汉晋唐五代宋清：下滚进页 / 上滚返回 / 演完落点）

# 几何：4 套 28 条（离线，不需要 dev server）
node check-zhanguo-geo.mjs   # 9   战国七雄
node check-chuhan-geo.mjs    # 9   楚漢八国
node check-sanguo-geo.mjs    # 9   三国鼎立
node check-sui-geo.mjs       # 9   南北朝收尾
```

**面积守恒**是最狠的一条，而且现在有两套底板，别混用：

**十一盘沙盘共用一块底板**（第三轮统一）：真实省界简化出的 **42 个古地理单元**
  （河南切洛阳 / 大梁 / 宋卫 / 南阳，山西切代北 / 晋中 / 晋南 / 上党，河北切燕北 / 中山 / 邯郸，陕西切陕北 / 关中 / 汉中），
  政权 = 单元并集，面积和 == **208736**。
  - 七朝（隋唐五代宋元明清）的疆域写在 `scripts/make-sandbox-geo.mjs` 的 `MAPS`；
  - 四朝（周秦漢晋）的疆域写在 `scripts/lib/ancient-maps.mjs`；
  - 生成链：`build-china-base.mjs → make-sandbox-geo.mjs → fix-campaign-geo.mjs`（详见 HANDOFF §3.13）。

截图：puppeteer-core + 本机 Edge，headless，输出到 `shots/vNN/`（已在 `.gitignore`）。

---

## 目录速览

```
src/
  App.tsx                 路由（DynastyRoute / EndgameRoute 两个分流）
  data/                   全部数据 + 注册表（emperorData.ts）
  features/gallery/       朝代主页
  features/emperor-timeline/ 帝王时间轴（DynastyDetail / NanBeiTimeline / WuDaiTimeline）
  features/fall/          过渡页（三幕逐字 + 器物图 + CHAPTERS 注册表）
  features/endgame/       沙盘（地图 / 路线 / 战报 / 势力变迁）
  assets/                 过渡页配图（豆包生成，裁角标压 1600×900）
public/portraits/         帝王画像（漢为历史画像 webp，其余为程序化占位 SVG）
scripts/                  生成器（占位图 / 沙盘版图 / 谥法口径 / 图片裁切）
  data/china-cells.json   沙盘底板：35 个地理单元（真实省界投影简化）
  data/china-provinces-100000.json  底板真源（省界 GeoJSON）
  lib/geo-lib.mjs         投影 / 城市表 / 多边形并集 / 标签排布
  lib/cities-hist.mjs     史书行军地名坐标补表
  make-sandbox-geo.mjs    七盘版图生成器（单元 → 政权）
  fix-campaign-geo.mjs    行军路线坐标（地名 → 百分比）
  run-all-verify.mjs      一键跑全量验收
docs/                     HANDOFF.md（施工图）、CHANGELOG.md（更新日志）
```

---

## 接手指南

1. **先读 [docs/HANDOFF.md](docs/HANDOFF.md)**：架构约定、口径红线、目录地图、验收清单、待办都在里面；
   本仓库的"不许改回去"清单在 §7。
2. 再扫一眼 [docs/CHANGELOG.md](docs/CHANGELOG.md) 了解这一路怎么演进过来的。
3. 动手前先跑 `npx tsc -b` 与相关 `verify-*.mjs`，确认基线；改完再跑一次全量。
4. 加一个朝代的标准流程见 HANDOFF §4（数据 → 注册 → 过渡页 → 沙盘 → 验收）。

---

## 已知取舍（不是 bug）

- **沙盘版图是「真实省界 + 史实归属」的示意图**：底板是中国真实省界（`scripts/data/china-cells.json`，35 个地理单元），
  每个政权 = 若干单元的并集（唐 = 关中 + 河东 + 巴蜀…），所以轮廓是真中国轮廓、边界是真山河省界；
  面积守恒（208772）、单元无缺块、两两不重叠、国都/要地/行军端点落在各自境内都由脚本校验。
  旧版的「种子点 Voronoi」已废弃——那样切出来的边界是等距垂线，与史实疆域无关。
- **七朝沙盘现在有行军路线**：每幕按「地名 → 经纬度 → 百分比坐标」生成，主将、起止、途经都照史料（《旧唐书》《通鉴》《宋史》《元史》《明史》《清史稿》），
  共 34 幕 / 90 余段；坐标口径与战国/楚汉/三国/南北朝四盘一致（百分比），别改回绝对坐标，否则线会画到画布外。
- **画像不是史料**：漢以外全是程序化占位 SVG（颜色 + 冠式 + 袍形），别当历史写真用。
- **五代十国只有中原行挂帝王卡**：十国君主多为国主/王，不入帝系，用「政权带」表达，与南北朝「十六国余部」同一口径。
- **过渡页无图时自动降级**：`FallStage.ART` 里查不到 `art` 键就改单栏居中排版，**不要拿无关图兜底**。
