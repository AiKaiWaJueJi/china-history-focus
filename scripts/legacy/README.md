# legacy · 已废弃的楚汉地理管线（不要运行）

这些文件属于楚汉沙盘「九国版」时代的实现，与当前代码不一致，仅作历史留档：

| 文件 | 说明 |
|---|---|
| `chuhan-9state.geo.json` | 旧生成的 9 国疆域（含九江），**不是**当前真源 |
| `gen-chuhan-geo.mjs` | 生成上面那份 geo 的脚本 |
| `apply-chuhan-geo.mjs` | 读上面那份 geo，回写 `src/features/endgame/mapGeometry.ts` 的楚汉段 |

当前真源：

- 疆域：`src/data/chuhan.geo.json`（8 块，含攻方「汉」）
- 地图配置：`src/features/endgame/chuhanMap.ts`
- 几何校验：`node check-chuhan-geo.mjs`

注意：若运行 `apply-chuhan-geo.mjs`，楚汉图会被退回旧版
（区域 id 为 `guanzhong/chu/jiujiang`），与 `endgame.chuhan.json` 的 `nationId`
对不上——区域没有战报、面积守恒校验也会失败。这就是把它们挪进 `legacy/` 的原因。
