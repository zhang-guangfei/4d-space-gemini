/** Audited description / explanatory scope / limits; controls remain separate. */
export const MODEL_CONTENT={
  "central-hall": {
    "base": "central-hall",
    "variant": "orbit-horizontal",
    "title": "中央大厅假说",
    "explanation": "也许四段走廊围着一座大厅，首尾相接。沿走廊前进，左边始终是中央大厅。",
    "prediction": "沿走廊绕一圈，会回到原处；途中左侧仍是同一座大厅。",
    "experiment": "拖动滑块，观察人物绕行大厅；旋转视图，看看整条走廊。",
    "limitation": "沿弯道前进需要转向，普通光线也不会随走廊拐弯。这些与眼前的直行景象是否相符，还需要对照。"
  },
  "treadmill": {
    "base": "treadmill",
    "variant": "belt-forward",
    "title": "跑步机假说",
    "explanation": "也许不是人在前进，而是四段走廊不断后退、接回前方。左右两间侧室留在原处，每过一段，分别向相反方向转过四分之一圈。",
    "prediction": "走廊不断经过，两侧房间却没有换过。经过四段，它们又回到原来的朝向。",
    "experiment": "拖动滑块，留意走廊的移动和两侧房间的转动。",
    "limitation": "是什么让这些房间同步运动？光线又如何贯通？仅凭这段演示，还无法判断。"
  },
  "sphere": {
    "base": "sphere",
    "variant": "great-circle",
    "title": "球壳赤道假说",
    "explanation": "也许走廊贴着球壳的内侧，四段房间沿赤道围成一圈。脚朝壳壁，头朝球心；左右两侧分别通向两个极区房间。",
    "prediction": "绕行后能回到原处，两侧也始终朝向各自的极区。",
    "experiment": "拖动滑块走完一圈，再转动视图，看看走廊和两极的位置。",
    "limitation": "这个球壳模型还没有说明所有房间如何相连。普通光线不会自动贴着球壳绕行，远处的景象也还需要解释。"
  },
  "colored-tesseract": {
    "base": "colored-tesseract",
    "variant": "colored-topology",
    "title": "八胞体魔方假说",
    "explanation": "也许这些房间是八胞体的八个立方胞，沿各自的面彼此相接。眼前的彩色模型是三维投影，交叠处不一定相通。",
    "prediction": "在这个模型里，每胞连接六个邻胞，另有一个不相邻的对胞。颜色能帮你追踪同一间房。",
    "experiment": "选择胞查看邻居；以中央的小人为参照，观察两侧雕像与房间的转动。拖动视图，或切换旋转平面后拖动滑块。",
    "limitation": "投影只显示形状与连接，不能验证这里的光路。小人只是居中的步行参照，不代表始终待在同一间房；两座雕像随各自的房间投影。模型的变形不等于真实房间变形。"
  }
};
const ROOM_BASES={'W+':'colored-tesseract','X+':'treadmill','W-':'sphere','X-':'central-hall'};
export const ROOM_MODELS=Object.fromEntries(Object.entries(ROOM_BASES).map(([id,base])=>[id,{...MODEL_CONTENT[base]}]));
export function roomModel(id){const key=String(id).replace('−','-').toUpperCase();if(!ROOM_MODELS[key])throw Error('Unknown model room '+id);return {...ROOM_MODELS[key],id:key};}
