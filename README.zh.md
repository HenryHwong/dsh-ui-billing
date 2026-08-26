# dsh-ui-billing

> **🌐 语言 / Language：** [English](README.md) · [**简体中文**](README.zh.md)

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web GUI 的计费控件插件：侧边栏底部（`sidebar.footer.action`）的一个条目，显示当前选中对话的费用——来自本插件注册的 `billing` 会话投影——以及 provider 账户余额——来自 `/billing` 连接通道。

**GitHub 话题**：`dsh-plugin` · `deepseek-harness`

---

## 功能

- **当前会话费用**。节点半端把每条 `assistant/message` 的 usage 记录折叠进 `billing` 会话投影（整篇日志的 CNY 费用与未计价 token 数），按组合加载时捕获的价格表计价；宽侧边栏渲染一行带标签的数值显示所选对话的金额。切换会话即切换数值；分页与压缩不会改变它。含未计价 token 的会话在金额上显示 `(+N tokens unpriced)` 提示。
- **实时 API 余额**。余额行通过 harness 自身的连接事实（合并的 `llm-deepseek` 设置 + 启动环境 + 凭据通道）读取 provider 账户，挂载期间每 60 秒刷新一次，连接重置后重读，也可通过行内刷新按钮手动刷新。
- **折叠轨道字形**。侧边栏折叠时只渲染一个 ¥ 字形，提示气泡携带两行内容；点击即刷新余额。
- **默认空闲**。没有订阅者挂载时不发起任何请求——余额轮询随第一个订阅者启动、随最后一个离开停止。

## 计价

费用折叠按每条 usage 步骤的 `source.model` 对照插件的默认 CNY/百万 token 价格表计价。V4 目录为官方现行价目表（缓存未命中 / 缓存读取 / 输出，均为空闲时段单价；官方高峰时段为北京时间周一至周五 09:00-12:00、14:00-18:00，各字段翻倍）：

| 模型 | 输入（缓存未命中） | 缓存读取 | 输出 |
| --- | --- | --- | --- |
| `deepseek-v4-flash` | 1.5 | 0.05 | 4.5 |
| `deepseek-v4-pro` | 4.5 | 0.15 | 13.5 |
| `deepseek-v4-flash-vision-exp` | 1.5 | 0.05 | 4.5 |

`deepseek-chat` / `deepseek-reasoner` 保留 V3 时代锚点（2/0.5/8 与 4/1/16）以覆盖旧 usage 记录；现行 API 目录只有 V4 模型。没有价格条目的模型，其 token 计入 `unpricedTokens` 而不是假装免费，这样 GUI 可以放心显示"费用"而无需假装未知定价的模型免费。峰谷计价默认开启：`peakHours` 默认是官方高峰窗口 `[[540, 720], [840, 1080]]`（价格时钟零点起算的分钟），`utcOffsetMinutes` 默认 480（北京时间）；时间窗模型无法排除周末，需要精确周末空闲价时清空 `peakHours` 或自行覆盖。价格是部署方的责任，必须跟随 provider 的现行价目表——用插件 `config.prices` 整体覆盖默认表：

```yaml
- id: ui-billing
  name: '@huanghanheng/dsh-ui-billing'
  config:
    prices:
      'deepseek-v4-pro':
        offPeak: { inputPerM: 4.5, cacheReadPerM: 0.15, outputPerM: 13.5 }
        peak: { inputPerM: 9, cacheReadPerM: 0.3, outputPerM: 27 }
    peakHours: [[540, 720], [840, 1080]]
    utcOffsetMinutes: 480
```

投影的 `stateVersion` 在折叠语义或默认价格表变化时升版，因此 harness 投影缓存会丢弃旧价格表折叠的行并整篇重算——历史对话总是按当前价格表一致地重计价。

## 安全

- **纯展示**。控件只渲染会话投影或 provider 账户里已有的数据。它不产生任何模型可见输入、不写会话日志，除节点半端在 loopback 权威下注册的只读 `/billing` 余额通道外不新增任何 RPC。
- **模型体验**：不进入任何模型请求；Token 影响无；KV 缓存影响无。
- **凭据留在宿主侧**。API key 由宿主半端通过 harness 的凭据服务或启动环境解析——与 DeepSeek provider 适配器同一通道——绝不进入浏览器包。

## 前置要求

- DeepSeek Harness 检出（或已发布的 `@deepseek-ai/dsh-*` 包）为 `0.1.1-rc.2` 或更新版本，并运行 web profile。
- **投影注册表已组合**：费用行读取节点半端注册的 `billing` 投影，需要 harness 的会话投影缝（`@deepseek-ai/dsh-session-projection`，随 web-app bundle 提供）。没有它插件仍可加载、余额行照常工作；费用行显示 `—`。
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
pnpm test                    # vitest：节点半端 + host 测试（投影折叠、余额读取、注册）
pnpm exec tsc -p tsconfig.json        # 类型检查浏览器半端 + 客户端测试
pnpm exec tsc -p tsconfig.host.json   # 类型检查节点半端 + host 测试
pnpm build                   # tsc 产出 lib/types + tsdown 打包节点半端
```

仓库针对已发布的 `@deepseek-ai/dsh-*` 包编译 `src/`；类型层面的 `@deepseek-ai/dsh-billing/client` 导入在 harness 发布该包前由 `types/dsh-billing/client.d.ts` 镜像提供。两个半端作为两个独立程序分别做类型检查，与 harness 的 host/client 项目拆分一致。测试覆盖投影折叠（计价辅助、峰谷窗口、未计价模型、注册接线）、余额读取（HTTP 归一化、凭据解析）、响应式源（投影跟随、轮询生命周期）、组件（两行、刷新、轨道字形），以及节点半端在真实 cordis 上下文上的注册与释放。浏览器半端的完整上下文注册测试保留在 harness 检出中：已发布的客户端包是 ModuleLoader 注册形态，普通 vitest 导入无法加载 runtime 的槽位服务。

## Known Limitations and Deferred Work

- 未指定 provider 时余额行显示第一个 provider 路由的余额（默认 `deepseek-official`）；多 provider 部署暂不能从控件选择路由（通道已接受 `provider`，未来的选择器只是纯客户端改动）。
- 默认价格表是官方现行 V4 价目表的静态快照（含北京工作日峰谷窗口）。provider 改价后，部署方必须用 `config.prices` 覆盖——请对照 provider 现行价目表核对。
- 不单独建模 provider 的 reasoning 附加费：适配器报告的 `outputTokens` 已包含 reasoning token，因此只对四个计费字段计价。

## 许可

MIT
