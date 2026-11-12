# -*- coding: utf-8 -*-
"""
build-report.py —— 生成《视图二 实现说明》Word 文档
所有截图来自 shots/report/，均为真实运行状态。
"""
import os
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn

ROOT = r"D:\文档\deepseek-harness\default-workspace\china-history-focus"
SHOTS = os.path.join(ROOT, "shots", "report")
OUT = os.path.join(ROOT, "视图二实现说明.docx")

BASE_FONT = "微软雅黑"
BODY_FONT = "宋体"
ACCENT = RGBColor(0x8C, 0x6A, 0x2A)
MUTED = RGBColor(0x77, 0x77, 0x77)


def set_font(run, name, size=None, bold=None, color=None, italic=None):
    run.font.name = name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name)
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.font.bold = bold
    if italic is not None:
        run.font.italic = italic
    if color is not None:
        run.font.color.rgb = color


doc = Document()

# 页面：A4，左右 2cm
section = doc.sections[0]
section.page_width = Cm(21)
section.page_height = Cm(29.7)
section.left_margin = Cm(2)
section.right_margin = Cm(2)
section.top_margin = Cm(2)
section.bottom_margin = Cm(1.8)

# 正文默认样式
normal = doc.styles["Normal"]
normal.font.name = BODY_FONT
normal.font.size = Pt(10.5)
normal.element.rPr.rFonts.set(qn("w:eastAsia"), BODY_FONT)


def heading(text, level=1):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(16 if level == 1 else 10)
    p.paragraph_format.space_after = Pt(6)
    # 标题不单独留在页尾，跟住后面的图/文
    p.paragraph_format.keep_with_next = True
    run = p.add_run(text)
    if level == 1:
        set_font(run, BASE_FONT, 15, bold=True, color=ACCENT)
        # 标题下方加一条细线
        pPr = p._p.get_or_add_pPr()
        pbdr = pPr.makeelement(qn("w:pBdr"), {})
        bottom = pbdr.makeelement(
            qn("w:bottom"),
            {qn("w:val"): "single", qn("w:sz"): "6", qn("w:space"): "4", qn("w:color"): "C9A227"},
        )
        pbdr.append(bottom)
        pPr.append(pbdr)
    else:
        set_font(run, BASE_FONT, 12, bold=True)
    return p


def body(text, size=10.5, color=None, space_after=4):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.4
    set_font(p.add_run(text), BODY_FONT, size, color=color)
    return p


def bullet(text, size=10.5):
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.35
    run = p.add_run(text)
    set_font(run, BODY_FONT, size)
    # 半角标签用等宽感强调：冒号前的内容加粗
    return p


def picture(name, caption):
    path = os.path.join(SHOTS, name)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(6)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.keep_with_next = True
    p.add_run().add_picture(path, width=Cm(15.6))
    cap = doc.add_paragraph()
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_after = Pt(8)
    set_font(cap.add_run(caption), BASE_FONT, 9, color=MUTED, italic=True)


def table(headers, rows, widths=None):
    t = doc.add_table(rows=1, cols=len(headers))
    t.style = "Light Grid Accent 1"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(headers):
        cell = t.rows[0].cells[i]
        cell.text = ""
        run = cell.paragraphs[0].add_run(h)
        set_font(run, BASE_FONT, 9.5, bold=True)
    for row in rows:
        cells = t.add_row().cells
        for i, value in enumerate(row):
            cells[i].text = ""
            run = cells[i].paragraphs[0].add_run(value)
            set_font(run, BODY_FONT, 9.5)
    if widths:
        for row in t.rows:
            for i, w in enumerate(widths):
                row.cells[i].width = Cm(w)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return t


# ===========================================================================
# 封面
# ===========================================================================
title = doc.add_paragraph()
title.alignment = WD_ALIGN_PARAGRAPH.CENTER
title.paragraph_format.space_before = Pt(120)
set_font(title.add_run("中国历史多维学习工具"), BASE_FONT, 26, bold=True)

sub = doc.add_paragraph()
sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
sub.paragraph_format.space_before = Pt(10)
set_font(sub.add_run("视图二 · 实现说明与交互验状"), BASE_FONT, 16, color=ACCENT)

line = doc.add_paragraph()
line.alignment = WD_ALIGN_PARAGRAPH.CENTER
line.paragraph_format.space_before = Pt(28)
set_font(line.add_run("帝王时间轴  ·  时代分段  ·  天子与诸侯  ·  王朝覆灭"), BASE_FONT, 11, color=MUTED)

meta = doc.add_paragraph()
meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
meta.paragraph_format.space_before = Pt(120)
set_font(meta.add_run("截图 18 张 · 全部为真实运行状态\n2026-11-13"), BASE_FONT, 10, color=MUTED)

doc.add_page_break()

# ===========================================================================
# 一、文档说明
# ===========================================================================
heading("一、这份文档说明什么")
body(
    "本文汇总「视图二」的完整实现，覆盖从朝代主页进入、帝王时间轴、时代分段、"
    "天子与诸侯双层版图，一直到王朝覆灭与一统终章的全部交互。"
    "所有截图均由无头浏览器对运行中的页面实时抓取，不是设计稿或示意图。"
)
body(
    "两点阅读建议："
)
bullet("每张图下方的一句话说明它对应哪个操作，先看「操作」再看「能力」，能最快建立整体印象。")
bullet("标注「过渡帧」的截图是动画进行中的一帧——静态图看不出流畅度，但可以证明过渡期间画面始终有内容（没有黑屏或跳变）。")

heading("技术与验收概览", level=2)
table(
    ["项目", "说明"],
    [
        ["技术栈", "React 18 + TypeScript + Vite；Framer Motion 负责翻页弹簧；Zustand 管理时间轴/沙盘状态"],
        ["样式", "Tailwind 之外以手写 CSS 为主，关键交互全部走 CSS（:has()、transition、@property），避免 React 逐帧重渲染"],
        ["数据", "周朝 37 位帝王 / 77 条事件 / 12 位诸侯 / 6 条灭国事件；秦朝 3 位帝王"],
        ["字体", "行书、瘦金体等 4 套中文字体自托管子集化，离线可用（合计约 169 KB）"],
        ["自动化验收", "5 套脚本、146 条断言：主页 24 / 指针 8 / 时间轴 20 / 双层 33 / 覆灭 61"],
        ["构建产物", "约 469 KB，gzip 152 KB"],
    ],
    widths=[3.2, 13.4],
)

# ===========================================================================
# 二、从朝代主页进入
# ===========================================================================
heading("二、入口：从朝代主页进入视图二")

picture("01-gallery.png", "图 1　十三朝纵向条带：默认态")
body(
    "视图一的十三朝以纵向条带并置，鼠标移入哪一朝，该条带展开、相邻条带收窄，"
    "其余压暗。宽度变化用像素值插值而非 flex-grow，因此不会出现「展开拖尾」的滞后感。"
)

picture("02-gallery-focus.png", "图 2　聚焦「周」：条带展开、其余退让")
bullet("操作：悬停条带 → 展开；点击 → 进入该朝代的时间轴。")
bullet("能力：整套挤压/变暗是纯 CSS 触发的，指针移动过程中 React 不重渲染，所以能稳定跑满帧率。")
bullet("丝滑：展开 360ms easeOut；指针需位移 ≥2px 且停留 60ms 才判定为「意图悬停」，避免布局移动引起焦点跳动。")

# ===========================================================================
# 三、帝王时间轴
# ===========================================================================
heading("三、帝王时间轴：一页三帝")

picture("03-timeline-xizhou.png", "图 3　西周首页：周武王、成王、康王")
body(
    "每页三位帝王，横向滑动。卡片底部是谥号（大字）、姓名、在位年份；"
    "顶部「时代分段轴」按真实年份比例标出西周／东周的分界。"
)
bullet("操作：滚轮上下、方向键 ←→、底部圆点、右下角按钮，四种方式都可翻页。")
bullet("能力：页码、按钮可用态、进度条联动；ESC 直接返回朝代主页。")
bullet("防误触：滚轮有 520ms 冷却，连续滚动只翻一页。")

picture("04-timeline-hover.png", "图 4　悬浮周武王：上下展开事件思维导图")
body(
    "悬浮一位帝王，卡片上、下两侧各自展开事件节点：上方是军事成就（暖橙圆点），"
    "下方是政治·文教（青绿圆点）。其余两位变暗退后，形成聚焦。"
)
bullet("信息分层：军事=向外扩张，放上方像旗帜；政治文教=向内根基，放下方像底座。")
bullet("可读性：节点用不透明黑底 + 加粗 + 双层文字投影，压在任何背景图上都不糊。")
bullet("手感：节点按 55ms 间隔依次浮入，不是整块弹出。")

# ===========================================================================
# 四、翻页过渡
# ===========================================================================
heading("四、翻页过渡：新旧两页重叠，没有黑场")

picture("05-page-transition.png", "图 5　过渡帧：上一页正在淡出，下一页同时滑入")
body(
    "这张是动画进行中的一帧，可以看到两组帝王卡片同时存在：左侧是上一页的成王、康王、昭王，"
    "右侧是正在进入的昭王、穆王、共王。"
)
bullet("问题：早期用「旧页先退出、新页再进入」，中间会空出约 200ms，视觉上就是黑屏一下。")
bullet("方案：改用重叠过渡（AnimatePresence popLayout），新页滑入的同时旧页滑出，全程画面不断。")
bullet("位移：±38% 而非 ±52%，弹簧 stiffness 320 / damping 34，落点干脆不拖泥带水。")

# ===========================================================================
# 五、时代分段轴
# ===========================================================================
heading("五、时代分段轴：把「哪个时代」画出来")

picture("06-segment-axis.png", "图 6　点击「战国」节点后跳到第 9 页（吴、越在位）")
body(
    "时间轴上方是一条按年份比例划分的刻度带：西周 275 年、东周 514 年，宽度比约 1 : 1.87，"
    "「东周占了三分之二」这件事一眼可见——比例本身就是历史信息。"
)
bullet("节点：东周内插入春秋（前 770）与战国（前 475）两个标志点，都是可点击的跳转入口。")
bullet("播放头：轴下方一条定宽光条指示当前页所处年代；宽度恒定，只移动位置，避免翻页时忽宽忽细。")
bullet("布局：段名在色带上方、节点标签在下方，因为「东周」与「春秋」起始同年，同侧必然重叠。")

# ===========================================================================
# 六、东周双层
# ===========================================================================
heading("六、东周：天子与诸侯并立")

picture("07-dual-layout.png", "图 7　第 6 页：上排天子（紧凑），下排诸侯")
body(
    "进入东周后布局自动切成两层：上层是周天子，尺寸压小、退居上方；"
    "下层是当期在任的诸侯，占据主要空间。这不是「替换」，而是并立——天子仍可点。"
)
bullet("为何分两层：东周王纲解纽，天子已非主角；版式本身就复述了这段历史。")
bullet("布局用 Grid 两行 + 上下各留 80px，天子浮层只向上、诸侯浮层只向下，两层永不互相遮挡。")
bullet("切换条件：当前页第一位帝王所属分段为东周，且有诸侯数据。")

picture("08-lord-squeeze.png", "图 8　悬浮晋文公：该卡放大、其余收窄，并向下展开事迹")
bullet("操作：悬停诸侯 → 该卡放大、邻卡收缩；同时下方浮出该诸侯的重要事迹。")
bullet("状态：卡面标出「在位」与其「称霸期」两个区间——联动按称霸期算，不是即位年。")
bullet("实现：挤压由 CSS :has() 完成，鼠标移动时零 React 重渲染。")

picture("09-lords-empty.png", "图 9　第 8 页：本期无人称霸")
body(
    "诸侯按「称霸期 ∩ 当前页时间窗」求交，所以会随翻页真实增减。前 585—前 520 这段恰好是"
    "楚庄已卒、吴越未兴的空窗，于是这里显示「王室虽衰，诸侯未霸」。"
)
bullet("这不是兜底文案，而是一个真实的历史空档——空态也承担叙事。")

# ===========================================================================
# 七、王朝覆灭
# ===========================================================================
heading("七、王朝覆灭：可逆的战略沙盘")

picture("10-endgame-idle.png", "图 10　初始态：七国无缝嵌合的版图")
body(
    "周朝末页继续下滚（或点右下角按钮）进入「王朝覆灭」。七块疆域严丝合缝拼成整块大陆，"
    "每块标出国名与国都，底部是 0—6 的阶梯控制器。"
)
bullet("初始只有秦为秦色，六国是中性石色——颜色先于文字告诉观众「谁是威胁」。")
bullet("七块按平面剖分绘制，相邻块共用顶点，因此中间没有空隙，交界处自然形成双线。")
bullet("底部节点是唯一的时间轴入口，从左到右即灭国顺序：韩→赵→魏→楚→燕→齐。")

picture("11-endgame-hover.png", "图 11　悬浮「赵」：要点卡片 + 底部节点同步流光")
bullet("操作：悬停国家 → 弹出轻量卡片（年份、秦灭X、两三条要点、可点击提示）。")
bullet("联动：地图悬浮时，底部对应节点同时亮起循环流光；反过来悬停节点也会点亮地图。")
bullet("默认不占地方：战报栏平时不显示，地图独占整宽，避免「左边一块空的」。")

picture("12-panel-opening.png", "图 12　过渡帧：点「赵」的瞬间，战报栏正在滑出")
body(
    "点击国家才展开战报。这张抓的是展开瞬间：战报栏已滑出、地图尚未压暗，"
    "两者正在交叉——所以看起来地图还亮着。"
)
bullet("展开后地图压暗到 0.3 并灰化，当前国保留一圈金边，视线自然落到战报上。")

picture("13-endgame-detail.png", "图 13　战报展开：战前形势 / 战役经过 / 结局")
body(
    "战报不是把时间线那句话重复一遍，而是三段叙述：战前形势、战役经过、结局。"
    "本次把栏宽从 46%（716px）收到 34%（529px），行宽更接近阅读舒适区。"
)
bullet("字体：标题「方正小标简宋」，正文「仿宋GB2312」，均写了完整 fallback，装不装字体都不会掉成黑体。")
bullet("人物：正文里的王翦、李信会自动识别成可点击标签，点开是生平浮层。")
bullet("关闭：点战报外任意处、点 ×、或再点该国，都会先播 240ms 退场动画再卸载。")

picture("14-figure-modal.png", "图 14　人物浮层：王翦生平与主要事迹")
bullet("数据 Mock 在 endgame.zhou.json 的 figures 里，正文与浮层共用同一份。")
bullet("关闭：点浮层外部或 ESC；ESC 是分层退出——先关浮层，再退聚焦，最后回时间轴。")

picture("15-rewind.png", "图 15　逆推：从「齐」退回「赵」，魏楚燕齐恢复独立")
body(
    "这是这套交互最关键的一点：时间是可逆的。点「赵」后，已灭的魏、楚、燕、齐会自动恢复，"
    "战报缩回两条，秦朝入口消失。"
)
bullet("实现：全程只有一个整数 index（0—6），所有视图都由它派生，因此「回退」不需要任何撤销代码。")
bullet("秦字：会移动到「秦 + 已灭诸国」合并后的重心，而不是固定在西边。")

picture("16-conquered-hover.png", "图 16　悬浮已灭的韩：原疆域描边重新点亮成鎏金")
bullet("灭国后国界会被抹掉（颜色并入秦色），但鼠标扫过时原轮廓会重新亮起，作为「点这里看详情」的入口。")
bullet("暗色块本身也会提亮，给一个「摸到了」的反馈。")

# ===========================================================================
# 八、一统
# ===========================================================================
heading("八、一统终章")

picture("17-unify-mid.png", "图 17　终章进行中：图块消散，秦字自黄转红")
body(
    "六国尽灭、关闭战报之后，版图整体消散，秦字独立占据中心，由黄转红并放大，"
    "外围一圈比背景更深的半透明圆环同步拉近，背后浮出始皇帝的虚影。"
)
bullet("时序：秦字 3.8 秒完成「出现 → 停一拍 → 转红放大」，入口卡片在 2.9 秒后才浮现。")
bullet("同步：秦字与圆环同属一个容器，缩放由父级统一施加，因此天然同步、天然同心。")

picture("18-unified.png", "图 18　终章定格：秦字赤红、圆环定格、大秦帝国入口浮现")
bullet("入口：点【大秦帝国 · 公元前221年】即进入秦朝帝王时间轴，复用同一套组件。")
bullet("退场后：地图层不再响应指针，回退只能通过底部节点——避免看不见的区域仍能被点中。")

# ===========================================================================
# 九、交互速查
# ===========================================================================
heading("九、交互速查")
table(
    ["位置", "操作", "结果"],
    [
        ["朝代主页", "悬停条带 / 点击", "展开聚焦 / 进入该朝时间轴"],
        ["帝王时间轴", "滚轮、←→、圆点、按钮", "翻页（520ms 冷却，连滚只翻一页）"],
        ["帝王时间轴", "悬停帝王卡", "上下展开事件思维导图，其余变暗"],
        ["时代分段轴", "点段带 / 点春秋战国节点", "跳到该时期第一位帝王所在页"],
        ["东周页", "悬停诸侯卡", "放大挤压 + 事迹浮层 + 节点流光"],
        ["王朝覆灭", "悬停国家", "要点卡片（不展开战报）"],
        ["王朝覆灭", "点击国家", "跳到该节点 + 展开三段式战报"],
        ["王朝覆灭", "点地图空白 / × / 再点该国", "先播退场动画再收起战报"],
        ["王朝覆灭", "点底部节点", "正向或逆向推移（可回退）"],
        ["王朝覆灭", "点击正文人物", "打开人物生平浮层"],
        ["任意", "ESC", "分层退出：浮层 → 聚焦 → 返回时间轴"],
    ],
    widths=[3.6, 5.6, 7.4],
)

# ===========================================================================
# 十、丝滑感的实现
# ===========================================================================
heading("十、所谓「丝滑」是怎么保证的")
bullet("只用合成器属性：动画集中在 transform / opacity / filter，不做 width、top 这类触发布局的过渡（战报栏宽度除外，那是一次性的）。")
bullet("鼠标交互不经过 React：挤压、变暗、描边全部由 CSS :has() 与 transition 完成，指针移动时零重渲染。")
bullet("像素级宽度插值：条带展开用绝对像素而非 flex-grow，因为 flex-grow 的比例与宽度是非线性的，会产生长尾拖拽感。")
bullet("意图判定：指针需位移 ≥2px 且停留 60ms 才触发悬停，避免布局变化导致焦点反复跳。")
bullet("时序错开：节点浮现按 55ms 逐个入场、鼓点按史实年差排布，不做整齐划一的并发动画。")

# ===========================================================================
# 十一、验收
# ===========================================================================
heading("十一、自动化验收")
body("五个脚本对真实页面逐项断言，共 146 条，当前全部通过：")
table(
    ["脚本", "覆盖", "断言数"],
    [
        ["verify-gallery.mjs", "朝代主页：挤压、边界、无溢出、跳转与空态", "24"],
        ["verify-dwell.mjs", "指针意图：横扫不误触、停留才触发", "8"],
        ["verify-timeline.mjs", "帝王时间轴：翻页、重叠过渡、思维导图、末页补槽", "20"],
        ["verify-dual.mjs", "分段轴、双层布局、诸侯联动、空窗期", "33"],
        ["verify-endgame.mjs", "沙盘全链路：正推逆推、聚焦、人物、一统终章", "61"],
    ],
    widths=[4.4, 9.6, 2.6],
)

body("")
p = doc.add_paragraph()
p.alignment = WD_ALIGN_PARAGRAPH.CENTER
set_font(p.add_run("— 文档结束 —"), BASE_FONT, 9, color=MUTED)

doc.save(OUT)
print(f"saved: {OUT}")
print(f"paragraphs: {len(doc.paragraphs)}")
