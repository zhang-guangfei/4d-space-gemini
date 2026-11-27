# 《维度之外 · Beyond 3D》

基于真实四维欧氏几何与拓扑学的 3D 第一人称科幻解谜游戏（从零绿色新建仓库）。

## 设计文档（最高设计契约）

完整设计规范位于 [docs/design/gdd/](docs/design/gdd/README.md)：
- [00-master-gdd.md](docs/design/gdd/00-master-gdd.md) — 总游戏设计文档（D1–D13 决策、五大设计支柱、18 关规范）
- [05-from-zero-build-plan.md](docs/design/gdd/05-from-zero-build-plan.md) — 分阶段工程构建路线图
- [quality-spec-v1.md](docs/design/quality-spec-v1.md) — 全游戏品质规格说明书 v1.0（以第 14 关试玩版为硬性基准的 7 大维度品质门槛）

## 当前里程碑状态

- [x] **Phase 0**：项目脚手架、自动化测试与静态打包流水线 + 纯四维数学内核（`src/core/math4d.js`）
- [x] **Phase 1**：公共四维操作系统（D8 滚轮唯一控四维、`E` 第三人称抓取舞台、`Tab` 诚实双视图 `XZW`、`F` 可折叠三折页全息台、`H` 键 45 秒三级口头提示、双角色语音）+ **第 14 关「发丝裂缝」3D 垂直切片**
- [x] **Phase 2.1**：第一幕《回廊科研站》序章 + 第 1–4 关（正八胞体 8 胞无门框无缝三维边界、全关卡 `I` 键 3D 交互原理卡、上下文感知 `H` 提示、3D 空间浮签、AAA 级镜面/软影/液态水银材质与实机游玩品质审计门禁）
- [ ] **Phase 2.2**：第二幕《折页之间》第 5–12 关

## 本地运行与测试

```bash
npm install             # 安装本地 Babylon.js 依赖（离线可运行）
npm run check           # 语法检查、纯内核隔离校验与渲染防回退校验
npm test                # 运行全部 Node.js 确定性四维几何与关卡状态机测试
npm run serve           # 启动本地 3D 预览服务（默认端口 4173）
npm run audit:playtest  # 启动无头 Chromium 真实键鼠实机游玩 + 品质规格 v1.0 自动审计
npm run build:site      # 输出纯静态站点至 _site/（供 GitHub Pages 部署）
```
