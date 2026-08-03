# Security and performance hardening

工作分支：`codex/security-performance-hardening`

本轮只处理网站安全、持久化韧性、构建和代码职责边界，不改变 Blender 模型、活动节点、
机械枢轴、键帽、字锤、滑架、滚筒、回车杆或既有动画状态机。

## 已实施

1. 项目书详情页的标题、说明和链接改为 DOM `textContent` / `createElement` 构建。
   外部链接只允许 HTTPS，站内相对链接允许当前 HTTP/HTTPS 源。
2. 新增 GitHub CI、Dependabot 和 CodeQL 配置。CI 使用 lockfile 安装并运行测试、
   类型检查、生产构建、资产预算和生产依赖审计。
3. Vercel 对带 hash 的 `/assets/*` 使用一年 immutable 缓存；固定名称的模型、纹理、
   音频和品牌资源使用一天缓存及七天 stale-while-revalidate。安全头增加明确 HSTS、
   COOP 和 CORP，CSP 将元素内联样式权限缩小到 `style-src-attr`。
4. Phase 9 收紧生产构建预算：`dist` 不超过 55 MiB，单文件不超过 15 MiB，首页三个 GLB
   合计不超过 25 MiB。桌子内嵌纹理已从 2K 降至 1536 px；继续降到 1K 会进入新的视觉审核，
   因此本轮不牺牲已通过材质质量。
5. 归档输入限制为单张正文 4096 字符、序列化输入 4.5 MB、设备持久化 1000 张。
   右抽屉的 60 张视觉满载状态不变；1000 张是浏览器本地持久化安全边界，不是抽屉视觉容量。
6. 归档读取、旧 `typeword` 键迁移、满容量 QA 和写入失败处理从 `main.ts` 抽到
   `src/archive-runtime.ts`。机械运行时没有移动或合并。
7. Vite 从 8.1.5 更新到 8.2.0。`@types/node` 保持 24.x，不进行跨主版本更新。

## 明确未做

- 未运行 `npm audit fix --force`。
- 未安装仍受 Sharp 安全暂缓约束的 `@gltf-transform/functions`。
- 未把活动件合并为静态网格。
- 未将第三方桌子降到 1K，也未重写 Git 历史或迁移 Git LFS。
- GitHub 私有仓库是否具备 CodeQL/Advanced Security 权限，需要在工作流首次运行后确认。

## 验证

```bash
npm test
npm run typecheck
npm run build
npm run assets:budget
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
npm run blender:smoke
git diff --check
```

自动验证、浏览器视觉检查和用户验收继续作为三个独立审核门。
