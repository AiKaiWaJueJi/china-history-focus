/**
 * FallStage —— 周室倾覆 / 九鼎入秦（时间轴与沙盘之间的过渡）
 * ===========================================================================
 * 三页，可交互翻页，不是一条长卷：
 *
 *   第一幕 秦取九鼎   → 下滚进第二幕
 *   第二幕 周既不祀   → 下滚进第三幕
 *   第三幕 权力更迭   → 文字走完才浮出【王朝覆灭】
 *
 * 几条硬规则（都是按要求来的）：
 *   · 每页文字**逐字浮现**；此时下滚 = 跳过当前一幕（直接进下一幕），点击页面则只跳过打字
 *   · 逐字动画**只触发一次**；回到已看过的页，只播翻页动画、文字直接显示
 *   · 【王朝覆灭】只在第三幕文字走完后出现；上滚回第二幕即消失
 *   · 在第一幕再往上滚 → 弹确认框「返回帝王时间轴？」
 *   · 每幕背景不同且左右交替：鼎（左）→ 宗庙（右）→ 断符（左）
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import fallZhou from '../../data/fall.zhou.json'
import fallDongqian from '../../data/fall.zhou.dongqian.json'
import fallQin from '../../data/fall.qin.json'
import fallHan from '../../data/fall.han.json'
import fallHanXin from '../../data/fall.han.xin.json'
import fallHanZhongxing from '../../data/fall.han.zhongxing.json'
import fallJin from '../../data/fall.jin.json'
import fallJinYongjia from '../../data/fall.jin.yongjia.json'
import fallNanBei from '../../data/fall.southern_northern.json'
// 隋唐之后的七朝收尾过渡（各一章三幕）
import fallSui from '../../data/fall.sui.json'
import fallTang from '../../data/fall.tang.json'
// 唐 / 五代 / 宋 / 清 的「段间过渡页」（改朝换代处裁剪出的那一屏）
import fallTangWuzhou from '../../data/fall.tang.wuzhou.json'
import fallTangShenlong from '../../data/fall.tang.shenlong.json'
import fallFdHoutang from '../../data/fall.five_dynasties.houtang.json'
import fallFdShijin from '../../data/fall.five_dynasties.shijin.json'
import fallFdQidan from '../../data/fall.five_dynasties.qidan.json'
import fallFdHouzhou from '../../data/fall.five_dynasties.houzhou.json'
import fallSongJingkang from '../../data/fall.song.jingkang.json'
import fallQingRuquan from '../../data/fall.qing.ruquan.json'
import fallFiveDynasties from '../../data/fall.five_dynasties.json'
import fallSong from '../../data/fall.song.json'
import fallYuan from '../../data/fall.yuan.json'
import fallMing from '../../data/fall.ming.json'
import fallQing from '../../data/fall.qing.json'
import dingPhoto from '../../assets/ding-photo.jpg'
import templePhoto from '../../assets/temple-photo.jpg'
import tallyPhoto from '../../assets/tally-photo.jpg'
import burnPhoto from '../../assets/burn-photo.jpg'
import marchPhoto from '../../assets/march-photo.jpg'
import thronePhoto from '../../assets/throne-photo.jpg'
import nightridePhoto from '../../assets/nightride-photo.jpg'
import uprisingPhoto from '../../assets/uprising-photo.jpg'
import surrenderPhoto from '../../assets/surrender-photo.jpg'
import hanDongzhuo from '../../assets/han-dongzhuo.jpg'
import hanFengtianzi from '../../assets/han-fengtianzi.jpg'
import hanShanrang from '../../assets/han-shanrang.jpg'
import hanWangshi from '../../assets/han-wangshi.jpg'
import hanJushe from '../../assets/han-jushe.jpg'
import hanWangtian from '../../assets/han-wangtian.jpg'
import hanKunyang from '../../assets/han-kunyang.jpg'
import hanGengshi from '../../assets/han-gengshi.jpg'
import hanZhongxing from '../../assets/han-zhongxing.jpg'
import jinBawang from '../../assets/jin-bawang.jpg'
import jinYongjia from '../../assets/jin-yongjia.jpg'
import jinNandu from '../../assets/jin-nandu.jpg'
import jinHuanxuan from '../../assets/jin-huanxuan.jpg'
import jinBeifa from '../../assets/jin-beifa.jpg'
import jinShanrang from '../../assets/jin-shanrang.jpg'
// 南北朝 8 章过渡页配图（豆包生成 · 器物 · 16:9）
import nb439_1 from '../../assets/nb439_1.jpg'
import nb439_2 from '../../assets/nb439_2.jpg'
import nb439_3 from '../../assets/nb439_3.jpg'
import nb479_1 from '../../assets/nb479_1.jpg'
import nb479_2 from '../../assets/nb479_2.jpg'
import nb479_3 from '../../assets/nb479_3.jpg'
import nb502_1 from '../../assets/nb502_1.jpg'
import nb502_2 from '../../assets/nb502_2.jpg'
import nb502_3 from '../../assets/nb502_3.jpg'
import nb534_1 from '../../assets/nb534_1.jpg'
import nb534_2 from '../../assets/nb534_2.jpg'
import nb534_3 from '../../assets/nb534_3.jpg'
import nb577_1 from '../../assets/nb577_1.jpg'
import nb577_2 from '../../assets/nb577_2.jpg'
import nb577_3 from '../../assets/nb577_3.jpg'
import nb589_1 from '../../assets/nb589_1.jpg'
import nb589_2 from '../../assets/nb589_2.jpg'
import nb589_3 from '../../assets/nb589_3.jpg'
import nb550_1 from '../../assets/nb550_1.jpg'
import nb550_2 from '../../assets/nb550_2.jpg'
import nb550_3 from '../../assets/nb550_3.jpg'
import nb557_1 from '../../assets/nb557_1.jpg'
import nb557_2 from '../../assets/nb557_2.jpg'
import nb557_3 from '../../assets/nb557_3.jpg'
// 隋 / 唐 / 五代 三章过渡页配图（豆包生成 · 只用器物 · 无人物 · 16:9）
import sui_1 from '../../assets/sui_1.jpg'
import sui_2 from '../../assets/sui_2.jpg'
import sui_3 from '../../assets/sui_3.jpg'
import tang_1 from '../../assets/tang_1.jpg'
import tang_2 from '../../assets/tang_2.jpg'
import tang_3 from '../../assets/tang_3.jpg'
import fd_1 from '../../assets/fd_1.jpg'
import fd_2 from '../../assets/fd_2.jpg'
import fd_3 from '../../assets/fd_3.jpg'
// 宋 / 元 / 明 / 清 四章过渡页配图（同上：器物、无人物、16:9）
import song_1 from '../../assets/song_1.jpg'
import song_2 from '../../assets/song_2.jpg'
import song_3 from '../../assets/song_3.jpg'
import yuan_1 from '../../assets/yuan_1.jpg'
import yuan_2 from '../../assets/yuan_2.jpg'
import yuan_3 from '../../assets/yuan_3.jpg'
import ming_1 from '../../assets/ming_1.jpg'
import ming_2 from '../../assets/ming_2.jpg'
import ming_3 from '../../assets/ming_3.jpg'
import qing_1 from '../../assets/qing_1.jpg'
import qing_2 from '../../assets/qing_2.jpg'
import qing_3 from '../../assets/qing_3.jpg'
import './fall.css'

/** 每一幕的影像代号 —— 数据里指定，组件只负责映射到文件 */
const ART: Record<string, string> = {
  ding: dingPhoto,
  temple: templePhoto,
  tally: tallyPhoto,
  burn: burnPhoto,
  march: marchPhoto,
  throne: thronePhoto,
  nightride: nightridePhoto,
  uprising: uprisingPhoto,
  surrender: surrenderPhoto,
  han_dongzhuo: hanDongzhuo,
  han_fengtianzi: hanFengtianzi,
  han_shanrang: hanShanrang,
  han_wangshi: hanWangshi,
  han_jushe: hanJushe,
  han_wangtian: hanWangtian,
  han_kunyang: hanKunyang,
  han_gengshi: hanGengshi,
  han_zhongxing: hanZhongxing,
  jin_bawang: jinBawang,
  jin_yongjia: jinYongjia,
  jin_nandu: jinNandu,
  jin_huanxuan: jinHuanxuan,
  jin_beifa: jinBeifa,
  jin_shanrang: jinShanrang,
  nb439_1,
  nb439_2,
  nb439_3,
  nb479_1,
  nb479_2,
  nb479_3,
  nb502_1,
  nb502_2,
  nb502_3,
  nb534_1,
  nb534_2,
  nb534_3,
  nb577_1,
  nb577_2,
  nb577_3,
  nb589_1,
  nb589_2,
  nb589_3,
  nb550_1,
  nb550_2,
  nb550_3,
  nb557_1,
  nb557_2,
  nb557_3,
  sui_1,
  sui_2,
  sui_3,
  tang_1,
  tang_2,
  tang_3,
  fd_1,
  fd_2,
  fd_3,
  song_1,
  song_2,
  song_3,
  yuan_1,
  yuan_2,
  yuan_3,
  ming_1,
  ming_2,
  ming_3,
  qing_1,
  qing_2,
  qing_3,
}

const ART_ALT: Record<string, string> = {
  ding: '倾覆的青铜鼎',
  temple: '破败的周代宗庙',
  tally: '断裂的青铜符节',
  burn: '焚毁的西周宫室',
  march: '东迁的车马',
  throne: '空置的王庭',
  nightride: '夜行的辒车',
  uprising: '大泽乡揭竿',
  surrender: '素车白马出降',
  han_dongzhuo: '董卓甲士入洛阳宫',
  han_fengtianzi: '曹操奉迎漢献帝车驾',
  han_shanrang: '漢魏受禅坛',
  han_wangshi: '西漢外戚王氏朝会',
  han_jushe: '王莽居摄与孺子婴',
  han_wangtian: '新朝王田诏令',
  han_kunyang: '昆阳之战·暴雨滍水',
  han_gengshi: '赤眉入长安·宫室残破',
  han_zhongxing: '光武洛阳即位',
  jin_bawang: '西晋宫阙残破·青铜鼎与兵甲',
  jin_yongjia: '永嘉之乱·铜驼荆棘',
  jin_nandu: '衣冠南渡·长江渡口',
  jin_huanxuan: '建康宫门·兵甲玉玺',
  jin_beifa: '义熙北伐·洛阳故都',
  jin_shanrang: '晋宋禅让·受禅坛',
  nb439_1: '北魏具装马铠与铁戟',
  nb439_2: '十六国印玺、降表与断箭',
  nb439_3: '北朝马鞍与南朝楼船',
  nb479_1: '刘宋末年的残破宫灯与礼器',
  nb479_2: '萧齐受禅·玉玺与玺绶',
  nb479_3: '宋室诸王印绶与断圭',
  nb502_1: '建康城下的断箭与齐旗',
  nb502_2: '萧梁受禅·玉册与金玺',
  nb502_3: '天监年间的铜钱与量器',
  nb534_1: '洛阳永宁寺塔基残砖与铜铃',
  nb534_2: '裂为两半的铜虎符',
  nb534_3: '东西魏对峙的铠甲与箭镞',
  nb550_1: '邺城铜雀瓦当与兵符',
  nb550_2: '北齐受禅·玉璧与冕旒',
  nb550_3: '响堂山石窟佛像与香炉',
  nb557_1: '台城陷落·残破宫灯与断戟',
  nb557_2: '江陵焚书·焦卷与灰烬',
  nb557_3: '陈朝青瓷与北周铜印',
  nb577_1: '北齐宫苑·鎏金香炉与残屏',
  nb577_2: '北周府兵·明光铠与马槊',
  nb577_3: '北方一统·铜权与量器',
  nb589_1: '隋受周禅·玉玺与诏书',
  nb589_2: '隋军五牙战舰与船桨',
  nb589_3: '开皇铜钱与统一度量衡',
  sui_1: '隋亡·江都离宫的鎏金铜灯、倾倒铜盘与断弦琵琶',
  sui_2: '长安受禅坛·玉玺、玉册与玺绶',
  sui_3: '唐承隋制·青铜虎符、均田文书木匣与六部铜印',
  tang_1: '藩镇割据·明光铠、节度使铜符与散落断箭',
  tang_2: '黄巢之乱·残破开元通宝、焦黑断戟与烧残木匣',
  tang_3: '白马驿之祸·玉玺、倾倒铜印与浸水竹简',
  fd_1: '五代乱世·残破铜钱、断刀与折断枪头',
  fd_2: '后周世宗·周元通宝、铜权与量器',
  fd_3: '陈桥兵变·折叠黄袍、驿站马镫与铜印',
  song_1: '强干弱枝·禁军铜符、官印与文书木匣',
  song_2: '偏安江左·南宋青瓷、铜镜与海船铁锚',
  song_3: '崖山蹈海·残破宋瓷、断桨与沉船铁锚',
  yuan_1: '至正新政·至正通宝、交钞铜版与铜权',
  yuan_2: '群雄逐鹿·断箭、箭镞与军旗铁杆',
  yuan_3: '大都失守·玉玺、倾倒宫灯与城门铜钉',
  ming_1: '张居正之后·奏折木匣、铜印与算盘',
  ming_2: '流寇与辽东·三眼火铳、断刀与铁甲片',
  ming_3: '甲申之变·断裂玉玺、倾倒宫灯与残诏',
  qing_1: '自强求富·黄铜炮闩、望远镜与机器铭牌',
  qing_2: '变法与庚子·奏折、铜印与烧焦书册',
  qing_3: '清帝退位·诏书卷轴、铜印与纪念铜章',
}

interface FallAct {
  id: string
  /** 影像代号，见 ART 映射表 */
  art?: string
  year: string
  heading: string
  lines: string[]
  source: { book: string; text: string }
  note?: string
}

/** 第三幕走完后去哪里 */
interface FallNext {
  kind: 'endgame' | 'timeline' | 'home'
  /** kind === 'timeline' 时回落的页码；'last' 表示最后一页 */
  page?: number | 'last'
  /**
   * kind === 'timeline' 时跳到哪个朝代（缺省＝当前朝代）。
   * 时间轴按 dynastyId 泛化，所以跨朝续接只差这一个字段：
   * 隋 → 唐、唐 → 五代、五代 → 宋、宋 → 元、元 → 明、明 → 清。
   */
  dynastyId?: string
}

interface FallData {
  dynastyId: string
  title: string
  subtitle: string
  lede: string
  acts: FallAct[]
  enterLabel: string
  enterHint: string
  next?: FallNext
  /** 第一幕上滚确认后，回到时间轴的哪一页 */
  back?: { page: number | 'last' }
}

/**
 * 过渡章节注册表
 * ---------------------------------------------------------------------------
 * key 是 URL 里的 chapter 段，缺省用 DEFAULT_CHAPTER。
 * 周有两个过渡：
 *   fall      西周覆灭 → 秦取九鼎 → 进沙盘（原有）
 *   dongqian  犬戎破镐京 → 平王东迁 → 回时间轴东周首页（新增）
 * 组件完全复用，视觉与交互因此天然一致。
 */
const CHAPTERS: Record<string, Record<string, FallData>> = {
  zhou: {
    dongqian: fallDongqian as FallData,
    fall: fallZhou as FallData,
  },
  qin: {
    fall: fallQin as FallData,
  },
  han: {
    fall: fallHan as FallData,
    xin: fallHanXin as FallData,
    zhongxing: fallHanZhongxing as FallData,
  },
  jin: {
    fall: fallJin as FallData,
    yongjia: fallJinYongjia as FallData,
  },
  /*
    南北朝：8 个易代节点各一章（key = 节点 id）。
    从时间轴点节点、或翻到段末继续下滚都会进这里；演完落回下一段的时间轴页。
  */
  southern_northern: fallNanBei as unknown as Record<string, FallData>,
  /* 隋唐五代宋元明清：一朝一章，演完直接进下一朝时间轴 */
  sui: { fall: fallSui as FallData },
  /*
    唐、五代、宋、清：除收尾章外，在「改朝换代」处各有一屏段间过渡——
    与周·平王东迁、汉·王莽篡漢 / 光武中兴、晋·衣冠南渡同一套组件与交互动线。
      唐  武周革命（690 革唐为周）/ 神龙复唐（705 复国号唐）
      五代 后唐灭梁 923 / 石晋代唐 936 / 契丹灭晋 947 / 郭威建周 951
      宋  靖康之变 1127（北宋亡、南宋再造）
      清  入关定鼎 1644（后金 → 大清治中国）
  */
  tang: {
    fall: fallTang as FallData,
    wuzhou: fallTangWuzhou as FallData,
    shenlong: fallTangShenlong as FallData,
  },
  five_dynasties: {
    fall: fallFiveDynasties as FallData,
    houtang: fallFdHoutang as FallData,
    shijin: fallFdShijin as FallData,
    qidan: fallFdQidan as FallData,
    houzhou: fallFdHouzhou as FallData,
  },
  song: {
    fall: fallSong as FallData,
    jingkang: fallSongJingkang as FallData,
  },
  yuan: { fall: fallYuan as FallData },
  ming: { fall: fallMing as FallData },
  qing: {
    fall: fallQing as FallData,
    ruquan: fallQingRuquan as FallData,
  },
}

const DEFAULT_CHAPTER = 'fall'

/** 逐字速度（毫秒/字） */
const TYPE_SPEED = 46
/** 翻页冷却，避免触控板一次滑动连翻两页 */
const PAGE_COOLDOWN = 620

export function FallStage() {
  const { dynastyId, chapter } = useParams<{ dynastyId: string; chapter?: string }>()
  const navigate = useNavigate()
  const prefersReducedMotion = useReducedMotion()

  const data = dynastyId ? CHAPTERS[dynastyId]?.[chapter ?? DEFAULT_CHAPTER] : undefined
  const acts = data?.acts ?? []

  const [page, setPage] = useState(0)
  const [dir, setDir] = useState(1)
  /** 每页是否已经"演过一遍"；true 之后文字直接显示 */
  const [played, setPlayed] = useState<boolean[]>(() => acts.map(() => false))
  const [shown, setShown] = useState(0)
  const [confirmBack, setConfirmBack] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const lastWheel = useRef(0)
  const typingRef = useRef<number | null>(null)

  /* 刚进入过渡页时先吃掉惯性滚动：否则"从时间轴滑进来"的那一下会立刻跳幕 */
  useEffect(() => {
    lastWheel.current = performance.now()
  }, [])

  const totalChars = (acts[page]?.lines ?? []).reduce((n, line) => n + line.length, 0)

  /* ---------- 逐字浮现（每页只演一次） ---------- */
  useEffect(() => {
    if (typingRef.current) {
      window.clearInterval(typingRef.current)
      typingRef.current = null
    }
    const act = acts[page]
    if (!act) return

    if (played[page] || prefersReducedMotion) {
      setShown(Number.MAX_SAFE_INTEGER)
      return
    }

    setShown(0)
    let n = 0
    typingRef.current = window.setInterval(() => {
      n += 1
      setShown(n)
      if (n >= totalChars) {
        if (typingRef.current) window.clearInterval(typingRef.current)
        typingRef.current = null
        setPlayed((prev) => prev.map((v, i) => (i === page ? true : v)))
      }
    }, TYPE_SPEED)

    return () => {
      if (typingRef.current) window.clearInterval(typingRef.current)
      typingRef.current = null
    }
    // totalChars 随 page 变化，不单独列为依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, played, prefersReducedMotion])

  const typingDone = shown >= totalChars

  /** 立刻显示完本页 */
  const finishTyping = useCallback(() => {
    if (typingRef.current) {
      window.clearInterval(typingRef.current)
      typingRef.current = null
    }
    setShown(Number.MAX_SAFE_INTEGER)
    setPlayed((prev) => prev.map((v, i) => (i === page ? true : v)))
  }, [page])

  /* ---------- 滚轮翻页 ---------- */
  useEffect(() => {
    if (!data) return
    const onWheel = (event: WheelEvent) => {
      if (confirmBack || leaving) return
      if (Math.abs(event.deltaY) < 24) return

      const now = performance.now()
      if (now - lastWheel.current < PAGE_COOLDOWN) return
      lastWheel.current = now

      if (event.deltaY > 0) {
        /*
          下滚 = 跳过当前一幕：
          · 正在逐字 → 直接结束这一幕的动画并进入下一幕，不再让用户干等；
          · 已是最后一幕 → 直接显示完，入口按钮随之出现。
          进入页面的惯性滚动由上面的 lastWheel 初始化吃掉，不会一进来就跳。
        */
        if (typingRef.current) {
          window.clearInterval(typingRef.current)
          typingRef.current = null
        }
        setPlayed((prev) => prev.map((v, i) => (i === page ? true : v)))
        setShown(Number.MAX_SAFE_INTEGER)
        if (page < acts.length - 1) {
          setDir(1)
          setPage((p) => p + 1)
        }
        return
      }

      // 向上
      if (page > 0) {
        setDir(-1)
        setPage((p) => p - 1)
      } else {
        setConfirmBack(true)
      }
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [data, acts.length, page, typingDone, confirmBack, leaving, finishTyping])

  /* ESC：有确认框先关框，否则询问返回 */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (confirmBack) {
        setConfirmBack(false)
        return
      }
      setConfirmBack(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmBack])

  const backToTimeline = useCallback(() => {
    const target = data?.back?.page ?? 'last'
    navigate(`/dynasty/${dynastyId}`, { state: { page: target } })
  }, [dynastyId, navigate, data])

  /*
    第三幕之后的出口由数据决定：
      endgame  → 终局沙盘（周室倾覆）
      timeline → 回时间轴指定页（平王东迁 → 东周首页）
  */
  const goNext = useCallback(() => {
    if (!dynastyId || !data || leaving) return
    const next: FallNext = data.next ?? { kind: 'endgame' }
    setLeaving(true)
    window.setTimeout(() => {
      if (next.kind === 'endgame') {
        navigate(`/dynasty/${dynastyId}/endgame`)
      } else if (next.kind === 'home') {
        navigate('/')
      } else {
        const targetDynasty = next.dynastyId ?? dynastyId
        navigate(`/dynasty/${targetDynasty}`, { state: { page: next.page ?? 'last' } })
      }
    }, 760)
  }, [dynastyId, data, leaving, navigate])

  if (!data) {
    return (
      <div className="fall-page fall-page--empty">
        <p>该朝代没有对应的过渡章节</p>
        <button type="button" onClick={() => navigate('/')}>
          返回
        </button>
      </div>
    )
  }

  const act = acts[page]
  const canEnter = page === acts.length - 1 && typingDone

  /*
    把本页文字按已显示字数切开。
    只保留"已经开头"的行——否则尚未出现的行会占着高度，
    光标被顶到一行空白里，看起来像卡住了。
  */
  let offset = 0
  const visibleLines = act.lines
    .map((line) => {
      const start = offset
      offset += line.length
      const take = Math.max(0, Math.min(line.length, shown - start))
      return { text: line.slice(0, take), started: shown > start }
    })
    .filter((l) => l.started)

  return (
        <div
      className="fall-page"
      data-page={page}
      data-leaving={leaving}
      onClick={() => {
        if (!typingDone) finishTyping()
      }}
    >
      {/* 入场：从时间轴切进来时先盖一层黑，再化开，避免"啪"地出现 */}
      <div className="fall-curtain" aria-hidden="true" />

      <button type="button" className="fall-back" onClick={(e) => { e.stopPropagation(); setConfirmBack(true) }}>
        ↑ 返回时间轴
      </button>

      {/* 页名：小尺寸常驻，不抢单幕的标题 */}
      <div className="fall-brand">
        <span className="fall-brand-sub">{data.subtitle}</span>
        <span className="fall-brand-title">{data.title}</span>
      </div>

      {/* 页码 */}
      <div className="fall-pager" aria-hidden="true">
        {acts.map((a, i) => (
          <span key={a.id} className={`fall-dot${i === page ? ' is-on' : ''}`} />
        ))}
      </div>

      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.section
          key={act.id}
          className={`fall-act fall-act--${page}${ART[act.art ?? ''] ? '' : ' fall-act--no-art'}`}
          custom={dir}
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: dir > 0 ? 60 : -60 }}
          animate={{ opacity: 1, x: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: dir > 0 ? -60 : 60 }}
          transition={{ duration: prefersReducedMotion ? 0.12 : 0.5, ease: [0.2, 0.9, 0.2, 1] }}
        >
          {/* 每幕的专属影像，位置左右交替；没有配图（或图还没生成）时整幕改居中排版 */}
          {ART[act.art ?? ''] ? (
            <div className="fall-art" aria-hidden="true">
              <div className="fall-photo-wrap">
                <img
                  className="fall-photo"
                  src={ART[act.art ?? '']}
                  alt={ART_ALT[act.art ?? ''] ?? '过渡影像'}
                />
              </div>
            </div>
          ) : null}

          <div className="fall-copy">
            <p className="fall-year">{act.year}</p>
            <h2 className="fall-heading">{act.heading}</h2>

            <div className="fall-lines">
              {visibleLines.map((line, k) => (
                <p key={k} className="fall-line">
                  {line.text}
                  {k === visibleLines.length - 1 && !typingDone ? (
                    <span className="fall-caret" aria-hidden="true" />
                  ) : null}
                </p>
              ))}
            </div>

            <blockquote className={`fall-source${typingDone ? ' is-in' : ''}`}>
              <span className="fall-source-book">{act.source.book}</span>
              <p className="fall-source-text">{act.source.text}</p>
            </blockquote>

            {act.note ? <p className="fall-note">{act.note}</p> : null}
          </div>
        </motion.section>
      </AnimatePresence>

      {/* 第三幕文字走完才出现；回滚到第二幕即消失 */}
      <div className="fall-foot" data-visible={canEnter}>
        <button type="button" className="fall-enter" onClick={(e) => { e.stopPropagation(); goNext() }}>
          <span className="fall-enter-label">{data.enterLabel}</span>
          <span className="fall-enter-hint">{data.enterHint} →</span>
        </button>
      </div>

      {confirmBack ? (
        <div className="fall-confirm-mask" onClick={() => setConfirmBack(false)}>
          <div className="fall-confirm" onClick={(e) => e.stopPropagation()} role="dialog">
            <p className="fall-confirm-title">返回帝王时间轴？</p>
            <p className="fall-confirm-text">{data.title}尚未看完，返回后可随时再来。</p>
            <div className="fall-confirm-actions">
              <button type="button" className="fall-confirm-primary" onClick={backToTimeline}>
                返回时间轴
              </button>
              <button type="button" onClick={() => setConfirmBack(false)}>
                继续观看
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {leaving ? <div className="fall-unfurl" aria-hidden="true" /> : null}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* 三幕的影像                                                                  */
/* -------------------------------------------------------------------------- */
// 
// /** 一尊倾覆的鼎：圆腹、三足、双耳，腹内有铜绿与金文 */
// function DingArt() {
//   return (
//     <svg className="fall-ding" viewBox="0 0 200 180" fill="none">
//       <defs>
//         <pattern id="fall-patina" width="27" height="27" patternUnits="userSpaceOnUse">
//           <circle cx="5" cy="6" r="2.4" fill="#5d8f7a" opacity=".3" />
//           <circle cx="19" cy="14" r="1.5" fill="#4a7a6a" opacity=".26" />
//           <circle cx="11" cy="23" r="1.1" fill="#8a6a3a" opacity=".28" />
//           <circle cx="23" cy="4" r="1.3" fill="#6f9c86" opacity=".22" />
//           <circle cx="15" cy="9" r="0.8" fill="#3f6b5d" opacity=".25" />
//           <circle cx="3" cy="20" r="1" fill="#8a6a3a" opacity=".2" />
//         </pattern>
//         <radialGradient id="fall-ding-shade" cx="50%" cy="38%" r="68%">
//           <stop offset="40%" stopColor="#000" stopOpacity="0" />
//           <stop offset="100%" stopColor="#000" stopOpacity=".55" />
//         </radialGradient>
//         <clipPath id="fall-ding-clip">
//           <path d="M42 66c0 36 26 54 58 54s58-18 58-54z" />
//         </clipPath>
//       </defs>
// 
//       <path d="M42 66c0 36 26 54 58 54s58-18 58-54" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
//       <ellipse cx="100" cy="66" rx="58" ry="11" stroke="currentColor" strokeWidth="1.4" />
//       <path d="M66 58c0-14 16-14 16 0M118 58c0-14 16-14 16 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
//       <path d="M48 84h104" stroke="currentColor" strokeWidth="1.1" opacity=".55" />
//       <path d="M56 112l-8 34M100 120v30M144 112l8 34" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
// 
//       <g clipPath="url(#fall-ding-clip)">
//         <rect x="38" y="56" width="124" height="72" fill="url(#fall-patina)" />
//         <rect x="38" y="56" width="124" height="72" fill="url(#fall-ding-shade)" />
//         <g stroke="#e2c27a" strokeWidth="0.9" strokeLinecap="round" opacity=".2">
//           <path d="M62 84v16M68 82v20M74 86v14M80 83v18M86 87v12" />
//           <path d="M96 84v16M102 82v20M108 86v14M114 83v18M120 87v12" />
//           <path d="M128 85v14M134 83v18M140 86v13" />
//         </g>
//         <path d="M48 100h104" stroke="#3f6b5d" strokeWidth="1" opacity=".25" />
//       </g>
//     </svg>
//   )
// }

/** 破败的宗庙：柱、断梁、残幡 */
// function TempleArt() {
//   return (
//     <svg className="fall-temple" viewBox="0 0 200 200" fill="none">
//       {/* 台基 */}
//       <path d="M16 168h168" stroke="currentColor" strokeWidth="1.6" />
//       <path d="M26 156h148" stroke="currentColor" strokeWidth="1.1" opacity=".55" />
//       {/* 四根立柱，第二根断掉 */}
//       <path d="M40 156V72M84 156V72M156 156V72" stroke="currentColor" strokeWidth="1.6" />
//       <path d="M118 156v-46" stroke="currentColor" strokeWidth="1.6" />
//       <path d="M112 110h12" stroke="currentColor" strokeWidth="1.2" opacity=".7" />
//       {/* 屋顶：左半留存，右半塌了 */}
//       <path d="M28 72l30-24h44" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
//       <path d="M28 72h56" stroke="currentColor" strokeWidth="1.4" />
//       <path d="M96 48l30 20" stroke="currentColor" strokeWidth="1.2" opacity=".45" strokeDasharray="4 5" />
//       {/* 残幡 */}
//       <path d="M64 72v26l10-6 10 6V72" stroke="currentColor" strokeWidth="1" opacity=".4" />
//       <path d="M170 72v34" stroke="currentColor" strokeWidth="1" opacity=".3" strokeDasharray="6 4" />
//       {/* 门洞里的黑 */}
//       <rect x="52" y="112" width="48" height="44" fill="#000" opacity=".45" />
//     </svg>
//   )
// }

/** 断开的符节：合纵的信物，一分为二 */
// function TallyArt() {
//   return (
//     <svg className="fall-tally" viewBox="0 0 200 180" fill="none">
//       {/* 左半 */}
//       <path d="M30 40h56v100H30z" stroke="currentColor" strokeWidth="1.5" />
//       <path d="M30 66h56M30 92h56M30 118h56" stroke="currentColor" strokeWidth="1" opacity=".45" />
//       <path d="M62 40v100" stroke="currentColor" strokeWidth="1" opacity=".35" strokeDasharray="5 5" />
//       {/* 右半（错开一点，表示断裂） */}
//       <path d="M114 52h56v100h-56z" stroke="currentColor" strokeWidth="1.5" />
//       <path d="M114 78h56M114 104h56M114 130h56" stroke="currentColor" strokeWidth="1" opacity=".45" />
//       <path d="M138 52v100" stroke="currentColor" strokeWidth="1" opacity=".35" strokeDasharray="5 5" />
//       {/* 断口 */}
//       <path d="M90 44l6 18-8 14 7 20-6 22" stroke="currentColor" strokeWidth="1.2" opacity=".5" />
//       <path d="M110 60l-6 16 8 16-7 18" stroke="currentColor" strokeWidth="1" opacity=".35" />
//     </svg>
//   )
// }

