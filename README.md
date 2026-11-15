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

25 个脚本、573 条断言，全部跑一遍约 6 分钟（需要 dev server 在跑）：

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
node verify-sandbox.mjs      # 49   七朝沙盘（几何 + UI）

# 几何：4 套 28 条（离线，不需要 dev server）
node check-zhanguo-geo.mjs   # 5   战国七雄
node check-chuhan-geo.mjs    # 7   楚漢八块
node check-sanguo-geo.mjs    # 9   三国四块
node check-sui-geo.mjs       # 7   南北朝四块
```

**面积守恒**是最狠的一条：同一块大陆轮廓（面积 433135）的所有分块面积之和必须相等、两两不重叠。
七朝沙盘的版图由 `scripts/make-sandbox-geo.mjs` 生成（种子点 ←→ 剖分），改方位只改脚本里的 SPECS。

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

- **沙盘版图是示意图**：七朝沙盘用 Voronoi 直线剖分，不是手绘海岸线；但面积守恒、不重叠、国都在境内、行军起止落在各自境内都成立。
- **画像不是史料**：漢以外全是程序化占位 SVG（颜色 + 冠式 + 袍形），别当历史写真用。
- **五代十国只有中原行挂帝王卡**：十国君主多为国主/王，不入帝系，用「政权带」表达，与南北朝「十六国余部」同一口径。
- **过渡页无图时自动降级**：`FallStage.ART` 里查不到 `art` 键就改单栏居中排版，**不要拿无关图兜底**。
