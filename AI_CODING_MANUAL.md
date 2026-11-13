# 杭州天气监测平台 - AI Coding 实现手册

> **使用说明**：本手册专为 Cursor 辅助开发设计。建议将本文件放置在项目根目录，开发时按阶段推进。每次向 Cursor Composer (`Cmd/Ctrl + I`) 提问时，可直接引用本手册（输入 `@AI_CODING_MANUAL.md`）并复制对应阶段的 **Cursor Prompt**。

---

## 零、 全局代码架构与目录规范（AI 生成基准）

在让 Cursor 生成代码前，确立以下**高内聚、低耦合的代码架构**。你可以直接让 Cursor 严格按照此目录树生成对应文件，确保前后端类型共享、逻辑分离：

```text
hangzhou-weather/
├── app/                          # Next.js App Router 核心目录
│   ├── api/                      # 后端 Serverless API 路由层
│   │   └── weather/
│   │       ├── current/
│   │       │   └── route.ts      # [GET] 获取实时天气（含 30 分钟数据库缓存防刷机制）
│   │       ├── history/
│   │       │   └── route.ts      # [GET] 查询历史气象日志（支持 24h / 7d 聚合，供图表使用）
│   │       └── sync/
│   │           └── route.ts      # [GET/POST] 定时采集任务入口（校验 CRON_SECRET 后写入 Supabase）
│   ├── globals.css               # 全局 Tailwind 样式与自定义滚动条/毛玻璃特效变量
│   ├── layout.tsx                # 根布局（注入中文字体、全局 Metadata、背景渐变容器）
│   └── page.tsx                  # 监控大盘主页面（客户端状态管理、定时轮询、组装所有 UI 组件）
├── components/                   # 前端 UI 展示组件层（纯视图渲染，不包含直接数据库操作）
│   ├── WeatherHeader.tsx         # 顶部导航栏：标题、北京时间实时时钟、手动刷新按钮、灾害预警横幅
│   ├── CurrentWeatherCard.tsx    # 核心大盘卡片：大字号当前气温、天气图标、体感温度、今日极值
│   ├── WeatherMetrics.tsx        # 气象细节网格：湿度、风向风速、AQI 空气质量徽章、气压/能见度
│   ├── TempTrendChart.tsx        # 数据可视化图表：基于 Recharts 的气温与体感温度变化双曲线图
│   └── LifeStyleTips.tsx         # 生活指数卡片：穿衣建议、紫外线强度、洗车指数提示
├── lib/                          # 基础设施与第三方服务封装层（纯服务端/通用工具函数）
│   ├── supabase.ts               # Supabase 客户端实例（区分前端只读 anon 客户端与后端读写 admin 客户端）
│   ├── qweather.ts               # 和风天气 API 适配器（封装请求、超时控制、错误兜底与数据格式清洗）
│   └── utils.ts                  # 通用工具函数（Tailwind 类名合并、UTC 转北京时间格式化工具）
├── types/                        # 全局 TypeScript 类型契约层（前后端共享数据结构）
│   └── weather.ts                # 定义 CurrentWeather, WeatherLog, WeatherAlert, LifeIndex 等核心接口
├── .cursorrules                  # Cursor AI 编码规范约束文件（强制严格类型、北京时间时区等）
├── .env.local                    # 本地环境变量密钥文件（不提交至 Git）
├── .env.example                  # 环境变量模板文件（供部署时对照填写）
├── vercel.json                   # Vercel 平台配置文件（定义自动化 Cron 定时采集任务）
└── package.json                  # 项目依赖与构建脚本声明
```

### 核心数据流转架构说明
1. **定时采集流（写入链路）**：`Vercel Cron (每小时)` -> 触发 `/api/weather/sync` -> 调用 `lib/qweather.ts` 拉取和风天气 -> 通过 `supabaseAdmin` 写入云端 PostgreSQL (`weather_logs` & `weather_alerts`)。
2. **用户访问流（读取链路）**：用户打开网页 `app/page.tsx` -> 并行请求 `/api/weather/current` 与 `/api/weather/history` -> 后端优先读取 Supabase 缓存（若缓存超过 30 分钟则触发一次实时拉取并回写数据库）-> 返回清洗后的标准 JSON -> 前端渲染大盘与 Recharts 图表。

---

## 阶段一：环境准备与基础设施配置（人工前置操作）

在开始写代码前，需完成外部服务的账号与密钥准备（约需 10 分钟）：

1. **获取气象数据源 Key**：
   * 注册并登录 [和风天气开发服务](https://dev.qweather.com/)。
   * 创建项目（选择免费订阅），获取 `API KEY` 和专属 `API Host`。
   * 查询杭州的 Location ID（杭州标准代码：`101210101`）。

2. **创建 Supabase 云端数据库**：
   * 注册并登录 [Supabase](https://supabase.com/)，新建一个名为 `hangzhou-weather` 的项目。
   * 进入左侧菜单 **SQL Editor**，新建查询并执行以下建表脚本：
     ```sql
     create table public.weather_logs (
       id uuid default gen_random_uuid() primary key,
       city text not null default '杭州',
       temperature numeric(4,1) not null,
       feels_like numeric(4,1),
       humidity integer,
       wind_speed numeric(4,1),
       wind_dir text,
       aqi integer,
       condition_text text,
       condition_icon text,
       recorded_at timestamp with time zone default timezone('utc'::text, now()) not null
     );
     
     create table public.weather_alerts (
       id uuid default gen_random_uuid() primary key,
       title text not null,
       severity text,
       description text,
       effective_time timestamp with time zone,
       created_at timestamp with time zone default timezone('utc'::text, now()) not null
     );
     
     alter table public.weather_logs enable row level security;
     alter table public.weather_alerts enable row level security;
     
     create policy "Enable read access for all users" on public.weather_logs for select using (true);
     create policy "Enable read access for all users" on public.weather_alerts for select using (true);
     ```
   * 进入 **Project Settings -> API**，记录 `Project URL`、`anon public` Key 以及 `service_role` Key（用于后端绕过 RLS 写入数据）。

---

## 阶段二：项目初始化与基础依赖安装

### 目标
搭建 Next.js (App Router) + Tailwind CSS + TypeScript 基础工程，并安装所需依赖库。

### 人工操作
打开终端执行初始化命令，随后用 Cursor 打开项目文件夹：
```bash
npx create-next-app@latest hangzhou-weather --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
cd hangzhou-weather
npm install @supabase/supabase-js lucide-react recharts clsx tailwind-merge
```

### Cursor Prompt（初始化规则与环境变量）
> 复制以下内容发送给 Cursor Composer：
```text
@AI_CODING_MANUAL.md
请严格按照手册中的“全局代码架构与目录规范”，帮我完成项目的初始化配置：
1. 在根目录创建 `.env.local` 和 `.env.example` 文件，包含以下环境变量占位符：
   - QWEATHER_API_KEY
   - QWEATHER_API_HOST
   - HANGZHOU_LOCATION_ID=101210101
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY
   - CRON_SECRET（用于保护定时同步接口，可先填一个随机字符串）
2. 创建 `types/weather.ts`，定义清晰的 TypeScript 类型接口并加上详细中文注释，包括：实时天气数据（CurrentWeather）、历史记录日志（WeatherLog）、空气质量（AirQuality）、气象预警（WeatherAlert）以及生活指数（LifeIndex）。
3. 创建 `lib/utils.ts`，封装 Tailwind 的 `cn` 合并函数以及将 UTC 时间戳转换为北京时间（Asia/Shanghai）的格式化函数。
4. 创建 `.cursorrules` 文件，规定 AI 编码风格：使用 TypeScript 严格模式、关键函数与复杂逻辑必须附带中文注释、Tailwind CSS 响应式开发、所有时间展示统一为北京时间。
```
*(完成后，请手动将阶段一获取的真实密钥填入 `.env.local`)*

---

## 阶段三：底层服务封装（Supabase & 和风天气 API）

### 目标
封装与第三方和风天气 API 以及 Supabase 数据库交互的核心工具函数，实现数据解耦。

### 预期产物
* `lib/supabase.ts`
* `lib/qweather.ts`

### Cursor Prompt
> 复制以下内容发送给 Cursor Composer：
```text
@AI_CODING_MANUAL.md @types/weather.ts @lib/utils.ts
请严格按照目录规范实现底层服务封装模块，并在代码中添加清晰的函数与逻辑注释：
1. 创建 `lib/supabase.ts`：
   - 导出普通的 `supabase` 客户端（使用 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，供前端或只读查询使用）。
   - 导出服务端管理员客户端 `supabaseAdmin`（使用 `SUPABASE_SERVICE_ROLE_KEY`，仅在服务端 API 中用于向数据库写入天气日志和预警）。
2. 创建 `lib/qweather.ts`：
   - 封装调用和风天气 API 的函数（使用环境变量中的 `QWEATHER_API_HOST` 和 `QWEATHER_API_KEY`）。
   - 实现 `fetchRealtimeWeather()`：获取杭州实时天气（温度、体感温度、湿度、风向、风速、天气状况文本及图标代码）。
   - 实现 `fetchAirQuality()`：获取杭州实时空气质量（AQI）。
   - 实现 `fetchWeatherAlerts()`：获取杭州当前生效的气象预警信息。
   - 实现 `fetchLifeIndices()`：获取当天生活指数（穿衣、洗车、紫外线）。
   - 要求包含完善的 `try-catch` 错误处理、超时控制（如 5000ms），并将和风天气的原始字段映射为 `types/weather.ts` 中定义的标准类型。
```

---

## 阶段四：后端 API 路由与数据同步逻辑

### 目标
构建 Next.js Route Handlers，实现缓存防刷机制、历史数据归档以及定时任务接口。

### 预期产物
* `app/api/weather/sync/route.ts`
* `app/api/weather/current/route.ts`
* `app/api/weather/history/route.ts`

### Cursor Prompt
> 复制以下内容发送给 Cursor Composer：
```text
@AI_CODING_MANUAL.md @lib/supabase.ts @lib/qweather.ts
请帮我实现以下三个 Next.js App Router 后端接口，每个路由文件顶部需注释接口路径、请求方式和业务逻辑：

1. `app/api/weather/sync/route.ts`（支持 GET 和 POST）：
   - 鉴权逻辑：校验请求头 `Authorization: Bearer ${process.env.CRON_SECRET}`（同时兼容 Vercel Cron 自动携带的请求头）。
   - 调用 `lib/qweather.ts` 获取最新实时天气、AQI 和预警信息。
   - 使用 `supabaseAdmin` 将数据插入到 `weather_logs` 表中；如果有新预警，同步更新 `weather_alerts` 表。
   - 返回 JSON 格式的同步状态与写入的数据摘要。

2. `app/api/weather/current/route.ts`（GET）：
   - 缓存策略：先查询 Supabase `weather_logs` 表中最新的一条记录。如果该记录的 `recorded_at` 距离当前时间在 30 分钟以内，直接返回数据库数据（附带生活指数与预警数据），避免频繁消耗第三方 API 额度。
   - 如果超过 30 分钟或数据库为空，则实时调用和风天气接口获取数据，顺便异步写入 Supabase 归档，然后返回最新数据。

3. `app/api/weather/history/route.ts`（GET）：
   - 支持 URL 查询参数 `range`（如 `24h` 或 `7d`，默认 `24h`）。
   - 从 Supabase `weather_logs` 表按时间正序查询对应时间范围的温度、体感温度、湿度和 AQI 记录，使用 `lib/utils.ts` 将时间戳格式化为北京时间（如 `HH:mm` 或 `MM-DD HH:mm`）后返回给前端图表使用。
```

---

## 阶段五：前端可视化大盘开发

### 目标
构建现代感、响应式的杭州天气监测大盘，展示实时数据、趋势图表与生活指数。

### 预期产物
* `components/WeatherHeader.tsx`
* `components/CurrentWeatherCard.tsx`
* `components/WeatherMetrics.tsx`
* `components/TempTrendChart.tsx`
* `components/LifeStyleTips.tsx`
* `app/page.tsx`

### Cursor Prompt
> 复制以下内容发送给 Cursor Composer：
```text
@AI_CODING_MANUAL.md @types/weather.ts
请帮我开发杭州天气监测平台的前端大盘界面，整体采用现代简约的仪表盘（Dashboard）风格，深色高级蓝灰渐变背景搭配毛玻璃卡片（Glassmorphism），使用 `lucide-react` 图标，每个组件顶部注明组件职责与 Props 说明：

1. `components/WeatherHeader.tsx`：显示“杭州气象监测中心”标题、当前北京时间实时时钟、数据最后更新时间以及带加载动画的手动刷新按钮；如果存在生效的气象预警（Alerts），在顶部展示醒目的警告横幅。
2. `components/CurrentWeatherCard.tsx`：核心主卡片，大号字体展示当前温度、天气状况、体感温度以及今日最高/最低温概览。
3. `components/WeatherMetrics.tsx`：4 列响应式指标网格卡片，展示：相对湿度（%）、风向与风速（km/h）、空气质量 AQI（根据数值显示优/良/污染颜色徽章）、气压或能见度。
4. `components/TempTrendChart.tsx`：使用 `recharts` 的 `ResponsiveContainer` 和 `AreaChart`，绘制气温与体感温度变化双曲线趋势图；右上角提供切换按钮，支持切换“过去 24 小时”和“过去 7 天”数据视图。
5. `components/LifeStyleTips.tsx`：展示穿衣建议、紫外线强度、洗车指数卡片。
6. `app/page.tsx`：组装上述所有组件，处理加载骨架屏（Skeleton）状态和友好的错误重试提示，调用 `/api/weather/current` 和 `/api/weather/history` 渲染完整页面。
```

---

## 阶段六：零运维、低成本可实施部署方案

为了最大化降低服务器采购、运维配置和定时任务管理的成本，本方案采用 **GitHub + Vercel + Supabase** 全托管 Serverless 架构（**全程免费额度即可完美运行，无需购买云服务器，无需配置 Nginx/Docker**）。

### 第一步：让 Cursor 自动生成部署配置文件
在项目上线前，直接复制以下 Prompt 让 Cursor 生成定时任务与构建配置文件，免去手动编写配置的麻烦：

> **Cursor Prompt（生成部署配置）**：
```text
@AI_CODING_MANUAL.md
请帮我为 Vercel 部署做好最后的代码准备：
1. 在项目根目录创建 `vercel.json` 文件，配置 Vercel Cron Jobs：每小时的第 5 分钟自动触发 `/api/weather/sync` 接口（cron 表达式为 `5 * * * *`），实现 24 小时无人值守自动采集杭州天气历史数据。
2. 检查并确保 `package.json` 中的 `build` 脚本无误，在本地运行一次 `npm run build` 检查是否有 TypeScript 类型错误或 ESLint 报错，如有请直接帮我修复。
```

### 第二步：代码托管（1 分钟操作）
1. 在 [GitHub](https://github.com/) 创建一个新的私有或公开仓库（例如 `hangzhou-weather`）。
2. 在 Cursor 终端中执行以下命令推送代码（也可直接在 Cursor 左侧源代码管理面板点击“发布到 GitHub”）：
   ```bash
   git init
   git add .
   git commit -m "feat: 初始化杭州天气监测平台"
   git branch -M main
   git remote add origin https://github.com/你的用户名/hangzhou-weather.git
   git push -u origin main
   ```

### 第三步：Vercel 一键导入与环境变量配置（3 分钟操作）
1. 使用 GitHub 账号登录 [Vercel](https://vercel.com/)，点击首页的 **Add New... -> Project**。
2. 在列表中找到 `hangzhou-weather` 仓库，点击 **Import**。
3. **关键步骤（导入环境变量）**：
   * 展开 **Environment Variables** 面板。
   * 直接打开你本地的 `.env.local` 文件，全选复制所有内容，点击 Vercel 环境变量输入框的第一个 Key 框并**直接粘贴（Ctrl/Cmd + V）**，Vercel 会自动识别并批量拆分成多行键值对，无需逐个手动输入！
4. 点击 **Deploy** 按钮。等待约 1 分钟，屏幕出现礼花动画即表示部署成功，Vercel 会自动分配一个免费的 `https://xxx.vercel.app` 域名并自动配置好 HTTPS 证书。

### 第四步：上线后自动化验证（零成本监控）
部署完成后，无需登录服务器维护，只需做以下两项确认即可彻底“放手”：
1. **验证 Cron 定时任务是否激活**：
   * 进入 Vercel 项目的 **Settings -> Cron Jobs** 面板，确认能看到 `/api/weather/sync` (`5 * * * *`) 已处于 `Active` 状态。你还可以点击右侧的 **Run** 按钮手动测试触发一次。
2. **验证数据库持续入库**：
   * 隔一两个小时后，打开 Supabase 后台的 **Table Editor -> weather_logs**，确认里面已经自动按小时积累了杭州的温度与 AQI 记录，前端大盘的折线图也已自动连成平滑曲线。

> **后续迭代成本**：未来如果你想修改页面颜色或增加新功能（如增加西湖景区专属天气），只需在 Cursor 中让 AI 修改代码并 `git push` 到 GitHub，Vercel 会在 1 分钟内自动完成重新构建与无缝上线。