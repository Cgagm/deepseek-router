# 发布前验证清单

## 使用方式
每次准备说"完成"前，逐项打勾。全部 ✅ 才能汇报。

---

## 本地验证
- [ ] `pnpm run typecheck` 通过
- [ ] `pnpm run build` 通过
- [ ] `pnpm run format:check` 通过
- [ ] `pnpm run lint` 通过
- [ ] `pnpm run test` 全部通过
- [ ] `pnpm install --frozen-lockfile` lockfile 同步

## 用户路径模拟
- [ ] tarball 安装测试：`npm install -g xxx.tgz` 成功
- [ ] CLI 启动测试：`deepseek-router` 正常启动
- [ ] 健康检查端点响应正常

## 远端确认
- [ ] `git push` 成功
- [ ] GitHub API 确认 CI 全绿
- [ ] GitHub API 确认 Docker build 成功
- [ ] GitHub API 确认 Release 可用
- [ ] 下载链接可访问

## Agent 审计
- [ ] 独立 Agent 验证通过（代码质量/安全/功能）
- [ ] 独立 Agent 模拟用户安装确认

---

## 出口条件
**以上全部打勾前，禁止向用户说"完成/通过/好了"。**
