import { useMemo, type ReactNode } from "react";
import { Activity, Database, Gauge, TrendingUp, type LucideIcon } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildHomeReserveDashboardData,
  formatHomeReserveValue,
  type HomeReserveOverviewRow,
} from "../shared/homeReserveOverview";

type HomeReserveAnalysisDashboardProps = {
  rows: HomeReserveOverviewRow[];
  loading?: boolean;
};

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: number;
  unit: string;
  accent: string;
};

const CHART_COLORS = {
  producing: "#1d4ed8",
  recoverable: "#6d28d9",
  oil: "#b91c1c",
  recovery: "#486581",
  contribution: "#7f1d1d",
};

export function formatChartTooltipValue(value: number, kind: "reserve" | "oil" | "percent") {
  const suffix = kind === "reserve" ? " 万吨" : kind === "oil" ? " 万吨/年" : "%";
  return formatHomeReserveValue(value, suffix);
}

function MetricCard({ icon: Icon, label, value, unit, accent }: MetricCardProps) {
  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm font-medium text-slate-500">{label}</p>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${accent}14`, color: accent }}
          aria-hidden="true"
        >
          <Icon size={18} strokeWidth={1.8} />
        </span>
      </div>
      <p className="mt-5 flex min-w-0 items-baseline gap-2">
        <span className="truncate text-3xl font-semibold tracking-tight text-slate-900">
          {formatHomeReserveValue(value)}
        </span>
        <span className="shrink-0 text-xs font-medium text-slate-400">{unit}</span>
      </p>
    </article>
  );
}

function ChartPanel({ title, description, ariaLabel, children }: {
  title: string;
  description: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <article
      className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:p-6"
      aria-label={ariaLabel}
    >
      <div className="mb-5">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </article>
  );
}

function DashboardHeader() {
  return (
    <header className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-[0.2em] text-teal-700">RESERVE ANALYTICS</p>
        <h2 id="home-reserve-dashboard-title" className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          储量分析看板
        </h2>
        <p className="mt-2 text-sm text-slate-500">区块储量、采收能力与年度产油综合分析</p>
      </div>
      <span className="w-fit shrink-0 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-800">
        数据口径：年度汇总
      </span>
    </header>
  );
}

export function HomeReserveAnalysisDashboard({ rows, loading = false }: HomeReserveAnalysisDashboardProps) {
  const dashboard = useMemo(() => buildHomeReserveDashboardData(rows), [rows]);

  if (loading && rows.length === 0) {
    return (
      <section
        className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-6 lg:p-8"
        aria-labelledby="home-reserve-dashboard-title"
        aria-busy="true"
      >
        <DashboardHeader />
        <p className="mb-4 text-sm font-medium text-slate-600" role="status">正在加载储量分析数据</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white">
              <div className="m-5 h-3 w-20 rounded bg-slate-200" />
              <div className="mx-5 mt-8 h-7 w-28 rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (rows.length === 0) return null;

  const metrics = [
    { label: "动用储量", value: dashboard.total.producingReserve, unit: "万吨", icon: Database, accent: CHART_COLORS.producing },
    { label: "可采储量", value: dashboard.total.recoverableReserve, unit: "万吨", icon: TrendingUp, accent: CHART_COLORS.recoverable },
    { label: "标定采收率", value: dashboard.total.recoveryRate, unit: "%", icon: Gauge, accent: CHART_COLORS.recovery },
    { label: "上年度产油", value: dashboard.total.lastYearOil, unit: "万吨/年", icon: Activity, accent: CHART_COLORS.oil },
  ];

  return (
    <section
      className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-6 lg:p-8"
      aria-labelledby="home-reserve-dashboard-title"
    >
      <DashboardHeader />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="contents">
            <MetricCard {...metric} />
          </div>
        ))}
      </div>

      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]">
        <ChartPanel
          title="区块储量与产油表现"
          description="储量使用左轴，年度产油使用右轴"
          ariaLabel="各区块动用储量、可采储量与上年度产油组合图"
        >
          <div className="min-w-0 overflow-x-auto" role="img" aria-label="六个区块储量及年度产油数据对比">
            <div className="h-[360px] min-w-[720px]">
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 720, height: 360 }}>
                <ComposedChart data={dashboard.blocks} margin={{ top: 8, right: 24, bottom: 42, left: 18 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="block"
                    interval={0}
                    angle={0}
                    textAnchor="middle"
                    height={44}
                    tickMargin={12}
                    tick={{ fill: "#64748b", fontSize: 12, fontFamily: "inherit" }}
                  />
                  <YAxis
                    yAxisId="reserve"
                    width={66}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    label={{ value: "储量（万吨）", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 12 }}
                  />
                  <YAxis
                    yAxisId="oil"
                    orientation="right"
                    width={78}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                    label={{ value: "产油（万吨/年）", angle: 90, position: "insideRight", fill: "#64748b", fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ fill: "#f1f5f9" }}
                    formatter={(value, name) => [
                      formatChartTooltipValue(Number(value), name === "上年度产油" ? "oil" : "reserve"),
                      name,
                    ]}
                    contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 8px 24px rgba(15,23,42,.08)" }}
                  />
                  <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 12 }} />
                  <Bar yAxisId="reserve" dataKey="producingReserve" name="动用储量" fill={CHART_COLORS.producing} radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="reserve" dataKey="recoverableReserve" name="可采储量" fill={CHART_COLORS.recoverable} radius={[4, 4, 0, 0]} />
                  <Line yAxisId="oil" dataKey="lastYearOil" name="上年度产油" stroke={CHART_COLORS.oil} strokeWidth={2.5} dot={{ r: 3, fill: "#ffffff", strokeWidth: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </ChartPanel>

        <ChartPanel
          title="区块动用储量排名"
          description="按动用储量由高到低排列"
          ariaLabel="区块动用储量排名水平条形图"
        >
          <div
            className="h-[300px] min-w-0"
            role="img"
            aria-label="区块动用储量排名及总体贡献占比"
            aria-describedby="home-reserve-ranking-list"
            tabIndex={0}
          >
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 400, height: 300 }}>
              <BarChart data={dashboard.ranking} layout="vertical" margin={{ top: 10, right: 54, bottom: 24, left: 10 }}>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" horizontal={false} />
                <XAxis
                  type="number"
                  height={44}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                  label={{ value: "动用储量（万吨）", position: "insideBottom", fill: "#64748b", fontSize: 12 }}
                />
                <YAxis type="category" dataKey="block" width={84} tick={{ fill: "#475569", fontSize: 12 }} />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: 8 }} />
                <Tooltip
                  cursor={{ fill: "#f1f5f9" }}
                  formatter={(value, _name, item) => [
                    `${formatChartTooltipValue(Number(value), "reserve")} · 占总体 ${formatChartTooltipValue(Number(item.payload?.contributionRate ?? 0), "percent")}`,
                    "动用储量",
                  ]}
                  contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 8px 24px rgba(15,23,42,.08)" }}
                />
                <Bar dataKey="producingReserve" name="动用储量" fill={CHART_COLORS.producing} radius={[0, 5, 5, 0]}>
                  <LabelList
                    dataKey="producingReserve"
                    position="right"
                    formatter={(value) => formatHomeReserveValue(Number(value))}
                    fill="#334155"
                    fontSize={11}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ol
            id="home-reserve-ranking-list"
            className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-xs sm:grid-cols-2"
            aria-label="区块动用储量精确排名"
          >
            {dashboard.ranking.map((row, index) => (
              <li key={`${row.unit}-${row.block}`} className="flex min-w-0 items-center justify-between gap-2 text-slate-600">
                <span className="truncate"><b className="mr-1 text-slate-400">{index + 1}</b>{row.block}</span>
                <span className="flex shrink-0 items-center gap-2 font-medium text-slate-800">
                  <span>{formatHomeReserveValue(row.producingReserve, " 万吨")}</span>
                  <span>{formatHomeReserveValue(row.contributionRate, "%")}</span>
                </span>
              </li>
            ))}
          </ol>
        </ChartPanel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2" aria-label="采一与采二单位储量对比">
        {dashboard.units.map((unit) => (
          <article key={unit.unit} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.05)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-900">{unit.unit}</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                总体贡献 {formatHomeReserveValue(unit.contributionRate, "%")}
              </span>
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-3">
              <div><dt className="text-xs text-slate-500">动用储量</dt><dd className="mt-1 truncate text-base font-semibold text-slate-900">{formatHomeReserveValue(unit.producingReserve)} <small className="font-normal text-slate-400">万吨</small></dd></div>
              <div><dt className="text-xs text-slate-500">可采储量</dt><dd className="mt-1 truncate text-base font-semibold text-slate-900">{formatHomeReserveValue(unit.recoverableReserve)} <small className="font-normal text-slate-400">万吨</small></dd></div>
              <div><dt className="text-xs text-slate-500">采收率</dt><dd className="mt-1 truncate text-base font-semibold text-slate-900">{formatHomeReserveValue(unit.recoveryRate, "%")}</dd></div>
            </dl>
            <div className="mt-5" aria-label={`${unit.unit}总体贡献率 ${formatHomeReserveValue(unit.contributionRate, "%")}`}>
              <div className="mb-2 flex justify-between text-xs text-slate-500"><span>总体贡献</span><span>{formatHomeReserveValue(unit.contributionRate, "%")}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: CHART_COLORS.contribution,
                    width: `${Math.min(100, Math.max(0, unit.contributionRate))}%`,
                  }}
                />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
