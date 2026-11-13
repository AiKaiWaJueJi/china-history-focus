# -*- coding: utf-8 -*-
"""生成《研发进度日报》docx"""
import os
from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

OUT = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "研发进度日报_二阶段.docx"
)

GOLD = RGBColor(0x8C, 0x6B, 0x2F)
INK = RGBColor(0x22, 0x22, 0x22)
GREY = RGBColor(0x6B, 0x6B, 0x6B)

doc = Document()

# 页面：A4 常规边距
for section in doc.sections:
    section.top_margin = Cm(2.2)
    section.bottom_margin = Cm(2.2)
    section.left_margin = Cm(2.4)
    section.right_margin = Cm(2.4)


def set_east_asia(run, font_name):
    run.font.name = font_name
    run._element.rPr.rFonts.set(qn("w:eastAsia"), font_name)


def body(text, size=10.5, color=INK, space_after=6, indent=True, bold=False):
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.5
    if indent:
        p.paragraph_format.first_line_indent = Pt(21)
    r = p.add_run(text)
    set_east_asia(r, "仿宋")
    r.font.size = Pt(size)
    r.font.color.rgb = color
    r.bold = bold
    return p


def heading(text, level=1):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(14 if level == 1 else 10)
    p.paragraph_format.space_after = Pt(6)
    r = p.add_run(text)
    set_east_asia(r, "黑体")
    r.font.size = Pt(14 if level == 1 else 11.5)
    r.font.color.rgb = GOLD
    r.bold = True
    return p


def code(text):
    """JSON / 状态片段：小号等宽，浅底"""
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(8)
    p.paragraph_format.left_indent = Pt(12)
    p.paragraph_format.line_spacing = 1.25
    r = p.add_run(text)
    set_east_asia(r, "Consolas")
    r.font.size = Pt(8.5)
    r.font.color.rgb = RGBColor(0x33, 0x33, 0x33)
    # 浅底
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), "F4F1EA")
    p._p.get_or_add_pPr().append(shd)
    return p


def set_col_widths(table, widths):
    """python-docx 只设 cell.width 在 LibreOffice/Word 里可能被 autofit 覆盖，
    这里同时关掉 autofit 并设置列宽。"""
    table.autofit = False
    for i, w in enumerate(widths):
        table.columns[i].width = w
    for row in table.rows:
        for i, w in enumerate(widths):
            row.cells[i].width = w


def bullet(text):
    p = doc.add_paragraph()
    p.paragraph_format.left_indent = Pt(18)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.line_spacing = 1.45
    r = p.add_run("· " + text)
    set_east_asia(r, "仿宋")
    r.font.size = Pt(10.5)
    r.font.color.rgb = INK
    return p


# ---------------- 封面标题 ----------------
t = doc.add_paragraph()
t.alignment = WD_ALIGN_PARAGRAPH.CENTER
t.paragraph_format.space_before = Pt(30)
t.paragraph_format.space_after = Pt(2)
r = t.add_run("研发进度日报")
set_east_asia(r, "黑体")
r.font.size = Pt(26)
r.bold = True
r.font.color.rgb = INK

sub = doc.add_paragraph()
sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
sub.paragraph_format.space_after = Pt(4)
r = sub.add_run("中国历史多维学习工具 · 二阶段（周朝 · 王朝覆灭）")
set_east_asia(r, "仿宋")
r.font.size = Pt(11)
r.font.color.rgb = GREY

meta = doc.add_paragraph()
meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
meta.paragraph_format.space_after = Pt(18)
r = meta.add_run("2026-11-14　|　含本轮史实审计结果")
set_east_asia(r, "仿宋")
r.font.size = Pt(9.5)
r.font.color.rgb = GREY

# ---------------- 一、阶段功能 ----------------
heading("一、二阶段完成了什么")

body(
    "二阶段最初只是「静态版图 + 点击变色」的原型。本阶段把它做成了有行军、有战报、有时间线的推演器："
    "用户点一个国家，先看秦军怎么打下来，再看这场仗的战报，最后回到版图上看疆域怎么变。"
)

heading("1. 视觉", 2)
bullet("战国七雄示意版图：石色底、秦色吞并；灭国后国名、国都、边界一并消散")
bullet("墨汁吞并：敌国底色随最后一段行军到达而晕染，不再是点一下瞬间变色")
bullet("秦疆域金色呼吸轮廓：战报展开时唯一亮着的线索，其余压暗到 26%")
bullet("一统终章：七国图块消散，秦字独立成章、放大变赤、圆环展开")
bullet("史料原文：竖排楷体 + 竹简条纹 + 今译浮层，高度按内容自适应")
bullet("行军路线三色：秦军暗金、守军赤铜、援军青玉（弃用 UI 式的蓝橙箭头）")

heading("2. 交互", 2)
bullet("点国家 → 分段播行军（每段 1.5s 生长 + 0.5s 停留）→ 播完自动开战报")
bullet("向下滚动跳过动画；战报展开后 hover 进军条目，可让该段路线重新点亮")
bullet("跳步（点后面还没推演的国家）先弹「补齐推演」确认卡，说清要补哪几场")
bullet("点已灭国只开战报，不重演征服过程")
bullet("战报态 hover 版图，给一圈灰黑轮廓，提示「这里还能点」")
bullet("底部节点即时间刻度：点它跳到该节点并展开对应战报")
bullet("ESC 逐层退出：人物卡 → 战报 → 朝代页")

# ---------------- 二、数据结构 ----------------
heading("二、数据结构变更")

body("战役序列挂在事件节点下，按 phase 排序；坐标为版图百分比（0–100），运行时换算 viewBox。")

code(
    '{\n'
    '  "id": "e_zhao",\n'
    '  "order": 2,\n'
    '  "nationId": "zhao",\n'
    '  "year": "前228年",\n'
    '  "campaigns": [\n'
    '    {\n'
    '      "phase": 1,\n'
    '      "side": "qin",\n'
    '      "general": "王翦",\n'
    '      "from": "咸阳",\n'
    '      "to": "邯郸",\n'
    '      "points": [\n'
    '        { "x": 25,   "y": 62.8 },\n'
    '        { "x": 44.8, "y": 26.3 },\n'
    '        { "x": 50,   "y": 36.3 }\n'
    '      ],\n'
    '      "via": ["井陉"],\n'
    '      "result": "秦军出井陉，直下邯郸"\n'
    '    }\n'
    '  ]\n'
    '}'
)

body("段内可选援军；援军路线单独画一条，起点在援军国境内。", space_after=2)
code(
    '{\n'
    '  "phase": 2,\n'
    '  "side": "enemy",\n'
    '  "general": "李牧",\n'
    '  "result": "李牧据险反击，秦军受挫",\n'
    '  "allies": [\n'
    '    {\n'
    '      "nation": "代",\n'
    '      "general": "公子嘉",\n'
    '      "troops": "五万",\n'
    '      "reason": "赵室北奔代地，收残部南下策应",\n'
    '      "points": [{ "x": 58, "y": 18.8 }, { "x": 50, "y": 36.3 }]\n'
    '    }\n'
    '  ]\n'
    '}'
)

body("播放器状态（新增 store 切片）与既有字段：", space_after=2)
code(
    '// campaign：播放器\n'
    '{\n'
    '  "campaignNation": "zhao",\n'
    '  "campaignIndex": 1,\n'
    '  "campaignStage": "grow",   // grow | hold\n'
    '  "campaignDone": false,\n'
    '  "hoveredCampaign": null    // 战报里 hover 的段序号\n'
    '}\n\n'
    '// endgame：时间线与聚焦\n'
    '{ "index": 2, "total": 6, "focusedNation": null, "hoveredNation": null }'
)

# ---------------- 三、状态机 ----------------
heading("三、核心状态机流转")

body("播放器是「阶段序号 + 段内两态」的两态机，计时器放在 hook 里，store 只存离散状态——所以组件重渲染不会重启动画。")

code(
    'idle --点国家(未灭)--> playing(index=0, stage=grow)\n'
    'grow --1500ms--> hold --500ms--> index+1 ? grow : settled\n'
    'settled --> 打开战报，同时清空战役状态\n'
    '任意态 --向下滚动--> finish，直接 settled\n'
    '任意态 --点底部节点/回退--> idle'
)

heading("典型链路：进入战报 → hover 路线 → 退出", 2)

rows = [
    ("① 点「赵」", "未灭且非跳步", "startCampaign → campaignNation=zhao、index=0、stage=grow；版图不变，路线开始生长"),
    ("② 每段播完", "计时器", "stage=hold → 500ms 后 index+1；已播段降为 45%"),
    ("③ 最后一段完", "advanceCampaign 越界", "campaignDone=true → 回调：index 推进到 order（此刻才吞并）、focusedNation=zhao、清空战役"),
    ("④ 战报展开", "focusedNation 非空", "版图整层压暗 26%；路线因 done=true 全部隐藏"),
    ("⑤ hover 进军条目", "onCampaignHover(1)", "hoveredCampaign=1 → 该段重新点亮、重播生长、终点闪烁；只显示地名，不显示将领与战果"),
    ("⑥ 移开鼠标", "onCampaignHover(null)", "hoveredCampaign=null → 路线回到隐藏"),
    ("⑦ hover 已灭国版块", "hoveredNation=han", "提示卡被抑制，改由灰黑轮廓图层提示可点"),
    ("⑧ 关闭 / 点空白", "closePanel", "closing=true → 240ms 退场 → focusedNation=null；若 index=total 且无行军 → 进入终章"),
]

table = doc.add_table(rows=1, cols=3)
table.style = "Table Grid"
table.alignment = WD_TABLE_ALIGNMENT.CENTER
hdr = table.rows[0].cells
for i, name in enumerate(("步骤", "触发", "状态变化")):
    hdr[i].text = ""
    p = hdr[i].paragraphs[0]
    rr = p.add_run(name)
    set_east_asia(rr, "黑体")
    rr.font.size = Pt(9.5)
    rr.bold = True

for step, trig, change in rows:
    cells = table.add_row().cells
    for i, val in enumerate((step, trig, change)):
        cells[i].text = ""
        p = cells[i].paragraphs[0]
        p.paragraph_format.space_after = Pt(2)
        rr = p.add_run(val)
        set_east_asia(rr, "仿宋")
        rr.font.size = Pt(9)

set_col_widths(table, (Cm(3.2), Cm(3.6), Cm(9.4)))

doc.add_paragraph().paragraph_format.space_after = Pt(4)

heading("三条前置拦截", 2)
rows2 = [
    ("已灭国 order ≤ index", "只开战报，不动画、不改时间线"),
    ("跳步 order-1 > index", "弹确认卡；确认后才补 index 并开播"),
    ("未灭且相邻", "直接播；若已有战报，先 240ms 退场再开播"),
]
table2 = doc.add_table(rows=1, cols=2)
table2.style = "Table Grid"
h2 = table2.rows[0].cells
for i, name in enumerate(("点击对象", "结果")):
    h2[i].text = ""
    p = h2[i].paragraphs[0]
    rr = p.add_run(name)
    set_east_asia(rr, "黑体")
    rr.font.size = Pt(9.5)
    rr.bold = True
for a, b in rows2:
    cells = table2.add_row().cells
    for i, val in enumerate((a, b)):
        cells[i].text = ""
        p = cells[i].paragraphs[0]
        p.paragraph_format.space_after = Pt(2)
        rr = p.add_run(val)
        set_east_asia(rr, "仿宋")
        rr.font.size = Pt(9)
set_col_widths(table2, (Cm(6.0), Cm(10.2)))

doc.add_page_break()

# ---------------- 四、史实审计 ----------------
heading("四、本轮史实审计（六篇战报正文）")

body(
    "审计对象是每篇战报的「战前形势 / 战役经过 / 结局」三段，以及所引《史记》原文与今译。"
    "原则：宁可少写一句，也不写错一句。凡与《史记》抵牾者改之，凡属后世误传或时代错置者删之。"
)

audit_rows = [
    ("秦灭赵", "行军路线与地理", "「王翦乘赵内乱，自上党、井陉两路并进」",
     "《秦始皇本纪》十八年：王翦将上地、下井陉，杨端和将河内。上党非王翦来路。改为「王翦自上地东下井陉，杨端和自河内北上，两路合围邯郸」。"),
    ("秦灭楚", "建制表述", "「楚地置楚郡」",
     "「灭楚名为楚郡」出自《楚世家》，但秦三十六郡多认为无楚郡（避庄襄王子楚讳）。改为「秦以其地为郡——『灭楚名为楚郡』」并注明出处。"),
    ("秦灭韩", "时代错置", "「国已『地不满千里，兵不过十万』」",
     "此语出《战国策》苏秦说韩王，属合纵游说之辞，非韩王安时实录。改为「国已地蹙兵疲」。"),
    ("秦灭齐", "与原文不符", "「绕过齐西境防线……未及列阵而溃」",
     "《秦始皇本纪》：齐王建与相后胜发兵守西界，秦使王贲从燕南攻齐。改为「齐王建与相后胜发兵守西界……齐军不战而溃」。"),
    ("秦灭魏", "核对通过", "马陵后国势日削、引河沟灌大梁、王假请降、置砀郡",
     "与《魏世家》《秦始皇本纪》相符，保留。"),
    ("秦灭燕", "核对通过", "荆轲刺秦、蓟城陷落、杀太子丹献秦、前222 虏燕王喜、置辽东郡",
     "与《燕召公世家》《秦始皇本纪》相符，保留（右北平为燕旧郡，可用）。"),
]

table3 = doc.add_table(rows=1, cols=4)
table3.style = "Table Grid"
h3 = table3.rows[0].cells
for i, name in enumerate(("篇目", "问题类型", "原表述", "处理")):
    h3[i].text = ""
    p = h3[i].paragraphs[0]
    rr = p.add_run(name)
    set_east_asia(rr, "黑体")
    rr.font.size = Pt(9)
    rr.bold = True

for a, b, c, d in audit_rows:
    cells = table3.add_row().cells
    for i, val in enumerate((a, b, c, d)):
        cells[i].text = ""
        p = cells[i].paragraphs[0]
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.25
        rr = p.add_run(val)
        set_east_asia(rr, "仿宋")
        rr.font.size = Pt(8.5)

set_col_widths(table3, (Cm(2.0), Cm(2.6), Cm(4.6), Cm(7.0)))

doc.add_paragraph().paragraph_format.space_after = Pt(2)

body(
    "结论：六篇中四篇存在问题并已修正，两篇核对通过。另记一处两说并存——项燕之死，"
    "《白起王翦列传》作「至蕲南，杀其将军项燕」，《秦始皇本纪》作「项燕遂自杀」，"
    "正文采列传说，不强行统一。"
)

# ---------------- 五、质量 ----------------
heading("五、质量数据")

q_rows = [
    ("回归断言", "193 条（gallery 24 / dwell 8 / timeline 20 / dual 33 / endgame 108）"),
    ("类型检查", "tsc -b 零错误"),
    ("构建体积", "484 KB / gzip 156 KB"),
    ("坐标校验", "六国战役点位 100% 落在版图内（射线法脚本把关）"),
    ("史实审计", "六篇正文 + 六段引文逐条核对，修正 4 处"),
]
table4 = doc.add_table(rows=0, cols=2)
table4.style = "Table Grid"
for a, b in q_rows:
    cells = table4.add_row().cells
    for i, val in enumerate((a, b)):
        cells[i].text = ""
        p = cells[i].paragraphs[0]
        p.paragraph_format.space_after = Pt(2)
        rr = p.add_run(val)
        set_east_asia(rr, "仿宋" if i else "黑体")
        rr.font.size = Pt(9)
set_col_widths(table4, (Cm(4.0), Cm(12.2)))

# ---------------- 六、待办 ----------------
heading("六、风险与待办")

bullet("齐的行军标注在短路线下仍偏挤，下一步做「按终点象限自动避让」")
bullet("小多边形命中：韩的包围盒中心落在多边形外，鼠标坐标点击可能打空（真人点可见区域无碍），可补透明命中层根治")
bullet("秦字误触重置暂无确认——已确认本项目暂不处理")
bullet("后续新增战报时，正文需同步过一遍本轮这套审计标准（年份、人物、地点、因果、引文出处）")

doc.save(OUT)
print("saved:", OUT)

# 复核
d2 = Document(OUT)
paras = [p.text for p in d2.paragraphs if p.text.strip()]
print("段落数:", len(paras), "表格数:", len(d2.tables))
print("首段:", paras[0])
print("末段:", paras[-1])
