/**
 * verify-rail.mjs —— 验收脚本共用的「底部国家容器」点击
 * ===========================================================================
 * 沙盘底部那排节点（.rail-node）的语义已改为与地图一致：
 *   · 点**已打过**的国家 → 回到那一幕并直接展开战报（不重演行军）；
 *   · 点**还没打过**的国家 → 先弹「补齐推演」确认，再播行军序列，播完才弹战报。
 *
 * 早先验收脚本都是"点一下、睡 1.4s、读战报"，新逻辑下战报根本还没出来。
 * 所以统一走这一个函数：关掉残留战报 → 点节点 → 若有确认卡就确认 →
 * 派发 wheel 跳过动画 → 等**新**战报出现。
 *
 * 这是**唯一一份**实现：verify-endgame（原先自带 railTo）与 verify-journey
 * （原先内联一段）都已改为调用这里，别再造第四份。
 *
 * @param {import('puppeteer-core').Page} page
 * @param {number} index  .rail-node 的 0 基序号（0 = 战前）
 * @param {(ms:number)=>Promise<void>} sleep  各脚本自己那份 sleep
 * @param {{ closePanel?: boolean }} [opts]
 *        closePanel=true 时收尾把关掉的战报关干净（verify-endgame / verify-journey 要这个）
 * @returns {Promise<boolean>} false = 根本没找到该节点
 */
export async function clickRailNode(page, index, sleep, { closePanel = false } = {}) {
  /*
    先把残留战报关掉。
    否则下面的「等到 battle-panel 出现」会立刻命中上一场战报，
    测试读到的还是旧内容（楚汉那条用例就是这么假红过一次）。
  */
  if (await page.evaluate(() => Boolean(document.querySelector('.battle-panel')))) {
    await page.keyboard.press('Escape')
    await page.waitForSelector('.battle-panel', { hidden: true, timeout: 3000 }).catch(() => null)
    await sleep(300)
  }

  const clicked = await page.evaluate((i) => {
    const node = document.querySelectorAll('.rail-node')[i]
    if (!node) return false
    node.click()
    return true
  }, index)
  if (!clicked) return false

  /* 跳步确认：点后面的国家时会先问「要不要补齐中间几场」 */
  for (let i = 0; i < 4; i += 1) {
    await sleep(180)
    const confirmed = await page.evaluate(() => {
      const btn = document.querySelector('.conquer-confirm-primary')
      if (!btn) return false
      btn.click()
      return true
    })
    if (confirmed) break
  }

  /*
    行军动画：向下滚动 = 跳过；直到战报出现。
    注意要有「空转容忍」：点后面的国家时，播放会先等战报退场 240ms 才起播，
    这期间既没有战报也没有路线，不能一轮没看到路线就收工。
  */
  let idle = 0
  for (let i = 0; i < 40; i += 1) {
    if (await page.evaluate(() => Boolean(document.querySelector('.battle-panel')))) break
    const playing = await page.evaluate(() => document.querySelectorAll('.campaign-route').length > 0)
    if (playing) {
      idle = 0
      await page.evaluate(() =>
        document
          .querySelector('.map-stage')
          ?.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 160 })),
      )
      await sleep(280)
      continue
    }
    /* 连续 6 轮（约 1.7s）既没路线也没战报：认定为「本就不该出」（如点「战前」） */
    idle += 1
    if (idle >= 6) break
    await sleep(280)
  }

  /* 只读断言用（读战报内容）就留着；要接着点终章按钮的那两个脚本需要先关掉 */
  if (closePanel) {
    await sleep(300)
    if (await page.evaluate(() => Boolean(document.querySelector('.battle-panel')))) {
      await page.keyboard.press('Escape')
      await page.waitForSelector('.battle-panel', { hidden: true, timeout: 3000 }).catch(() => null)
      await sleep(400)
    }
  }
  return true
}
