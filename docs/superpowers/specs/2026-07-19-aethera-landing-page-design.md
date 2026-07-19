# Aethera 独立主页设计

## 目标

新增一个可分享的 `/aethera` 独立落地页，用于展示 Aethera 品牌视觉。既有系统的首页、业务页面、接口和登录流程保持不变。

## 页面与路由

- 当浏览器路径为 `/aethera` 时，应用渲染新的 `AetheraLandingPage`。
- 其他路径继续渲染现有 `App` 内容，不改变其当前初始页面或导航逻辑。
- 两个 “Begin Journey” 按钮仅作为视觉 CTA，不新增跳转或业务操作。

## 组件边界

- `src/components/AetheraLandingPage.tsx`：独立承载导航、首屏文案、CTA 和背景图片。
- `src/styles/fonts.css`：导入 Instrument Serif 与 Inter 字体。
- `src/styles/theme.css`：只放 Aethera 页面使用的 `fade-rise`、`fade-rise-delay` 与 `fade-rise-delay-2` 动画规则。
- `src/main.tsx`：根据 `window.location.pathname` 选择现有 `App` 或 `AetheraLandingPage`。

这会避免继续扩展现有体量较大的 `App.tsx`，并让新样式不参与系统主题变量的覆盖。

## 视觉与交互

- 背景使用用户上传的油田河流航拍图，复制到 `public/aethera/oilfield-river.png`，采用 `object-fit: cover`、图片淡入与轻微缩放进入效果。
- 图片替代原提示词中的视频，因此不实现视频首尾的手动淡入淡出循环；首屏其他入场动画仍保留。
- 页面为白色基底；背景图片从距顶部 300px 开始铺满余下首屏区域，并叠加从白色到透明再到白色的纵向渐变遮罩，以保证黑色标题的可读性。
- 顶部导航与主内容在背景层之上。导航最大宽度为 `max-w-7xl`，使用 `px-8 py-6`。
- 标题、描述和主 CTA 分别采用 0s、0.2s、0.4s 的淡入上移入场动画；按钮 hover 时缩放至 1.03。
- 小屏隐藏文字导航，保留品牌标识和 CTA；标题字号与图片起始位置随断点缩小。

## 文案与样式

- 标志：`Aethera®`；标题与标志采用 Instrument Serif。
- 导航与描述采用 Inter。`Home` 为黑色，其他菜单为 `#6F6F6F`。
- 标题：`Beyond silence, we build the eternal.`，其中 `silence,`、`the eternal.` 为灰色斜体。
- 描述与 CTA 文案严格使用用户提供的英文内容。
- 主色：背景白色、文字与按钮黑色、说明及非激活导航灰色、按钮文字白色。

## 验证

1. 执行 `npm run lint`，确认 TypeScript 类型检查通过。
2. 执行 `npm run build`，确认 Vite 能构建新入口和静态资源。
3. 在 `http://localhost:5000/aethera` 检查：航拍背景、渐变遮罩、字体、三段入场动画、悬停缩放和窄屏布局。
4. 在 `http://localhost:5000/` 检查：既有系统仍正常显示。
