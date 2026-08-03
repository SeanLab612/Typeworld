# 依赖说明

## glTF Transform 优化包暂缓

环境初始化时安装 `@gltf-transform/functions@4.4.2` 后，`npm audit` 报告其间接依赖
`sharp@0.34.5` 命中高危安全公告 `GHSA-f88m-g3jw-g9cj`，当前审计建议只能通过降级
`@gltf-transform/functions` 规避。

本项目在 Phase 0–4 不需要服务端处理不可信图片，因此已从基线依赖中移除
`@gltf-transform/functions`，保留无该审计问题的 `@gltf-transform/core` 和
`@gltf-transform/extensions`。

Phase 5 开始前已于 2026-07-29 重新执行：

```bash
npm audit
npm view @gltf-transform/functions version
```

结果：

- 项目现有依赖：`npm audit --audit-level=high` 为 0 漏洞。
- `@gltf-transform/functions` 最新仍为 `4.4.2`。
- 其 `ndarray-pixels@5.0.1` 依赖 `sharp ^0.34.0`，不能解析到当前
  `sharp 0.35.3`。

因此 Phase 5 继续不安装 functions 包，只用 `@gltf-transform/core` 和 extensions
生成非破坏性优化报告。只有在依赖链审计干净或风险被明确评估后才安装最终优化工具。
禁止为了让审计数字归零而自动执行 `npm audit fix --force` 或未经评估地降级主版本。

## 2026-07-31 安全与构建复核

- Vite 已从 `8.1.5` 更新到兼容小版本 `8.2.0`。
- `npm audit --omit=dev --audit-level=high` 与完整 `npm audit --audit-level=high`
  均为 0 漏洞。
- `@types/node` 保持 24.x；最新 26.x 属于跨主版本变化，本轮不升级。
- `@gltf-transform/functions` 最新仍为 4.4.2，仍通过
  `ndarray-pixels@5.0.1` 声明 `sharp ^0.34.0`，因此继续遵守原安全暂缓。
- 新增 `npm run assets:budget`，在构建后检查生产总大小、单文件大小与首页 GLB 集合。

## Phase 8A 场景加载

`green` 使用 Three.js 已随主包提供的 `HDRLoader` 读取 CC0 HDRI，并使用现有
`TextureLoader` 加载 8K 色调映射实景全景，`ShadowMaterial` 负责透明接触阴影。没有为
该场景新增 npm 运行时依赖。生产构建通过 `vite.config.ts` 显式发射两个正式场景资源，
避免 `copyPublicDir: false` 时只在开发服务器可见、部署产物缺失。

## img2threejs 材质旁路

2026-07-30 的打字机材质优化只调用本地
`<local-workspace>/img2threejs/forge/` 中的 Python 3.10+ 标准库脚本生成证据、
分区和对照图，没有把 img2threejs 加为 npm、浏览器运行时或发布依赖。生产材质仍由本仓库
Blender Python 生成。未执行 `npm audit fix --force`。

## Phase 15 内嵌 GLB 纹理优化

`scripts/optimize-embedded-glb-textures.mjs` 使用 Node.js 标准库与 macOS 系统自带
`/usr/bin/sips` 重采样内嵌 PNG，并重建 GLB bufferView 偏移。它不引入 Sharp、
`@gltf-transform/functions` 或新的 npm/浏览器运行时依赖；只在缩放后资源更小时替换，
输出后必须通过节点、网格、蒙皮、动画和活动枢轴验证。
