# dsh-ui-billing

> **🌐 语言 / Language：** [English](README.md) · [**简体中文**](README.zh.md)

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web GUI 的计费控件插件：侧边栏底部（`sidebar.footer.action`）的一个条目，显示当前选中对话的费用——来自 `billing` 会话投影——以及 provider 账户余额——来自 `/billing` 连接通道。

**GitHub 话题**：`dsh-plugin` · `deepseek-harness`

---

## 功能

- **当前会话费用**。宽侧边栏渲染一行带标签的数值，显示所选对话的整篇日志计价费用（CNY）。切换会话即切换数值；分页与压缩不会改变它。含未计价 token 的会话在金额上显示 `(+N tokens unpriced)` 提示。
- **实时 API 余额**。余额行通过 harness 自身的连接事实（合并的 `llm-deepseek` 设置 + 启动环境 + 凭据通道）读取 provider 账户，挂载期间每 60 秒刷新一次，连接重置后重读，也可通过行内刷新按钮手动刷新。
- **折叠轨道字形**。侧边栏折叠时只渲染一个 ¥ 字形，提示气泡携带两行内容；点击即刷新余额。
- **默认空闲**。没有订阅者挂载时不发起任何请求——余额轮询随第一个订阅者启动、随最后一个离开停止。

## 安全

- **纯展示**。控件只渲染会话投影或 provider 账户里已有的数据。它不产生任何模型可见输入、不写会话日志，除节点半端在 loopback 权威下注册的只读 `/billing` 余额通道外不新增任何 RPC。
- **模型体验**：不进入任何模型请求；Token 影响无；KV 缓存影响无。
- **凭据留在宿主侧**。API key 由宿主半端通过 harness 的凭据服务或启动环境解析——与 DeepSeek provider 适配器同一通道——绝不进入浏览器包。

## 前置要求

- DeepSeek Harness 检出（或已发布的 `@deepseek-ai/dsh-*` 包）为 `0.1.1-rc.2` 或更新版本，并运行 web profile。
- **宿主 billing 投影**：费用行读取 `billing` 会话投影，由 harness 的 `@deepseek-ai/dsh-billing` 插件提供（随 harness 0.1.1 发布）。没有它插件仍可加载、余额行照常工作；费用行显示 `—`。
- **DeepSeek API key**：通过 harness 的凭据服务配置（web Models 页写入）或在启动环境中导出，即 `DEEPSEEK_API_KEY`（`llm-deepseek` 路由的默认 key 引用）。
- 无需宿主插桩：控件注册的 `sidebar.footer.action` 座位随已发布的 `@deepseek-ai/dsh-client-ui-sidebar` 提供。

## 安装

插件像其他 DSH bundle 一样安装进 web profile；无需对 harness 检出做任何源码修改。

### 方式一——通过 `dsh plugin` 的 bundle 安装（推荐）

本仓库是一个 [DSH bundle](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/architecture.md)：`package.json` 声明了 `dsh.bundle.patch` → `./cordis.patch.yml`，因此 profile 插件管理器会把它作为补丁层安装，补丁会把插件插入 web profile 的浏览器花名册。

```sh
# 直接从 git 仓库安装（无需发版 npm）：
dsh plugin --profile web add @huanghanheng/dsh-ui-billing

# 或发布到 npm 后（更短的 spec）：
dsh plugin --profile web add @huanghanheng/dsh-ui-billing
```

`dsh plugin` 在 profile 目录里执行 `pnpm add`，并自动对账 `dsh.profile.bundles`：manifest 声明了 `dsh.bundle.patch` 的依赖会自动加入层栈。

### 方式二——手动 npm 安装

包发布到 npm，且构建产物（`lib/`）已提交，因此可以像普通包一样安装：

```sh
# 在应用运行的 profile 目录（或应用本身）里：
npm install @huanghanheng/dsh-ui-billing
# 或：pnpm add @huanghanheng/dsh-ui-billing
```

手动 `npm install` **不会**自动加入 bundle 层——需要在 profile manifest 里声明，补丁才会插入插件行：

```json
// $DSH_HOME/profiles/web/package.json
{
  "dependencies": { "@huanghanheng/dsh-ui-billing": "^0.1.0" },
  "dsh": { "profile": { "bundles": ["@huanghanheng/dsh-ui-billing"] } }
}
```

或者直接运行 `dsh plugin --profile web add @huanghanheng/dsh-ui-billing`，它会替你完成安装与 bundle 层对账（等价于方式一）。

## Model Experience

#### 模型看到什么

无。控件只读取 `billing` 投影与 `/billing` 余额通道——两者都是只读展示面，数据已在会话日志或 provider 账户中。

#### Token 影响

无。

#### KV Cache 影响

无。

## 开发

```sh
pnpm install
pnpm vitest run tests/        # 单元测试（模型 + 组件，jsdom）
pnpm bundle                   # tsdown 客户端打包（clientBundle 预设需要 harness 检出）
```

仓库针对已发布的 `@deepseek-ai/dsh-*` 包编译 `src/`；类型层面的 `@deepseek-ai/dsh-billing/client` 导入在 harness 发布该包前由 `types/dsh-billing/client.d.ts` 镜像提供。测试覆盖余额读取（HTTP 归一化、凭据解析）、响应式源（投影跟随、轮询生命周期）、组件（两行、刷新、轨道字形），以及两个半端在真实 cordis 上下文上的注册与释放。

## Known Limitations and Deferred Work

- 未指定 provider 时余额行显示第一个 provider 路由的余额（默认 `deepseek-official`）；多 provider 部署暂不能从控件选择路由（通道已接受 `provider`，未来的选择器只是纯客户端改动）。
- 费用按 `billing` 投影插件在组合加载时捕获的价格表计价；默认值与覆盖方式见该包 README。

## 许可

MIT
