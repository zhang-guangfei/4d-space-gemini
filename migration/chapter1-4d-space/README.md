# 待迁移参考版本：第一章《回廊空间站》（源自 `zhang-guangfei/4d-space`）

> **来源仓库**：`https://github.com/zhang-guangfei/4d-space`（`apps/fps-demo/dist/` 及 `docs/design/chapter-1-current.md`）  
> **在线参考**：`https://zhang-guangfei.github.io/4d-space/chapter.html`  
> **迁入日期**：2026-11-28

## 迁入定位与后续打磨计划
- **核心优势资产（重点保留并迁入正式第一章）**：
  - `station-renderer.js`：高完成度空间站回廊建筑建模、材质与光影呈现；
  - `classical-statues.js`、`assets/classical-statues/`（大卫 & 维纳斯高精度雕塑模型与法线贴图）、`seated-thinker.js`、`standing-technician.js`、`statue-lighting.js`、`statue-palette.js`、`statue-placement.js`；
  - `astronaut.js`、`colored-tesseract.js`、`hatch.js`、`visible-optics.js`、`optics.js`。
- **待重做与打磨部分（待序章完成后统一精修）**：
  - 关卡节奏与玩法流程重构；
  - 完整融入本项目的星舰文明主线剧情（07 号林夏、08 号与高维遗迹）；
  - 发现式引导与教学、上下文感知 `H` 提示、交互式 `I` 键 3D 原理卡及统一的高品质 UI/UX。
- **工程说明**：本目录暂作为迁移素材暂存区，未接入当前 `src/` 构建入口，已剔除重复的 `vendor/babylon.js`（正式迁移时直接复用本项目 `node_modules/babylonjs/`）。
