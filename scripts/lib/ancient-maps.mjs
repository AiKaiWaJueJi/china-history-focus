/**
 * ancient-maps.mjs —— 四个古战场沙盘的史实疆域（周/秦/汉/晋）
 * ===========================================================================
 * 与前七盘同一套做法：政权 = 底板地理单元的并集，面积守恒、不重叠由底板保证。
 * 这里只负责「谁占哪几块」，依据的是各战役开局的史实控制区：
 *
 *   战国（前 230 起，秦灭六国的起点）
 *   楚汉（前 206，项羽分封之后）
 *   三国（229 起，孙权称帝、三国鼎立成形）
 *   南北朝（577 周灭齐之前）
 *
 * 粒度限制：底板切到「省内的古地理单元」（如河南西/中/东/南、晋中/晋南/上党），
 * 仍粗于郡县，所以部分疆界取「就近归并」，逐盘在 note 里写明取舍。
 */

export const ANCIENT_MAPS = {
  /* ------------------------------------------------------------------ */
  /* 周：战国七雄（秦灭六国）                                            */
  /* ------------------------------------------------------------------ */
  zhanguo: {
    dynastyId: 'zhou',
    note:
      '战国七雄（前 230 起）：秦据关陇、巴蜀、河东与三川，赵有邯郸与代北，魏守大梁，韩余颍川，' +
      '楚有江淮江南，燕居幽燕辽东，齐处东滨。版图按底板地理单元归属示意：' +
      '洛阳一带（河南西）图中系于韩——其时洛阳已入秦三川郡，郡县细界底板切不出来。' +
      '匈奴、东胡、百越、西南夷为背景，不参与推演。',
    attacker: {
      id: 'qin',
      name: '秦',
      cells: [
        'shaanxi_n', 'shaanxi_bei', 'gansu', 'ningxia',
        'sichuan', 'chongqing', 'shaanxi_s',
        'shanxi_s', 'shanxi_se', 'shanxi_c',
      ],
      capital: '咸阳',
    },
    regions: [
      { id: 'han', name: '韩', cells: ['henan_w'], capital: '新郑' },
      { id: 'zhao', name: '赵', cells: ['hebei_s', 'hebei_c', 'shanxi_n'], capital: '邯郸' },
      { id: 'wei', name: '魏', cells: ['henan_c', 'henan_e'], capital: '大梁' },
      {
        id: 'chu',
        name: '楚',
        cells: ['hubei', 'hunan', 'jiangxi', 'anhui_s', 'anhui_n', 'jiangsu_s', 'jiangsu_n', 'zhejiang', 'henan_n', 'fujian', 'shanghai'],
        capital: '寿春',
      },
      { id: 'yan', name: '燕', cells: ['hebei_n', 'beijing', 'tianjin', 'liaoning'], capital: '蓟' },
      { id: 'qi', name: '齐', cells: ['shandong'], capital: '临淄' },
      { id: 'xiongnu', name: '匈奴·东胡', cells: ['neimenggu', 'jilin', 'heilongjiang'], backdrop: true },
      { id: 'qiang', name: '月氏·羌', cells: ['xinjiang', 'qinghai', 'xizang'], backdrop: true },
      { id: 'baiyue', name: '百越·西南夷', cells: ['guangdong', 'guangxi', 'yunnan', 'guizhou'], backdrop: true },
    ],
    points: [
      { id: 'sp_zh_hangu', name: '函谷关', kind: 'pass', regionId: 'qin', city: '潼关' },
      { id: 'sp_zh_jingxing', name: '井陉', kind: 'pass', regionId: 'zhao', city: '井陉' },
      { id: 'sp_zh_handan', name: '邯郸', kind: 'city', regionId: 'zhao', city: '邯郸' },
      { id: 'sp_zh_daliang', name: '大梁', kind: 'city', regionId: 'wei', city: '大梁' },
      { id: 'sp_zh_xinzheng', name: '新郑', kind: 'city', regionId: 'han', city: '新郑' },
      { id: 'sp_zh_shouchun', name: '寿春', kind: 'city', regionId: 'chu', city: '寿春' },
      { id: 'sp_zh_ji', name: '蓟', kind: 'city', regionId: 'yan', city: '蓟' },
      { id: 'sp_zh_linzi', name: '临淄', kind: 'city', regionId: 'qi', city: '临淄' },
    ],
    rivers: ['huanghe', 'changjiang', 'huaihe', 'hanshui'],
  },

  /* ------------------------------------------------------------------ */
  /* 秦：楚汉相争（前 206—前 202）                                       */
  /* ------------------------------------------------------------------ */
  chuhan: {
    dynastyId: 'qin',
    note:
      '楚汉相争（前 206 起）：项羽分封之后，漢王刘邦据巴蜀汉中，三秦（雍·塞·翟）据关陇，' +
      '西楚据江淮与江东，魏·韩·赵·燕·齐各复其国，临江（共敖）据荆湖。' +
      '版图按底板地理单元归属示意：三秦并为一块（关中·陕北·陇右），' +
      '匈奴、南越、闽越、西南夷为背景。',
    attacker: {
      id: 'han_base',
      name: '漢',
      cells: ['sichuan', 'chongqing', 'shaanxi_s'],
      capital: '南郑',
    },
    regions: [
      { id: 'sanqin', name: '三秦', cells: ['shaanxi_n', 'shaanxi_bei', 'gansu', 'ningxia'], capital: '废丘' },
      {
        id: 'xichu',
        name: '西楚',
        cells: ['jiangsu_n', 'jiangsu_s', 'anhui_n', 'anhui_s', 'zhejiang', 'shanghai', 'jiangxi', 'henan_c', 'henan_e', 'henan_n'],
        capital: '彭城',
      },
      { id: 'wei', name: '魏', cells: ['shanxi_s', 'shanxi_se'], capital: '平阳' },
      { id: 'han', name: '韩', cells: ['henan_w'], capital: '阳翟' },
      { id: 'zhao', name: '赵', cells: ['hebei_s', 'hebei_c', 'shanxi_c', 'shanxi_n'], capital: '襄国' },
      { id: 'yan', name: '燕', cells: ['hebei_n', 'beijing', 'tianjin', 'liaoning'], capital: '蓟' },
      { id: 'qi', name: '齐', cells: ['shandong'], capital: '临淄' },
      { id: 'linjiang', name: '临江·衡山', cells: ['hubei', 'hunan'], backdrop: true },
      { id: 'xiongnu', name: '匈奴', cells: ['neimenggu', 'jilin', 'heilongjiang'], backdrop: true },
      { id: 'qiang', name: '月氏·羌', cells: ['xinjiang', 'qinghai', 'xizang'], backdrop: true },
      { id: 'nanyue', name: '南越·闽越·西南夷', cells: ['guangdong', 'guangxi', 'fujian', 'yunnan', 'guizhou'], backdrop: true },
    ],
    points: [
      { id: 'sp_ch_chencang', name: '陈仓', kind: 'pass', regionId: 'sanqin', city: '陈仓' },
      { id: 'sp_ch_pengcheng', name: '彭城', kind: 'city', regionId: 'xichu', city: '彭城' },
      { id: 'sp_ch_xingyang', name: '荥阳', kind: 'battle', regionId: 'han', city: '荥阳' },
      { id: 'sp_ch_jingxing', name: '井陉', kind: 'pass', regionId: 'zhao', city: '井陉' },
      { id: 'sp_ch_linzi', name: '临淄', kind: 'city', regionId: 'qi', city: '临淄' },
      { id: 'sp_ch_gaixia', name: '垓下', kind: 'battle', regionId: 'xichu', city: '垓下' },
      { id: 'sp_ch_nanzheng', name: '南郑', kind: 'city', regionId: 'han_base', city: '南郑' },
    ],
    rivers: ['huanghe', 'changjiang', 'huaihe', 'hanshui'],
  },

  /* ------------------------------------------------------------------ */
  /* 汉：三国归晋（229—280）                                             */
  /* ------------------------------------------------------------------ */
  sanguo: {
    dynastyId: 'han',
    note:
      '三国鼎立（229 起，孙权称帝）：魏据北方九州与淮北，蜀据益州汉中与南中，吴据江东、荆南与交州，' +
      '辽东公孙氏据辽水以东（238 年平）。版图按底板地理单元归属示意：' +
      '魏含关中陇右与河东，吴含荆南岭南；鲜卑、西域、高原诸部为背景。',
    attacker: {
      id: 'wei',
      name: '魏',
      cells: [
        'hebei_n', 'hebei_c', 'hebei_s', 'shanxi_n', 'shanxi_c', 'shanxi_s', 'shanxi_se',
        'shandong', 'henan_w', 'henan_c', 'henan_e', 'henan_n',
        'shaanxi_n', 'shaanxi_bei', 'gansu', 'ningxia',
        'beijing', 'tianjin', 'jiangsu_n', 'anhui_n',
      ],
      capital: '洛阳',
    },
    regions: [
      { id: 'shu', name: '蜀', cells: ['sichuan', 'chongqing', 'shaanxi_s', 'yunnan', 'guizhou'], capital: '成都' },
      {
        id: 'wu',
        name: '吴',
        cells: ['jiangsu_s', 'anhui_s', 'zhejiang', 'shanghai', 'jiangxi', 'fujian', 'hubei', 'hunan', 'guangdong', 'guangxi'],
        capital: '建业',
      },
      { id: 'liaodong', name: '辽东', cells: ['liaoning'], capital: '襄平', aliveTo: 238 },
      { id: 'xianbei', name: '鲜卑·乌桓', cells: ['neimenggu', 'jilin', 'heilongjiang'], backdrop: true },
      { id: 'xiyu', name: '西域·高原诸部', cells: ['xinjiang', 'xizang', 'qinghai'], backdrop: true },
    ],
    points: [
      { id: 'sp_sg_xiangping', name: '襄平', kind: 'city', regionId: 'liaodong', city: '辽阳' },
      { id: 'sp_sg_jiange', name: '剑阁', kind: 'pass', regionId: 'shu', city: '剑门' },
      { id: 'sp_sg_yangping', name: '阳平关', kind: 'pass', regionId: 'shu', city: '汉中' },
      { id: 'sp_sg_shouchun', name: '寿春', kind: 'battle', regionId: 'wei', city: '寿春' },
      { id: 'sp_sg_jiangling', name: '江陵', kind: 'city', regionId: 'wu', city: '江陵' },
      { id: 'sp_sg_yiling', name: '夷陵', kind: 'battle', regionId: 'wu', city: '夷陵' },
      { id: 'sp_sg_jianye', name: '建业', kind: 'city', regionId: 'wu', city: '建业' },
    ],
    rivers: ['huanghe', 'changjiang', 'huaihe', 'hanshui', 'xiangjiang', 'ganjiang'],
  },

  /* ------------------------------------------------------------------ */
  /* 晋：南北朝收尾（577—589）                                           */
  /* ------------------------------------------------------------------ */
  sui: {
    dynastyId: 'jin',
    note:
      '南北朝收尾（577—589）：北周据关陇、巴蜀与河东，北齐据河北、山东与河南，陈据江南荆湖岭南，' +
      '突厥据漠北。版图按底板地理单元归属示意：周齐边界取潼关—洛阳以西，故洛阳在齐；' +
      '江陵（西梁）为周的附庸，图中系于陈。',
    attacker: {
      id: 'beizhou',
      name: '北周',
      cells: ['shaanxi_n', 'shaanxi_bei', 'gansu', 'ningxia', 'sichuan', 'chongqing', 'shaanxi_s'],
      capital: '长安',
    },
    regions: [
      {
        id: 'qi',
        name: '北齐',
        cells: [
          'hebei_n', 'hebei_c', 'hebei_s', 'shanxi_n', 'shanxi_c', 'shanxi_s', 'shanxi_se',
          'shandong', 'henan_w', 'henan_c', 'henan_e', 'henan_n', 'beijing', 'tianjin',
        ],
        capital: '邺',
      },
      {
        id: 'chen',
        name: '陈',
        cells: ['jiangsu_n', 'jiangsu_s', 'anhui_n', 'anhui_s', 'zhejiang', 'shanghai', 'jiangxi', 'fujian', 'hubei', 'hunan', 'guangdong', 'guangxi'],
        capital: '建康',
      },
      { id: 'tujue', name: '突厥', cells: ['neimenggu', 'jilin', 'heilongjiang', 'liaoning'], backdrop: true },
      { id: 'xiyu', name: '西域·高原诸部', cells: ['xinjiang', 'qinghai', 'xizang'], backdrop: true },
      { id: 'xinan', name: '爨氏·西南夷', cells: ['yunnan', 'guizhou'], backdrop: true },
    ],
    points: [
      { id: 'sp_su_tongguan', name: '潼关', kind: 'pass', regionId: 'beizhou', city: '潼关' },
      { id: 'sp_su_pingyang', name: '平阳', kind: 'battle', regionId: 'qi', city: '平阳' },
      { id: 'sp_su_jinyang', name: '晋阳', kind: 'city', regionId: 'qi', city: '晋阳' },
      { id: 'sp_su_luoyang', name: '洛阳', kind: 'city', regionId: 'qi', city: '洛阳' },
      { id: 'sp_su_guangling', name: '广陵', kind: 'city', regionId: 'chen', city: '广陵' },
      { id: 'sp_su_caishi', name: '采石', kind: 'pass', regionId: 'chen', city: '采石' },
      { id: 'sp_su_jingkou', name: '京口', kind: 'pass', regionId: 'chen', city: '京口' },
    ],
    rivers: ['huanghe', 'changjiang', 'huaihe', 'hanshui'],
  },
}
