# 侧边栏 Logo 上传 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 管理员可在系统设置上传侧边栏 Logo，上传后应用导航栏显示该图片，未上传时保持默认标识。

**Architecture:** 复用既有系统图片上传接口及 `sidebarLogo` 配置键。系统设置页负责上传并写入配置；应用壳层读取配置，并将有效图片 URL 传入侧边栏显示逻辑；默认标识作为空值回退。

**Tech Stack:** React 19、TypeScript、Axios、Express 现有 `/api/uploads/image`、node:test。

---

### Task 1: 添加失败测试

**Files:**
- Modify: `C:/Users/31541/Desktop/7.6/Fzs/gszhushuiSQL/tests/appShell.test.ts`
- Test: `C:/Users/31541/Desktop/7.6/Fzs/gszhushuiSQL/tests/appShell.test.ts`

- [ ] **Step 1: 写入设置入口与回退渲染测试**

在 `tests/appShell.test.ts` 添加测试，验证源码存在以下行为：隐藏的 `sidebarLogoInputRef` 文件输入框、`FormData` 中的 `target=sidebarLogo`、成功后 `axios.post("/api/config", { key: "sidebarLogo", value: data.url })`，以及侧边栏使用 `sidebarLogo` 图片并保留默认标识回退。

```ts
test("system settings uploads a sidebar logo while the app shell keeps its default logo fallback", () => {
  assert.match(appSource, /sidebarLogoInputRef/);
  assert.match(appSource, /formData\.append\("target", "sidebarLogo"\)/);
  assert.match(appSource, /axios\.post\("\/api\/config", \{ key: "sidebarLogo", value: data\.url \}\)/);
  assert.match(appSource, /sidebarLogo \? <img/);
  assert.match(appSource, /: <div className="shell-logo-mark"/);
});
```

- [ ] **Step 2: 运行测试确认失败**

运行：`npx tsx --test tests/appShell.test.ts`

预期：新增测试失败，因为当前没有侧边栏 Logo 上传和渲染逻辑。

- [ ] **Step 3: 提交失败测试**

运行：`git add tests/appShell.test.ts; git commit -m "test: cover sidebar logo upload"`

### Task 2: 实现上传与侧边栏显示

**Files:**
- Modify: `C:/Users/31541/Desktop/7.6/Fzs/gszhushuiSQL/src/App.tsx:952-1070,8270-8590`
- Test: `C:/Users/31541/Desktop/7.6/Fzs/gszhushuiSQL/tests/appShell.test.ts`

- [ ] **Step 1: 在系统设置页实现上传处理**

添加 `sidebarLogoInputRef` 和 `uploadSidebarLogo(file)`：文件存在时创建 `FormData`，附加 `file` 与 `target=sidebarLogo`，调用 `POST /api/uploads/image`；成功后调用 `POST /api/config` 持久化返回 URL，并通过 `setConfig` 更新本页预览数据；失败时设置现有错误状态。文件输入限制为 `accept="image/*"`。

- [ ] **Step 2: 增加基础配置中的上传入口**

在基础配置表单下方添加隐藏文件输入和“上传侧边栏 Logo”按钮；有 `config.sidebarLogo` 时展示小尺寸预览。按钮仅触发文件选择，不接受 URL 文本。

- [ ] **Step 3: 在应用壳层加载并使用配置**

在应用根组件加载 `/api/config` 中的 `sidebarLogo`，把该值用于侧边栏品牌区域。渲染使用：

```tsx
{sidebarLogo ? <img src={sidebarLogo} alt="系统 Logo" className="shell-logo-image" /> : <div className="shell-logo-mark">注</div>}
```

保持既有系统名称与副标题；配置加载失败或空值时不影响默认侧边栏展示。

- [ ] **Step 4: 验证测试通过**

运行：`npx tsx --test tests/appShell.test.ts`

预期：新增测试及原有测试全部通过。

- [ ] **Step 5: 提交实现**

运行：`git add src/App.tsx tests/appShell.test.ts; git commit -m "feat: add sidebar logo upload"`

### Task 3: 全量验证

**Files:**
- Verify: `C:/Users/31541/Desktop/7.6/Fzs/gszhushuiSQL/tests/**/*.test.ts`
- Verify: `C:/Users/31541/Desktop/7.6/Fzs/gszhushuiSQL/src/App.tsx`

- [ ] **Step 1: 运行完整验证**

运行：`npm test; npm run lint; npm run build`

预期：所有命令以退出码 0 完成。

- [ ] **Step 2: 浏览器验证**

以“采油管理部”账号打开“系统设置”，上传小于 5MB 的图片；确认设置页显示预览、左侧导航栏更新为该图片。刷新页面后图片仍保留；无配置时显示默认标识。
