import fs from 'node:fs'
const file = 'src/data/endgame.nanbei.json'
const data = JSON.parse(fs.readFileSync(file, 'utf8'))

// 577 周灭北齐：长安 → 潼关 → 平阳（晋州）→ 晋阳 → 邺
data.events[0].campaigns = [
  { phase: 1, side: 'qin', general: '宇文邕', from: '长安', to: '平阳', via: ['潼关'],
    points: [ { x: 29, y: 56.3 }, { x: 51.2, y: 60.6 }, { x: 53.6, y: 53.1 } ], result: '克平阳' },
  { phase: 2, side: 'qin', general: '宇文邕', from: '平阳', to: '晋阳',
    points: [ { x: 53.6, y: 53.1 }, { x: 54.6, y: 48.9 }, { x: 55.6, y: 44.7 } ], result: '克晋阳' },
  { phase: 3, side: 'qin', general: '宇文邕', from: '晋阳', to: '邺',
    points: [ { x: 55.6, y: 44.7 }, { x: 61, y: 46 }, { x: 66.2, y: 46.9 } ], result: '克邺，北齐亡' },
]

// 589 隋灭陈：杨素自永安下三峡至江陵；贺若弼广陵渡江取京口；韩擒虎庐江渡采石入建康
data.events[1].campaigns = [
  { phase: 1, side: 'qin', general: '杨素', from: '永安', to: '江陵', via: ['三峡'],
    points: [ { x: 39.2, y: 73.4 }, { x: 43, y: 73.2 }, { x: 47, y: 73.1 } ], result: '下三峡' },
  { phase: 2, side: 'qin', general: '贺若弼', from: '广陵', to: '京口',
    points: [ { x: 91.6, y: 68.8 }, { x: 90.9, y: 71 }, { x: 90.6, y: 73.4 } ], result: '渡江取京口' },
  { phase: 3, side: 'qin', general: '韩擒虎', from: '庐江', to: '建康', via: ['采石'],
    points: [ { x: 82, y: 70.6 }, { x: 84.3, y: 76.9 }, { x: 87, y: 76.1 } ], result: '入建康，陈亡' },
]

fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
console.log('campaigns updated')
