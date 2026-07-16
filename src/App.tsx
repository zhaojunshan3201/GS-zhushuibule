import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios, { AxiosHeaders } from "axios";
import * as XLSX from "xlsx";
import {
  Activity,
  ChartNoAxesCombined,
  Download,
  Droplet,
  Droplets,
  FileText,
  FlaskConical,
  History,
  Home,
  LogOut,
  Maximize2,
  Minus,
  Plus,
  Save,
  Search,
  Settings,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  Type,
  Upload,
  UsersRound,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorkerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import {
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "./lib/utils";
import { PptxWellHistoryEditor } from "./components/PptxWellHistoryEditor";
import { WellHistoryRichTextEditor } from "./components/WellHistoryRichTextEditor";
import {
  DYNAMIC_ADJUSTMENT_PURPOSES,
  calculateDynamicAdjustmentDiffs,
  createEmptyDynamicAdjustmentForm,
  type DynamicAdjustmentForm,
} from "./shared/dynamicAdjustment";
import {
  createEmptyAbnormalWellForm,
  createEmptyWellFlushingForm,
  type AbnormalWellForm,
  type WellFlushingForm,
} from "./shared/coreTableRecords";
import {
  createEmptyConcentricTestForm,
  createEmptySingleWellInjectionEvaluationForm,
  createEmptySingleWellSealEvaluationForm,
  createEmptySmartTestForm,
  getDynamicAnalysisDeleteMessage,
  getDynamicAnalysisEmptyQueryMessage,
  type ConcentricTestForm,
  type SingleWellInjectionEvaluationForm,
  type SingleWellSealEvaluationForm,
  type SmartTestForm,
} from "./shared/secondBatchRecords";
import { OIL_PRODUCTION_BLOCK_UNIT_MAP, getOilProductionBlocks, normalizeOilProductionBlock } from "./shared/oilProductionBlocks";
import { getBrowserTheme, getStoredTheme, persistBrowserTheme, THEME_OPTIONS, type ThemeKey } from "./shared/theme";
import {
  createWellHistoryImportBatches,
  normalizeWellHistoryWellNo,
  parseWellHistoryImportFileName,
  selectLatestWellHistoryImports,
  WELL_HISTORY_BATCH_MAX_BYTES,
  WELL_HISTORY_BATCH_MAX_FILES,
} from "./shared/wellHistoryImport";


GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type PageType =
  | "home"
  | "dynamic-analysis"
  | "well-history"
  | "water-cut"
  | "injection-tech"
  | "zonal-injection"
  | "concentric-test-history"
  | "smart-test-history"
  | "single-well-injection-evaluation"
  | "single-well-seal-evaluation"
  | "zonal-indicator-summary"
  | "well-flushing"
  | "abnormal-wells"
  | "dynamic-adjustment"
  | "indicator-curve"
  | "key-matters"
  | "user-management"
  | "settings"
  | "audit-log";

type WellHistoryPdfRecord = {
  id?: string;
  wellNo: string;
  unit?: string | null;
  block?: string | null;
  originalName?: string | null;
  fileUrl: string;
  updatedAt?: string | null;
};

type WellHistoryPptxRecord = {
  id?: string;
  fileUrl?: string | null;
  originalName?: string | null;
  versionNo?: number | null;
  editorModelJson?: Record<string, unknown> | null;
};
type WellHistoryRichTextDocument = { html: string; versionNo: number };

type WellHistoryArchiveSummary = {
  id?: string;
  wellNo: string;
  displayName?: string;
  unit?: string | null;
  block?: string | null;
  updatedAt?: string | null;
  currentPdf?: WellHistoryPdfRecord | null;
  currentPptx?: WellHistoryPptxRecord | null;
};

type WellHistoryArchiveDetail = WellHistoryArchiveSummary & {
  currentPdf?: WellHistoryPdfRecord | null;
  currentPptx?: WellHistoryPptxRecord | null;
  extract?: Record<string, unknown> | null;
};

type WellHistoryBatchImportItem = {
  fileName: string;
  wellNo: string;
  status: string;
  message?: string;
  pdfUrl?: string;
  updatedAt?: string | null;
};

type DynamicAdjustmentRecord = {
  id: string;
  adjustmentWaterWell: string;
  injectionProcess?: string | null;
  adjustmentDate: string;
  beforeDailyInjection?: number | null;
  afterDailyInjection?: number | null;
  adjustmentPurpose: string;
  trackedOilWell: string;
  beforeDailyLiquid?: number | null;
  beforeDailyOil?: number | null;
  beforeWaterCut?: number | null;
  afterDailyLiquid?: number | null;
  afterDailyOil?: number | null;
  afterWaterCut?: number | null;
  diffDailyLiquid?: number | null;
  diffDailyOil?: number | null;
  diffWaterCut?: number | null;
  stageDays?: number | null;
  cumulativeOil?: number | null;
  remark?: string | null;
};

type PaginatedApiResponse<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
};

type WaterCutRecord = {
  id: string;
  unit: string;
  block: string;
  wellNo: string;
  sampleDate: string;
  waterCut: number;
  tester: string;
  remark?: string | null;
};

type WaterCutOpinion = {
  time: string;
  content: string;
  author: string;
};

type InjectionTechRecord = {
  id: string;
  wellNo: string;
  block: string;
  workArea: string;
  process: string;
  packerCount: number;
  packerModels: unknown;
  bottomStructure: string;
  washable: string;
  doublePacker: string;
  washReminder?: string | null;
  lastWorkDate: string;
  runningDate: string;
};

type WellFlushingRecord = {
  id: string;
  unit: string;
  block?: string | null;
  wellNo: string;
  washDate: string;
  daysSinceLastWash: number;
  method: string;
  equipmentPressure?: number | null;
  duration?: number | null;
  totalWater?: number | null;
  firstLevel: string[];
  secondLevel: string[];
  suspendedMatter: string[];
  remark?: string | null;
};

type AbnormalWellRecord = {
  id: string;
  category: string;
  wellNo: string;
  block: string;
  unit: string;
  process: string;
  normalDaily?: string | null;
  normalOilPressure?: string | null;
  normalCasingPressure?: string | null;
  normalLayerPressure?: string | null;
  abnormalDaily?: string | null;
  abnormalOilPressure?: string | null;
  abnormalCasingPressure?: string | null;
  abnormalLayerPressure?: string | null;
  suggestion?: string | null;
};

type ConcentricTestRecord = {
  id: string;
  unit: string;
  block: string;
  wellNo: string;
  testDate: string;
  allocatorCount: number;
  freedom?: string | null;
  partialStroke?: string | null;
  fullyStuck?: string | null;
  layerFreedom: string[];
  dailyInjection: string[];
  remark?: string | null;
};

type SmartTestRecord = {
  id: string;
  unit: string;
  block: string;
  wellNo: string;
  testDate: string;
  allocatorCount: number;
  dailyAllocation: string[];
  dailyInjection: string[];
  allocationDiff: string[];
  nozzleOpening: string[];
  wellheadPressure: string;
  innerPressure: string[];
  outerPressure: string[];
  remark?: string | null;
};

type SingleWellInjectionEvaluationRecord = {
  id: string;
  unit: string;
  block: string;
  wellNo: string;
  process: string;
  evaluationDate: string;
  intervalCount: number;
  actualCount: number;
  qualifiedCount: number;
  unqualified: string[];
  remark?: string | null;
};

type SingleWellSealEvaluationRecord = {
  id: string;
  unit: string;
  block: string;
  wellNo: string;
  process: string;
  evaluationDate: string;
  intervalCount: number;
  actualCount: number;
  needSealCount: number;
  qualifiedSealCount: number;
  sealStats: string[];
};

type ZonalIndicatorSummaryRecord = {
  id: string;
  category: string;
  process: string;
  wellCount: number;
  processRate: string;
  intervalCount: number;
  actualCount: number;
  level: string;
  segmentSeal: string[];
  fullSeal: string[];
  allocation: string[];
  sortOrder: number;
};

type IndicatorCurveRecord = {
  id: string;
  unit: string;
  block: string;
  wellNo: string;
  testDate: string;
  testInterval: string;
  injection1: number;
  pressure1: number;
  injection2: number;
  pressure2: number;
  injection3: number;
  pressure3: number;
  injection4: number;
  pressure4: number;
  injection5: number;
  pressure5: number;
};

type IndicatorCurveFilters = {
  wellNo: string;
  testDate: string;
  testInterval: string;
};

type IndicatorCurveForm = {
  unit: string;
  block: string;
  wellNo: string;
  testDate: string;
  testInterval: string;
  injection1: string;
  pressure1: string;
  injection2: string;
  pressure2: string;
  injection3: string;
  pressure3: string;
  injection4: string;
  pressure4: string;
  injection5: string;
  pressure5: string;
};

type DynamicAnalysisRecord = {
  id: string;
  kind: "overall-oil" | "overall-water" | "single-oil" | "single-water";
  unit: string;
  block: string;
  wellNo?: string | null;
  endValues: string[];
  averageValues: string[];
  lastYearValues: string[];
  diffMonth: string[];
  diffYear: string[];
  advice: string[];
  status?: string | null;
  process?: string | null;
};

type HomeReserveOverviewRow = {
  id?: string;
  unit: "采一" | "采二" | "合计";
  block: string;
  oilArea: number;
  producingReserve: number;
  recoverableReserve: number;
  recoveryRate: number;
  lastYearOil: number;
  rowType: "block" | "subtotal" | "total";
};

const NAV_ITEMS: Array<{ id: PageType; label: string; icon: LucideIcon }> = [
  { id: "home", label: "主页", icon: Home },
  { id: "dynamic-analysis", label: "动态分析", icon: Activity },
  { id: "well-history", label: "单井井史", icon: History },
  { id: "water-cut", label: "含水化验", icon: FlaskConical },
  { id: "injection-tech", label: "注水工艺", icon: Wrench },
  { id: "zonal-injection", label: "分注管理", icon: Workflow },
  { id: "well-flushing", label: "水井洗井", icon: Droplets },
  { id: "abnormal-wells", label: "异常水井", icon: TriangleAlert },
  { id: "dynamic-adjustment", label: "动态调配", icon: SlidersHorizontal },
  { id: "indicator-curve", label: "指示曲线", icon: ChartNoAxesCombined },
  { id: "user-management", label: "用户管理", icon: UsersRound },
  { id: "settings", label: "系统设置", icon: Settings },
];

const ZONAL_INJECTION_SUB_ITEMS: Array<{ id: PageType; label: string }> = [
  { id: "zonal-indicator-summary", label: "分注指标汇总" },
  { id: "concentric-test-history", label: "同心测调井史" },
  { id: "smart-test-history", label: "智能测调井史" },
  { id: "single-well-injection-evaluation", label: "单井注入评价" },
  { id: "single-well-seal-evaluation", label: "单井密封评价" },
];

const isZonalInjectionPage = (page: PageType) =>
  page === "zonal-injection" || ZONAL_INJECTION_SUB_ITEMS.some((item) => item.id === page);

const UNIT_OPTIONS = [
  "高采采油作业一区",
  "高采采油作业二区",
  "高采采油作业三区",
  "地质研究所",
  "工艺研究所",
  "采油管理部",
  "厂领导",
];

const FILTER_UNIT_OPTIONS = ["高采采油作业一区", "高采采油作业二区", "高采采油作业三区"];
const getFilterBlockOptions = (unit: string) => getOilProductionBlocks(unit || undefined);
const MANAGEMENT_UNIT = "采油管理部";
const MANAGEMENT_PAGES: PageType[] = ["user-management"];

function decodeBase64ToUint8Array(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function formatTime(value?: string | null) {
  return value ? String(value).slice(0, 19).replace("T", " ") : "--";
}

function PageShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <div className="border border-shell-border bg-white px-6 py-5 shadow-sm">
        <h1 className="text-2xl font-black text-gray-900">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function StyledConfirmDialog({
  message,
  onConfirm,
  onCancel,
  confirmText = "确定",
  cancelText = "取消",
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded border border-[#8fb7df] bg-white shadow-xl">
        <div className="border-b border-[#9fc4e8] bg-[#eaf4ff] px-4 py-2 text-center text-base font-bold text-[#cc0000]">
          提示
        </div>
        <div className="px-6 py-8 text-center text-sm font-bold text-slate-800">{message}</div>
        <div className="flex justify-center gap-3 border-t border-[#d6e8f8] bg-[#f7fbff] px-4 py-3">
          <button
            type="button"
            onClick={onConfirm}
            className="h-7 min-w-20 rounded border border-[#2f80ed] bg-[#2f80ed] px-5 text-xs font-bold text-white shadow-sm hover:bg-[#1f6ed4]"
          >
            {confirmText}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="h-7 min-w-20 rounded border border-[#9eb8d4] bg-white px-5 text-xs font-bold text-slate-800 shadow-sm hover:bg-[#eaf4ff]"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}

function useStyledConfirmDialog() {
  const [pendingConfirm, setPendingConfirm] = useState<{
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const requestConfirm = (message: string, onConfirm: () => void | Promise<void>) => {
    setPendingConfirm({ message, onConfirm });
  };

  const confirmDialog = pendingConfirm ? (
    <StyledConfirmDialog
      message={pendingConfirm.message}
      onConfirm={() => {
        const action = pendingConfirm.onConfirm;
        setPendingConfirm(null);
        void action();
      }}
      onCancel={() => setPendingConfirm(null)}
    />
  ) : null;

  return { confirmDialog, requestConfirm };
}

function HomePage() {
  const [rows, setRows] = useState<HomeReserveOverviewRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    axios.get<{ rows: HomeReserveOverviewRow[] }>("/api/home-reserve-overview")
      .then(({ data }) => {
        if (active) {
          setRows(data.rows);
          setError("");
        }
      })
      .catch((err) => {
        if (active) setError(err?.response?.data?.error || "主页储量概览加载失败");
      });
    return () => {
      active = false;
    };
  }, []);

  const formatValue = (value: number, suffix = "") => {
    if (!Number.isFinite(value)) return "";
    return `${Number.isInteger(value) ? value : value.toFixed(2).replace(/\.?0+$/, "")}${suffix}`;
  };
  const tableBorder = "border border-[#8ebdff]";
  const headCellClass = `${tableBorder} bg-[#dceefc] px-2 py-2 text-center text-[13px] font-bold leading-tight text-[#001a33]`;
  const bodyCellClass = `${tableBorder} bg-white px-2 py-2 text-center text-[13px] leading-tight text-black`;

  return (
    <div className="home-reserve-overview border border-[#8ebdff] bg-white">
      <h1 className="border-b border-[#8ebdff] bg-[#f8fbff] py-1 text-center text-[22px] font-bold leading-tight text-[#d40000]">
        储量概览列表
      </h1>
      <div className="overflow-x-auto bg-white">
        <table className="w-full min-w-[980px] table-fixed border-collapse text-center">
          <colgroup>
            <col className="w-[90px]" />
            <col className="w-[150px]" />
            <col className="w-[120px]" />
            <col className="w-[120px]" />
            <col className="w-[120px]" />
            <col className="w-[135px]" />
            <col className="w-[135px]" />
          </colgroup>
          <thead>
            <tr>
              {["单位", "区块", "含油面积", "动用储量", "可采储量", "标定采收率", "上年度产油"].map((header) => (
                <th key={header} className={headCellClass}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className={`${bodyCellClass} py-5 text-gray-500`}>
                  {error || "正在加载..."}
                </td>
              </tr>
            ) : rows.map((row, index) => {
              const showUnit = index === 0 || row.unit === "合计" || rows[index - 1]?.unit !== row.unit;
              const unitRowSpan = row.unit === "采一" || row.unit === "采二" ? 4 : 1;
              return (
                <tr key={`${row.unit}-${row.block || "total"}`} className={row.rowType === "subtotal" || row.rowType === "total" ? "font-normal" : ""}>
                  {showUnit && (
                    <td rowSpan={unitRowSpan} className={`${bodyCellClass} align-middle`}>
                      {row.unit}
                    </td>
                  )}
                  {row.rowType === "total" ? (
                    <td className={bodyCellClass} />
                  ) : (
                    <td className={bodyCellClass}>{row.block}</td>
                  )}
                  <td className={bodyCellClass}>{formatValue(row.oilArea)}</td>
                  <td className={bodyCellClass}>{formatValue(row.producingReserve)}</td>
                  <td className={bodyCellClass}>{formatValue(row.recoverableReserve)}</td>
                  <td className={bodyCellClass}>{formatValue(row.recoveryRate, "%")}</td>
                  <td className={bodyCellClass}>{formatValue(row.lastYearOil)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {error && rows.length > 0 && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <PageShell title={title} subtitle="该页面当前保留稳定占位，后续可逐步恢复详细业务功能。">
      <div className="border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        页面可访问，核心运行链路保持稳定。
      </div>
    </PageShell>
  );
}


type UserRecord = {
  id: string;
  name: string;
  empId: string;
  email?: string | null;
  password?: string | null;
  role: string;
  unit: string;
  status: string;
  phone?: string | null;
  gender?: string | null;
};

type UserFormState = {
  name: string;
  empId: string;
  email: string;
  password: string;
  role: string;
  unit: string;
  status: string;
  phone: string;
  gender: string;
};

const USER_TEXT = {
  "male": "男",
  "female": "女",
  "loadFailed": "用户列表加载失败",
  "required": "请填写工号、姓名和单位",
  "updated": "用户信息已更新",
  "created": "用户已新增",
  "updateFailed": "用户更新失败",
  "createFailed": "用户新增失败",
  "deleteConfirmPrefix": "确定删除用户 ",
  "deleteConfirmSuffix": " 吗？",
  "deleted": "用户已删除",
  "deleteFailed": "用户删除失败",
  "title": "用户管理",
  "subtitle": "维护系统登录用户、角色、单位和账号状态。",
  "keyword": "关键字",
  "keywordPlaceholder": "工号/姓名/单位",
  "role": "角色",
  "status": "状态",
  "all": "全部",
  "active": "启用",
  "inactive": "停用",
  "query": "查询",
  "new": "新增",
  "empId": "工号",
  "name": "姓名",
  "password": "密码",
  "unit": "单位",
  "phone": "电话",
  "gender": "性别",
  "email": "邮箱",
  "save": "保存",
  "cancel": "取消",
  "empty": "暂无用户数据",
  "edit": "编辑",
  "delete": "删除",
  "headers": [
    "序号",
    "工号",
    "姓名",
    "角色",
    "单位",
    "电话",
    "性别",
    "状态",
    "邮箱",
    "操作"
  ]
} as const;

const createEmptyUserForm = (): UserFormState => ({
  name: "",
  empId: "",
  email: "",
  password: "123456",
  role: "OPERATOR",
  unit: UNIT_OPTIONS[0] ?? "",
  status: "Active",
  phone: "",
  gender: USER_TEXT.male,
});

function UserManagementPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [keyword, setKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState<UserFormState>(() => createEmptyUserForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get<UserRecord[]>("/api/users");
      setUsers(data || []);
    } catch (err) {
      setError(USER_TEXT.loadFailed);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(); }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    return users.filter((user) => {
      const matchesKeyword = !normalized || [user.empId, user.name, user.unit, user.phone].some((value) => String(value || "").toLowerCase().includes(normalized));
      return matchesKeyword && (!roleFilter || user.role === roleFilter) && (!statusFilter || user.status === statusFilter);
    });
  }, [keyword, roleFilter, statusFilter, users]);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(createEmptyUserForm());
    setShowForm(true);
    setMessage("");
    setError("");
  };

  const openEditForm = (user: UserRecord) => {
    setEditingId(user.id);
    setForm({
      name: user.name || "",
      empId: user.empId || "",
      email: user.email || "",
      password: user.password || "",
      role: user.role || "OPERATOR",
      unit: user.unit || UNIT_OPTIONS[0] || "",
      status: user.status || "Active",
      phone: user.phone || "",
      gender: user.gender || USER_TEXT.male,
    });
    setShowForm(true);
    setMessage("");
    setError("");
  };

  const saveUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.empId.trim() || !form.name.trim() || !form.unit.trim()) {
      setError(USER_TEXT.required);
      return;
    }
    const payload = { ...form, empId: form.empId.trim(), name: form.name.trim(), email: form.email.trim() || null, phone: form.phone.trim() || null, password: form.password.trim() || "123456" };
    try {
      if (editingId) {
        await axios.patch(`/api/users/${editingId}`, payload);
        setMessage(USER_TEXT.updated);
      } else {
        await axios.post("/api/users/register", payload);
        setMessage(USER_TEXT.created);
      }
      setShowForm(false);
      await loadUsers();
    } catch (err) {
      setError(editingId ? USER_TEXT.updateFailed : USER_TEXT.createFailed);
    }
  };

  const deleteUser = async (user: UserRecord) => {
    if (!window.confirm(`${USER_TEXT.deleteConfirmPrefix}${user.name || user.empId}${USER_TEXT.deleteConfirmSuffix}`)) return;
    try {
      await axios.delete(`/api/users/${user.id}`);
      setMessage(USER_TEXT.deleted);
      await loadUsers();
    } catch (err) {
      setError(USER_TEXT.deleteFailed);
    }
  };

  return (
    <PageShell title={USER_TEXT.title} subtitle={USER_TEXT.subtitle}>
      <div className="border border-[#8fb7df] bg-[#f7fbff] p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-1">{USER_TEXT.keyword}<input value={keyword} onChange={(event) => setKeyword(event.target.value)} className="h-7 w-40 border border-[#9fc4e8] bg-white px-2" placeholder={USER_TEXT.keywordPlaceholder} /></label>
          <label className="flex items-center gap-1">{USER_TEXT.role}<select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className="h-7 w-28 border border-[#9fc4e8] bg-white px-2"><option value="">{USER_TEXT.all}</option><option value="ADMIN">ADMIN</option><option value="ANALYST">ANALYST</option><option value="OPERATOR">OPERATOR</option></select></label>
          <label className="flex items-center gap-1">{USER_TEXT.status}<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-7 w-28 border border-[#9fc4e8] bg-white px-2"><option value="">{USER_TEXT.all}</option><option value="Active">{USER_TEXT.active}</option><option value="Inactive">{USER_TEXT.inactive}</option></select></label>
          <button type="button" onClick={() => void loadUsers()} className="inline-flex h-7 items-center gap-1 rounded border border-[#8fb7df] bg-white px-3 text-xs font-bold text-slate-800 hover:bg-[#eaf4ff]"><Search className="h-3.5 w-3.5" />{USER_TEXT.query}</button>
          <button type="button" onClick={openCreateForm} className="inline-flex h-7 items-center gap-1 rounded border border-[#2f80ed] bg-[#2f80ed] px-3 text-xs font-bold text-white hover:bg-[#1f6ed4]"><Plus className="h-3.5 w-3.5" />{USER_TEXT.new}</button>
        </div>
        {message && <p className="mt-2 text-xs font-bold text-emerald-600">{message}</p>}
        {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
      </div>
      {showForm && (
        <form onSubmit={saveUser} className="border border-[#8fb7df] bg-white p-4 shadow-sm">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["empId", USER_TEXT.empId], ["name", USER_TEXT.name], ["password", USER_TEXT.password], ["phone", USER_TEXT.phone], ["email", USER_TEXT.email],
            ].map(([key, label]) => <label key={key} className="text-xs font-bold text-slate-700">{label}<input value={form[key as keyof UserFormState]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 h-8 w-full border border-[#9fc4e8] px-2 font-normal" /></label>)}
            <label className="text-xs font-bold text-slate-700">{USER_TEXT.role}<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="mt-1 h-8 w-full border border-[#9fc4e8] px-2 font-normal"><option value="ADMIN">ADMIN</option><option value="ANALYST">ANALYST</option><option value="OPERATOR">OPERATOR</option></select></label>
            <label className="text-xs font-bold text-slate-700">{USER_TEXT.unit}<select value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} className="mt-1 h-8 w-full border border-[#9fc4e8] px-2 font-normal">{UNIT_OPTIONS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label>
            <label className="text-xs font-bold text-slate-700">{USER_TEXT.status}<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="mt-1 h-8 w-full border border-[#9fc4e8] px-2 font-normal"><option value="Active">{USER_TEXT.active}</option><option value="Inactive">{USER_TEXT.inactive}</option></select></label>
            <label className="text-xs font-bold text-slate-700">{USER_TEXT.gender}<select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })} className="mt-1 h-8 w-full border border-[#9fc4e8] px-2 font-normal"><option value={USER_TEXT.male}>{USER_TEXT.male}</option><option value={USER_TEXT.female}>{USER_TEXT.female}</option></select></label>
          </div>
          <div className="mt-4 flex gap-2"><button type="submit" className="inline-flex h-8 items-center gap-1 rounded border border-[#2f80ed] bg-[#2f80ed] px-4 text-xs font-bold text-white"><Save className="h-3.5 w-3.5" />{USER_TEXT.save}</button><button type="button" onClick={() => setShowForm(false)} className="h-8 rounded border border-[#9eb8d4] bg-white px-4 text-xs font-bold text-slate-800">{USER_TEXT.cancel}</button></div>
        </form>
      )}
      <div className="overflow-x-auto border border-[#8fb7df] bg-white shadow-sm">
        <table className="w-full min-w-[980px] border-collapse text-center text-sm">
          <thead className="bg-[#dcebf8] text-slate-900"><tr>{USER_TEXT.headers.map((title) => <th key={title} className="border border-[#9fc4e8] px-2 py-2">{title}</th>)}</tr></thead>
          <tbody>
            {filteredUsers.map((user, index) => (
              <tr key={user.id} className="hover:bg-[#f7fbff]"><td className="border border-[#9fc4e8] px-2 py-2">{index + 1}</td><td className="border border-[#9fc4e8] px-2 py-2 font-bold">{user.empId}</td><td className="border border-[#9fc4e8] px-2 py-2">{user.name}</td><td className="border border-[#9fc4e8] px-2 py-2">{user.role}</td><td className="border border-[#9fc4e8] px-2 py-2">{user.unit}</td><td className="border border-[#9fc4e8] px-2 py-2">{user.phone || "-"}</td><td className="border border-[#9fc4e8] px-2 py-2">{user.gender || "-"}</td><td className="border border-[#9fc4e8] px-2 py-2">{user.status === "Active" ? USER_TEXT.active : USER_TEXT.inactive}</td><td className="border border-[#9fc4e8] px-2 py-2">{user.email || "-"}</td><td className="border border-[#9fc4e8] px-2 py-2"><button type="button" onClick={() => openEditForm(user)} className="mr-3 font-bold text-[#0057b8]">{USER_TEXT.edit}</button><button type="button" onClick={() => void deleteUser(user)} className="font-bold text-red-600">{USER_TEXT.delete}</button></td></tr>
            ))}
            {!loading && filteredUsers.length === 0 && <tr><td colSpan={10} className="border border-[#9fc4e8] px-2 py-8 text-slate-500">{USER_TEXT.empty}</td></tr>}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}


const SETTINGS_TEXT = {
  loadFailed: "\u7cfb\u7edf\u8bbe\u7f6e\u52a0\u8f7d\u5931\u8d25",
  configSaved: "\u7cfb\u7edf\u914d\u7f6e\u5df2\u4fdd\u5b58",
  configSaveFailed: "\u7cfb\u7edf\u914d\u7f6e\u4fdd\u5b58\u5931\u8d25",
  responsibilitySaved: "\u5355\u4f4d\u804c\u8d23\u5df2\u4fdd\u5b58",
  responsibilitySaveFailed: "\u5355\u4f4d\u804c\u8d23\u4fdd\u5b58\u5931\u8d25",
  reserveSaved: "\u50a8\u91cf\u6982\u89c8\u6570\u636e\u5df2\u4fdd\u5b58",
  reserveDeleted: "\u50a8\u91cf\u6982\u89c8\u6570\u636e\u5df2\u5220\u9664",
  reserveSaveFailed: "\u50a8\u91cf\u6982\u89c8\u6570\u636e\u4fdd\u5b58\u5931\u8d25",
  reserveDeleteFailed: "\u50a8\u91cf\u6982\u89c8\u6570\u636e\u5220\u9664\u5931\u8d25",
  title: "\u7cfb\u7edf\u8bbe\u7f6e",
  subtitle: "\u7ef4\u62a4\u7cfb\u7edf\u57fa\u7840\u914d\u7f6e\u3001\u5355\u4f4d\u804c\u8d23\u548c\u4e3b\u9875\u50a8\u91cf\u6982\u89c8\u6570\u636e\u3002",
  baseConfig: "\u57fa\u7840\u914d\u7f6e",
  saveBase: "\u4fdd\u5b58\u57fa\u7840\u914d\u7f6e",
  unitResponsibility: "\u5355\u4f4d\u804c\u8d23\u914d\u7f6e",
  unit: "\u5355\u4f4d",
  responsibility: "\u804c\u8d23\u8bf4\u660e",
  placeholder: "\u586b\u5199\u8be5\u5355\u4f4d\u5728\u7cfb\u7edf\u4e2d\u7684\u804c\u8d23\u8bf4\u660e",
  saveResponsibility: "\u4fdd\u5b58\u5355\u4f4d\u804c\u8d23",
  reserveTitle: "\u4e3b\u9875\u50a8\u91cf\u6982\u89c8\u6570\u636e\u7ef4\u62a4",
  addReserve: "\u65b0\u589e\u8bb0\u5f55",
  updateReserve: "\u4fdd\u5b58\u8bb0\u5f55",
  cancel: "\u53d6\u6d88",
  edit: "\u7f16\u8f91",
  delete: "\u5220\u9664",
  deleteConfirm: "\u786e\u5b9a\u5220\u9664\u8be5\u50a8\u91cf\u6982\u89c8\u8bb0\u5f55\u5417\uff1f",
} as const;

const SYSTEM_CONFIG_ITEMS = [
  { key: "systemName", label: "\u7cfb\u7edf\u540d\u79f0", type: "input" },
  { key: "loginBg", label: "\u767b\u5f55\u80cc\u666f\u56fe", type: "input" },
  { key: "loginLogo", label: "\u767b\u5f55Logo", type: "input" },
  { key: "dynamicOilSingleMonthLiquidDiffMin", label: "对比上月 日产液差值>=", type: "input" },
  { key: "dynamicOilSingleMonthOilDiffMin", label: "对比上月 日产油差值>=", type: "input" },
  { key: "dynamicOilSingleMonthWaterDiffMin", label: "对比上月 含水差值>=", type: "input" },
  { key: "dynamicOilSingleYearLiquidDiffMin", label: "对比上年12月份 日产液差值>=", type: "input" },
  { key: "dynamicOilSingleYearOilDiffMin", label: "对比上年12月份 日产油差值>=", type: "input" },
  { key: "dynamicOilSingleYearWaterDiffMin", label: "对比上年12月份 含水差值>=", type: "input" },
  { key: "dynamicWaterSingleMonthInjectionDiffMin", label: "水井对比上月 日注水差值>=", type: "input" },
  { key: "dynamicWaterSingleYearInjectionDiffMin", label: "水井对比上年12月份 日注水差值>=", type: "input" },
] as const;

type HomeReserveOverviewAdminRecord = {
  id: string;
  unit: string;
  block: string;
  oilArea: number;
  producingReserve: number;
  recoverableReserve: number;
  recoveryRate: number;
  lastYearOil: number;
  sortOrder: number;
};

type HomeReserveOverviewAdminForm = {
  unit: string;
  block: string;
  oilArea: string;
  producingReserve: string;
  recoverableReserve: string;
  recoveryRate: string;
  lastYearOil: string;
  sortOrder: string;
};

const createEmptyHomeReserveForm = (): HomeReserveOverviewAdminForm => ({
  unit: "\u91c7\u4e00",
  block: "",
  oilArea: "0",
  producingReserve: "0",
  recoverableReserve: "0",
  recoveryRate: "0",
  lastYearOil: "0",
  sortOrder: "0",
});

const toHomeReserveForm = (record: HomeReserveOverviewAdminRecord): HomeReserveOverviewAdminForm => ({
  unit: record.unit,
  block: record.block,
  oilArea: String(record.oilArea ?? 0),
  producingReserve: String(record.producingReserve ?? 0),
  recoverableReserve: String(record.recoverableReserve ?? 0),
  recoveryRate: String(record.recoveryRate ?? 0),
  lastYearOil: String(record.lastYearOil ?? 0),
  sortOrder: String(record.sortOrder ?? 0),
});

function SystemSettingsPage() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [responsibilities, setResponsibilities] = useState<Record<string, string>>({});
  const [reserveRecords, setReserveRecords] = useState<HomeReserveOverviewAdminRecord[]>([]);
  const [reserveForm, setReserveForm] = useState<HomeReserveOverviewAdminForm>(() => createEmptyHomeReserveForm());
  const [editingReserveId, setEditingReserveId] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState(UNIT_OPTIONS[0] ?? "");
  const [responsibilityText, setResponsibilityText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    setError("");
    try {
      const [configResponse, responsibilityResponse, reserveResponse] = await Promise.all([
        axios.get<Record<string, string>>("/api/config"),
        axios.get<Record<string, string>>("/api/responsibilities"),
        axios.get<HomeReserveOverviewAdminRecord[]>("/api/home-reserve-overview-records"),
      ]);
      setConfig(configResponse.data || {});
      setResponsibilities(responsibilityResponse.data || {});
      setReserveRecords(Array.isArray(reserveResponse.data) ? reserveResponse.data : []);
      const nextUnit = selectedUnit || UNIT_OPTIONS[0] || "";
      setResponsibilityText((responsibilityResponse.data || {})[nextUnit] || "");
    } catch (err) {
      setError(SETTINGS_TEXT.loadFailed);
    }
  }, [selectedUnit]);

  useEffect(() => { void loadSettings(); }, [loadSettings]);

  const updateSelectedUnit = (unit: string) => {
    setSelectedUnit(unit);
    setResponsibilityText(responsibilities[unit] || "");
  };

  const saveConfig = async () => {
    setError("");
    try {
      await Promise.all(SYSTEM_CONFIG_ITEMS.map((item) => axios.post("/api/config", { key: item.key, value: config[item.key] || "" })));
      setMessage(SETTINGS_TEXT.configSaved);
      await loadSettings();
    } catch (err) {
      setError(SETTINGS_TEXT.configSaveFailed);
    }
  };

  const saveResponsibility = async () => {
    if (!selectedUnit) return;
    setError("");
    try {
      await axios.post("/api/responsibilities", { unit: selectedUnit, responsibility: responsibilityText });
      setResponsibilities((current) => ({ ...current, [selectedUnit]: responsibilityText }));
      setMessage(SETTINGS_TEXT.responsibilitySaved);
    } catch (err) {
      setError(SETTINGS_TEXT.responsibilitySaveFailed);
    }
  };

  const saveReserveRecord = async () => {
    if (!reserveForm.unit.trim() || !reserveForm.block.trim()) {
      setError("\u8bf7\u586b\u5199\u5355\u4f4d\u548c\u533a\u5757");
      return;
    }
    setError("");
    try {
      if (editingReserveId) {
        await axios.put(`/api/home-reserve-overview-records/${editingReserveId}`, reserveForm);
      } else {
        await axios.post("/api/home-reserve-overview-records", reserveForm);
      }
      setReserveForm(createEmptyHomeReserveForm());
      setEditingReserveId(null);
      setMessage(SETTINGS_TEXT.reserveSaved);
      await loadSettings();
    } catch (err) {
      setError(SETTINGS_TEXT.reserveSaveFailed);
    }
  };

  const deleteReserveRecord = async (record: HomeReserveOverviewAdminRecord) => {
    if (!window.confirm(SETTINGS_TEXT.deleteConfirm)) return;
    setError("");
    try {
      await axios.delete(`/api/home-reserve-overview-records/${record.id}`);
      setReserveForm(createEmptyHomeReserveForm());
      setEditingReserveId(null);
      setMessage(SETTINGS_TEXT.reserveDeleted);
      await loadSettings();
    } catch (err) {
      setError(SETTINGS_TEXT.reserveDeleteFailed);
    }
  };

  const reserveNumberFields: Array<[keyof HomeReserveOverviewAdminForm, string]> = [
    ["oilArea", "\u542b\u6cb9\u9762\u79ef"],
    ["producingReserve", "\u52a8\u7528\u50a8\u91cf"],
    ["recoverableReserve", "\u53ef\u91c7\u50a8\u91cf"],
    ["recoveryRate", "\u6807\u5b9a\u91c7\u6536\u7387"],
    ["lastYearOil", "\u4e0a\u5e74\u5ea6\u4ea7\u6cb9"],
    ["sortOrder", "\u6392\u5e8f"],
  ];

  return (
    <PageShell title={SETTINGS_TEXT.title} subtitle={SETTINGS_TEXT.subtitle}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.7fr)]">
        <div className="border border-[#8fb7df] bg-white shadow-sm">
          <div className="border-b border-[#9fc4e8] bg-[#eaf4ff] px-4 py-2 text-center text-base font-bold text-[#cc0000]">{SETTINGS_TEXT.baseConfig}</div>
          <div className="grid gap-3 p-4 md:grid-cols-3">
            {SYSTEM_CONFIG_ITEMS.map((item) => (
              <label key={item.key} className="text-xs font-bold text-slate-700">
                {item.label}
                <input value={config[item.key] || ""} onChange={(event) => setConfig({ ...config, [item.key]: event.target.value })} className="mt-1 h-8 w-full border border-[#9fc4e8] px-2 font-normal" />
              </label>
            ))}
          </div>
          <div className="border-t border-[#d6e8f8] bg-[#f7fbff] px-4 py-3">
            <button type="button" onClick={() => void saveConfig()} className="inline-flex h-8 items-center gap-1 rounded border border-[#2f80ed] bg-[#2f80ed] px-4 text-xs font-bold text-white"><Save className="h-3.5 w-3.5" />{SETTINGS_TEXT.saveBase}</button>
          </div>
        </div>

        <div className="border border-[#8fb7df] bg-white shadow-sm">
          <div className="border-b border-[#9fc4e8] bg-[#eaf4ff] px-4 py-2 text-center text-base font-bold text-[#cc0000]">{SETTINGS_TEXT.unitResponsibility}</div>
          <div className="space-y-3 p-4 text-sm">
            <label className="block text-xs font-bold text-slate-700">{SETTINGS_TEXT.unit}<select value={selectedUnit} onChange={(event) => updateSelectedUnit(event.target.value)} className="mt-1 h-8 w-full border border-[#9fc4e8] px-2 font-normal">{UNIT_OPTIONS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label>
            <label className="block text-xs font-bold text-slate-700">{SETTINGS_TEXT.responsibility}<textarea value={responsibilityText} onChange={(event) => setResponsibilityText(event.target.value)} className="mt-1 h-32 w-full resize-none border border-[#9fc4e8] px-2 py-1 font-normal" placeholder={SETTINGS_TEXT.placeholder} /></label>
            <button type="button" onClick={() => void saveResponsibility()} className="inline-flex h-8 items-center gap-1 rounded border border-[#2f80ed] bg-[#2f80ed] px-4 text-xs font-bold text-white"><Save className="h-3.5 w-3.5" />{SETTINGS_TEXT.saveResponsibility}</button>
          </div>
        </div>
      </div>

      <div className="border border-[#8fb7df] bg-white shadow-sm">
        <div className="border-b border-[#9fc4e8] bg-[#eaf4ff] px-4 py-2 text-center text-base font-bold text-[#cc0000]">{SETTINGS_TEXT.reserveTitle}</div>
        <div className="grid gap-3 border-b border-[#d6e8f8] bg-[#f7fbff] p-4 md:grid-cols-4 xl:grid-cols-8">
          <label className="text-xs font-bold text-slate-700">{SETTINGS_TEXT.unit}<select value={reserveForm.unit} onChange={(event) => setReserveForm({ ...reserveForm, unit: event.target.value })} className="mt-1 h-8 w-full border border-[#9fc4e8] px-2 font-normal"><option value={"\u91c7\u4e00"}>{"\u91c7\u4e00"}</option><option value={"\u91c7\u4e8c"}>{"\u91c7\u4e8c"}</option></select></label>
          <label className="text-xs font-bold text-slate-700">{"\u533a\u5757"}<input value={reserveForm.block} onChange={(event) => setReserveForm({ ...reserveForm, block: event.target.value })} className="mt-1 h-8 w-full border border-[#9fc4e8] px-2 font-normal" /></label>
          {reserveNumberFields.map(([key, label]) => (
            <label key={key} className="text-xs font-bold text-slate-700">{label}<input type="number" step="0.01" value={reserveForm[key]} onChange={(event) => setReserveForm({ ...reserveForm, [key]: event.target.value })} className="mt-1 h-8 w-full border border-[#9fc4e8] px-2 font-normal" /></label>
          ))}
          <div className="flex items-end gap-2 xl:col-span-8">
            <button type="button" onClick={() => void saveReserveRecord()} className="inline-flex h-8 items-center gap-1 rounded border border-[#2f80ed] bg-[#2f80ed] px-4 text-xs font-bold text-white"><Save className="h-3.5 w-3.5" />{editingReserveId ? SETTINGS_TEXT.updateReserve : SETTINGS_TEXT.addReserve}</button>
            {editingReserveId && <button type="button" onClick={() => { setEditingReserveId(null); setReserveForm(createEmptyHomeReserveForm()); }} className="h-8 rounded border border-[#9eb8d4] bg-white px-4 text-xs font-bold text-slate-800">{SETTINGS_TEXT.cancel}</button>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-center text-sm">
            <thead className="bg-[#dcebf8] text-slate-900"><tr>{["\u5e8f\u53f7", "\u5355\u4f4d", "\u533a\u5757", "\u542b\u6cb9\u9762\u79ef", "\u52a8\u7528\u50a8\u91cf", "\u53ef\u91c7\u50a8\u91cf", "\u6807\u5b9a\u91c7\u6536\u7387", "\u4e0a\u5e74\u5ea6\u4ea7\u6cb9", "\u6392\u5e8f", "\u64cd\u4f5c"].map((title) => <th key={title} className="border border-[#9fc4e8] px-2 py-2">{title}</th>)}</tr></thead>
            <tbody>
              {reserveRecords.map((record, index) => (
                <tr key={record.id} className={editingReserveId === record.id ? "bg-red-50" : "hover:bg-[#f7fbff]"}>
                  <td className="border border-[#9fc4e8] px-2 py-2">{index + 1}</td>
                  <td className="border border-[#9fc4e8] px-2 py-2">{record.unit}</td>
                  <td className="border border-[#9fc4e8] px-2 py-2 font-bold">{record.block}</td>
                  <td className="border border-[#9fc4e8] px-2 py-2">{record.oilArea}</td>
                  <td className="border border-[#9fc4e8] px-2 py-2">{record.producingReserve}</td>
                  <td className="border border-[#9fc4e8] px-2 py-2">{record.recoverableReserve}</td>
                  <td className="border border-[#9fc4e8] px-2 py-2">{record.recoveryRate}</td>
                  <td className="border border-[#9fc4e8] px-2 py-2">{record.lastYearOil}</td>
                  <td className="border border-[#9fc4e8] px-2 py-2">{record.sortOrder}</td>
                  <td className="border border-[#9fc4e8] px-2 py-2"><button type="button" onClick={() => { setEditingReserveId(record.id); setReserveForm(toHomeReserveForm(record)); }} className="mr-3 font-bold text-[#0057b8]">{SETTINGS_TEXT.edit}</button><button type="button" onClick={() => void deleteReserveRecord(record)} className="font-bold text-red-600">{SETTINGS_TEXT.delete}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {(message || error) && <div className="border border-[#8fb7df] bg-[#f7fbff] px-4 py-2 text-sm font-bold">{message && <span className="text-emerald-600">{message}</span>}{error && <span className="text-red-600">{error}</span>}</div>}
    </PageShell>
  );
}

function ZonalTableShell({
  title,
  filterMode = "default",
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  toolbar,
  showFilters = true,
  showPagination = true,
  showTitle = true,
  children,
}: {
  title: string;
  filterMode?: "default" | "concentric" | "single-injection" | "single-seal" | "zonal-summary" | "abnormal";
  currentPage?: number;
  pageSize?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  toolbar?: React.ReactNode;
  showFilters?: boolean;
  showPagination?: boolean;
  showTitle?: boolean;
  children: React.ReactNode;
}) {
  const filterClass = "h-6 rounded border border-[#8fb7df] bg-white px-2 text-[12px] text-[#001a33] outline-none";
  const totalPages = totalItems && pageSize ? Math.max(1, Math.ceil(totalItems / pageSize)) : 45;
  const displayPage = currentPage || 1;
  const displayTotal = totalItems || 568;
  const goToPage = (page: number) => onPageChange?.(Math.min(totalPages, Math.max(1, page)));
  const showTopBar = Boolean(toolbar) || showFilters || showPagination;

  return (
    <div className="zonal-table-shell rounded-sm border border-[#9fc4e8] bg-[#f4f8fc] shadow-sm">
      {showTopBar && (
        <div className="zonal-table-toolbar flex flex-wrap items-center justify-between gap-3 border-b border-[#9fc4e8] bg-[#f7fbff] px-0 py-2 text-[12px] text-[#001a33]">
          {toolbar ? (
            <div className="flex flex-wrap items-center gap-2">{toolbar}</div>
          ) : showFilters && (
            <div className="flex flex-wrap items-center gap-2">
              {filterMode === "default" && (
                <>
                  <label className="flex items-center gap-1">
                    <span>采油厂</span>
                    <select className={`${filterClass} w-24`} defaultValue="高升采油厂">
                      <option>高升采油厂</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    <span>作业区</span>
                    <select className={`${filterClass} w-36`} defaultValue="高采采油作业一区">
                      {FILTER_UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    <span>设计单位</span>
                    <select className={`${filterClass} w-20`} defaultValue="请选择">
                      <option>请选择</option>
                      <option>地质研究所</option>
                      <option>工艺研究所</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    <span>井别</span>
                    <select className={`${filterClass} w-16`} defaultValue="油井">
                      <option>油井</option>
                      <option>水井</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    <span>措施</span>
                    <select className={`${filterClass} w-20`} defaultValue="请选择">
                      <option>请选择</option>
                      <option>测调</option>
                      <option>评价</option>
                    </select>
                  </label>
                </>
              )}
              {filterMode === "single-injection" && (
                <>
                  <label className="flex items-center gap-1">
                    <span>评价单位</span>
                    <select className={`${filterClass} w-28`} defaultValue="高采采油作业一区">
                      <option>高采采油作业一区</option>
                      <option>高采采油作业二区</option>
                      <option>地质研究所</option>
                      <option>工艺研究所</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    <span>分注工艺</span>
                    <select className={`${filterClass} w-24`} defaultValue="请选择">
                      <option>请选择</option>
                      <option>同心分注</option>
                      <option>智能分注</option>
                      <option>桥式同心</option>
                    </select>
                  </label>
                </>
              )}
              {filterMode === "single-seal" && (
                <label className="flex items-center gap-1">
                  <span>分注工艺</span>
                  <select className={`${filterClass} w-24`} defaultValue="请选择">
                    <option>请选择</option>
                    <option>同心分注</option>
                    <option>智能分注</option>
                    <option>桥式同心</option>
                  </select>
                </label>
              )}
              {filterMode === "zonal-summary" && (
                <label className="flex items-center gap-1">
                  <span>分注工艺</span>
                  <select className={`${filterClass} w-24`} defaultValue="请选择">
                    <option>请选择</option>
                    <option>油套</option>
                    <option>同心双管</option>
                    <option>同心三管</option>
                    <option>桥式同心</option>
                    <option>智能有缆</option>
                    <option>智能无缆</option>
                  </select>
                </label>
              )}
              {filterMode === "abnormal" && (
                <>
                  <label className="flex items-center gap-1">
                    <span>作业区</span>
                    <select className={`${filterClass} w-36`} defaultValue="高采采油作业一区">
                      {FILTER_UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    <span>区块</span>
                    <select className={`${filterClass} w-24`} defaultValue="">
                      <option value="">请选择</option>
                      {getFilterBlockOptions(FILTER_UNIT_OPTIONS[0]).map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    <span>井号</span>
                    <input className={`${filterClass} w-24`} />
                  </label>
                  <label className="flex items-center gap-1">
                    <span>异常分类</span>
                    <select className={`${filterClass} w-24`} defaultValue="请选择">
                      <option>请选择</option>
                      <option>欠注</option>
                      <option>封隔器失效</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-1">
                    <span>注水工艺</span>
                    <select className={`${filterClass} w-24`} defaultValue="请选择">
                      <option>请选择</option>
                      <option>分注</option>
                      <option>同心分注</option>
                      <option>智能分注</option>
                    </select>
                  </label>
                </>
              )}
              {(filterMode === "default" || filterMode === "concentric") && (
                <label className="flex items-center gap-1">
                  <span>井号</span>
                  <input className={`${filterClass} w-24`} />
                </label>
              )}
              {filterMode === "concentric" && (
                <label className="flex items-center gap-1">
                  <span>测调日期</span>
                  <input type="date" className={`${filterClass} w-32`} />
                  <span>至</span>
                  <input type="date" className={`${filterClass} w-32`} />
                </label>
              )}
              {filterMode === "single-injection" && (
                <label className="flex items-center gap-1">
                  <span>井号</span>
                  <input className={`${filterClass} w-24`} />
                </label>
              )}
              {filterMode === "single-injection" && (
                <label className="flex items-center gap-1">
                  <span>评价日期</span>
                  <input type="date" className={`${filterClass} w-32`} />
                  <span>至</span>
                  <input type="date" className={`${filterClass} w-32`} />
                </label>
              )}
              {filterMode === "single-seal" && (
                <>
                  <label className="flex items-center gap-1">
                    <span>评价日期</span>
                    <input type="date" className={`${filterClass} w-32`} />
                    <span>至</span>
                    <input type="date" className={`${filterClass} w-32`} />
                  </label>
                  <label className="flex items-center gap-1">
                    <span>井号</span>
                    <input className={`${filterClass} w-24`} />
                  </label>
                </>
              )}
              <button type="button" className="h-6 rounded border border-[#8aaed3] bg-[#e4f0fa] px-4 text-[12px] font-bold text-[#001a33] hover:bg-[#d6e8f8]">
                确定
              </button>
            </div>
          )}
          {showPagination && (
            <div className="flex flex-wrap items-center gap-2 whitespace-nowrap pr-2 text-[12px] text-[#001a33]">
              <span>第{displayPage}页 共{totalPages}页 共{displayTotal}条</span>
              <button type="button" className="font-bold text-[#0000ee] hover:underline" onClick={() => goToPage(1)}>
                首页
              </button>
              <button type="button" className="font-bold text-[#0000ee] hover:underline" onClick={() => goToPage(displayPage - 1)}>
                上一页
              </button>
              <button type="button" className="font-bold text-[#0000ee] hover:underline" onClick={() => goToPage(displayPage + 1)}>
                下一页
              </button>
              <button type="button" className="font-bold text-[#0000ee] hover:underline" onClick={() => goToPage(totalPages)}>
                尾页
              </button>
              <span>跳转</span>
              <input className="h-6 w-9 rounded border border-[#9bbfe5] bg-white px-1 text-center text-[12px] outline-none" value={displayPage} readOnly />
              <span>页</span>
              <button type="button" className="h-6 rounded border border-[#8aaed3] bg-[#d8e7f5] px-1 text-[11px] font-bold text-[#001a33]" onClick={() => goToPage(displayPage)}>
                GO
              </button>
            </div>
          )}
        </div>
      )}

      {showTitle && <h1 className="py-2 text-center text-[22px] font-bold leading-none text-[#cc0000]">{title}</h1>}
      <div className="overflow-x-auto border-t border-[#99c7f3] bg-white">{children}</div>
    </div>
  );
}

const CONCENTRIC_TEST_HISTORY_TEMPLATE_ROWS = [
  { wellNo: "雷19-10", allocatorCount: 4, freedom: "完全自由", partialStroke: "", fullyStuck: "", layerFreedom: ["完全自由", "完全自由", "部分行程", "完全自由"], dailyInjection: ["32.5", "28.0", "18.6", "21.4"], remark: "第3层行程偏小" },
  { wellNo: "雷20-12侧", allocatorCount: 3, freedom: "", partialStroke: "部分行程", fullyStuck: "", layerFreedom: ["完全自由", "部分行程", "完全自由", "-"], dailyInjection: ["25.2", "16.8", "19.5", "-"], remark: "建议跟踪复测" },
  { wellNo: "雷21-8", allocatorCount: 2, freedom: "完全自由", partialStroke: "", fullyStuck: "", layerFreedom: ["完全自由", "完全自由", "-", "-"], dailyInjection: ["30.0", "27.5", "-", "-"], remark: "正常" },
  { wellNo: "雷18-6", allocatorCount: 4, freedom: "", partialStroke: "", fullyStuck: "完全不动", layerFreedom: ["完全不动", "完全不动", "部分行程", "完全自由"], dailyInjection: ["0", "0", "12.4", "24.1"], remark: "上部两层需处理" },
  { wellNo: "雷22-15", allocatorCount: 3, freedom: "", partialStroke: "部分行程", fullyStuck: "", layerFreedom: ["部分行程", "完全自由", "完全自由", "-"], dailyInjection: ["20.6", "22.3", "26.8", "-"], remark: "一层调配后观察" },
];

const CONCENTRIC_TEST_HISTORY_ROWS = Array.from({ length: 26 }, (_, index) => {
  const template = CONCENTRIC_TEST_HISTORY_TEMPLATE_ROWS[index % CONCENTRIC_TEST_HISTORY_TEMPLATE_ROWS.length];
  const date = new Date(2026, 4, 8 - index);
  return {
    ...template,
    wellNo: `${template.wellNo}-${String(index + 1).padStart(2, "0")}`,
    testDate: date.toISOString().slice(0, 10),
  };
});

function ConcentricTestHistoryPage() {
  const headClass = "border border-[#9fc4e8] bg-[#e3f0fb] px-2 py-2 text-center text-sm font-bold leading-tight text-[#001a33]";
  const cellClass = "border border-[#9fc4e8] bg-white px-2 py-2 text-center text-sm text-[#001a33]";
  const inputClass = "h-6 rounded border border-[#8fb7df] bg-white px-2 text-[12px] text-[#001a33] outline-none";
  const toolButtonClass = "h-6 rounded border border-[#8aaed3] bg-[#e4f0fa] px-3 text-[12px] font-bold text-[#001a33] hover:bg-[#d6e8f8]";
  const pageSize = 10;
  const [records, setRecords] = useState<ConcentricTestRecord[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({ unit: "", block: "", wellNo: "", fromDate: "", toDate: "" });
  const [form, setForm] = useState<ConcentricTestForm>(() => createEmptyConcentricTestForm());
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { confirmDialog, requestConfirm } = useStyledConfirmDialog();

  const loadRecords = async (page = currentPage, nextFilters = filters) => {
    try {
      setError("");
      const params = Object.fromEntries(Object.entries({ ...nextFilters, page, pageSize }).filter(([, value]) => String(value).trim()));
      const { data } = await axios.get<PaginatedApiResponse<ConcentricTestRecord>>("/api/concentric-test-records", { params });
      setRecords(data.rows);
      setTotalItems(data.total);
      setCurrentPage(data.page);
      setSelectedId((current) => (data.rows.some((row) => row.id === current) ? current : null));
    } catch (err: any) {
      setError(err?.response?.data?.error || "同心测调记录加载失败");
    }
  };

  useEffect(() => {
    void loadRecords(1);
  }, []);

  const updateForm = (key: keyof ConcentricTestForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateLayerForm = (key: "layerFreedom" | "dailyInjection", index: number, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: current[key].map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  };

  const openCreateForm = () => {
    setForm({ ...createEmptyConcentricTestForm(), unit: filters.unit || "\u9ad8\u91c7\u91c7\u6cb9\u4f5c\u4e1a\u4e00\u533a", block: filters.block, wellNo: filters.wellNo, testDate: filters.fromDate || new Date().toISOString().slice(0, 10) });
    setShowForm(true);
    setError("");
  };

  const handleSave = async () => {
    if (!form.unit.trim() || !form.block.trim() || !form.wellNo.trim() || !form.testDate || !Number.isFinite(Number(form.allocatorCount))) {
      setError("请填写作业区、区块、井号、测调日期和配水器总个数");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await axios.post("/api/concentric-test-records", form);
      setShowForm(false);
      setForm(createEmptyConcentricTestForm());
      await loadRecords(1);
    } catch (err: any) {
      setError(err?.response?.data?.error || "同心测调记录新增失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const record = records.find((row) => row.id === selectedId);
    if (!record) return;
    requestConfirm(`确认删除 ${record.wellNo} 的同心测调记录？`, async () => {
      try {
        await axios.delete(`/api/concentric-test-records/${record.id}`);
        setSelectedId(null);
        const nextPage = records.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
        await loadRecords(nextPage);
      } catch (err: any) {
        setError(err?.response?.data?.error || "同心测调记录删除失败");
      }
    });
  };

  const toolbar = (
    <>
      <span>作业区</span><select className="h-6 w-36 border px-1" value={filters.unit} onChange={(event) => setFilters({ ...filters, unit: event.target.value, block: "" })}><option value="">请选择</option>{FILTER_UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
      <span>区块</span><select className="h-6 w-28 border px-1" value={filters.block} onChange={(event) => setFilters({ ...filters, block: event.target.value })}><option value="">请选择</option>{getFilterBlockOptions(filters.unit).map((option) => <option key={option} value={option}>{option}</option>)}</select>
      <span>日期</span><input type="date" className="h-6 border px-1" value={filters.fromDate} onChange={(event) => setFilters({ ...filters, fromDate: event.target.value })} />
      <span>至</span><input type="date" className="h-6 border px-1" value={filters.toDate} onChange={(event) => setFilters({ ...filters, toDate: event.target.value })} />
      <button className={toolButtonClass} onClick={() => loadRecords(1)}>确定</button>
      <button className={toolButtonClass} onClick={openCreateForm}>新增</button>
      <button className={`${toolButtonClass} disabled:cursor-not-allowed disabled:opacity-50`} disabled={!selectedId} onClick={handleDelete}>删除</button>
      {error && <span className="text-red-600">{error}</span>}
    </>
  );

  return (
    <div>
      {confirmDialog}
      <ZonalTableShell title="同心测调井史" filterMode="concentric" toolbar={toolbar} currentPage={currentPage} pageSize={pageSize} totalItems={totalItems} onPageChange={(page) => loadRecords(page)}>
        <table className="w-full min-w-[1320px] border-collapse bg-white">
          <thead>
            <tr>
              <th rowSpan={2} className={headClass}>序号</th>
              <th rowSpan={2} className={headClass}>井号</th>
              <th rowSpan={2} className={headClass}>作业区</th>
              <th rowSpan={2} className={headClass}>区块</th>
              <th rowSpan={2} className={headClass}>测调日期</th>
              <th rowSpan={2} className={headClass}>配水器<br />总个数</th>
              <th colSpan={3} className={headClass}>测试自由度评价</th>
              <th colSpan={4} className={headClass}>单层测调自由度评价（自上而下）</th>
              <th colSpan={4} className={headClass}>单层日注水量（自上而下）</th>
              <th rowSpan={2} className={headClass}>备注</th>
            </tr>
            <tr>
              {["完全自由", "部分行程", "完全不动", "1层", "2层", "3层", "4层", "1层", "2层", "3层", "4层"].map((header) => (
                <th key={header} className={headClass}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((row, index) => (
              <tr key={row.id} className="cursor-pointer" onClick={() => setSelectedId(row.id)}>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{(currentPage - 1) * pageSize + index + 1}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.wellNo}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.unit}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.block}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{apiDateOnly(row.testDate)}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.allocatorCount}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.freedom || "-"}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.partialStroke || "-"}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.fullyStuck || "-"}</td>
                {row.layerFreedom.map((value, layerIndex) => (
                  <td key={`${row.wellNo}-freedom-${layerIndex}`} className={selectedTableCellClass(cellClass, row.id === selectedId)}>{value}</td>
                ))}
                {row.dailyInjection.map((value, layerIndex) => (
                  <td key={`${row.wellNo}-water-${layerIndex}`} className={selectedTableCellClass(cellClass, row.id === selectedId)}>{value}</td>
                ))}
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.remark}</td>
              </tr>
            ))}
            {!records.length && <tr><td colSpan={18} className={cellClass}>暂无符合条件的数据</td></tr>}
          </tbody>
        </table>
      </ZonalTableShell>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto border border-shell-border bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">新增同心测调井史</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm font-bold text-gray-500 hover:text-gray-900">关闭</button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <select className={inputClass} value={form.unit} onChange={(event) => { updateForm("unit", event.target.value); updateForm("block", ""); }}>
                {FILTER_UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <select className={inputClass} value={form.block} onChange={(event) => updateForm("block", event.target.value)}>
                <option value="">请选择区块</option>
                {getFilterBlockOptions(form.unit).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <input className={inputClass} placeholder="井号" value={form.wellNo} onChange={(event) => updateForm("wellNo", event.target.value)} />
              <input type="date" className={inputClass} value={form.testDate} onChange={(event) => updateForm("testDate", event.target.value)} />
              <input type="number" className={inputClass} placeholder="配水器总个数" value={form.allocatorCount} onChange={(event) => updateForm("allocatorCount", event.target.value)} />
              <input className={inputClass} placeholder="完全自由评价" value={form.freedom} onChange={(event) => updateForm("freedom", event.target.value)} />
              <input className={inputClass} placeholder="部分行程评价" value={form.partialStroke} onChange={(event) => updateForm("partialStroke", event.target.value)} />
              <input className={inputClass} placeholder="完全不动评价" value={form.fullyStuck} onChange={(event) => updateForm("fullyStuck", event.target.value)} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded border border-[#d7e5f3] p-3">
                <div className="mb-2 text-sm font-bold text-[#001a33]">单层测调自由度评价（自上而下）</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {form.layerFreedom.map((value, index) => (
                    <input key={`layer-freedom-${index}`} className={inputClass} placeholder={`${index + 1}层`} value={value} onChange={(event) => updateLayerForm("layerFreedom", index, event.target.value)} />
                  ))}
                </div>
              </div>
              <div className="rounded border border-[#d7e5f3] p-3">
                <div className="mb-2 text-sm font-bold text-[#001a33]">单层日注水量（自上而下）</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {form.dailyInjection.map((value, index) => (
                    <input key={`daily-injection-${index}`} className={inputClass} placeholder={`${index + 1}层`} value={value} onChange={(event) => updateLayerForm("dailyInjection", index, event.target.value)} />
                  ))}
                </div>
              </div>
            </div>
            <textarea className="mt-3 min-h-20 w-full rounded border border-[#b8c8d8] px-3 py-2 text-sm outline-none focus:border-cnpc-blue" placeholder="备注" value={form.remark} onChange={(event) => updateForm("remark", event.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">取消</button>
              <button type="button" onClick={handleSave} disabled={saving} className="rounded bg-cnpc-red px-4 py-2 text-sm font-bold text-white hover:bg-cnpc-red-dark disabled:opacity-60">{saving ? "保存中..." : "保存"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SMART_TEST_HISTORY_TEMPLATE_ROWS = [
  {
    wellNo: "雷19-10",
    allocatorCount: 5,
    dailyAllocation: ["30", "25", "20", "18", "12"],
    dailyInjection: ["31.5", "24.2", "19.8", "18.6", "11.7"],
    allocationDiff: ["+1.5", "-0.8", "-0.2", "+0.6", "-0.3"],
    nozzleOpening: ["42", "38", "35", "31", "26"],
    wellheadPressure: "12.6",
    innerPressure: ["11.8", "11.2", "10.7", "10.1", "9.5"],
    outerPressure: ["10.6", "10.1", "9.8", "9.2", "8.9"],
    remark: "正常",
  },
  {
    wellNo: "雷20-12侧",
    allocatorCount: 4,
    dailyAllocation: ["26", "22", "18", "14", "-"],
    dailyInjection: ["25.5", "21.0", "17.6", "13.9", "-"],
    allocationDiff: ["-0.5", "-1.0", "-0.4", "-0.1", "-"],
    nozzleOpening: ["40", "36", "30", "24", "-"],
    wellheadPressure: "11.9",
    innerPressure: ["11.0", "10.5", "10.0", "9.6", "-"],
    outerPressure: ["10.2", "9.7", "9.4", "9.0", "-"],
    remark: "四层偏低",
  },
  {
    wellNo: "雷21-8",
    allocatorCount: 3,
    dailyAllocation: ["28", "24", "20", "-", "-"],
    dailyInjection: ["28.6", "23.8", "20.4", "-", "-"],
    allocationDiff: ["+0.6", "-0.2", "+0.4", "-", "-"],
    nozzleOpening: ["39", "34", "30", "-", "-"],
    wellheadPressure: "12.2",
    innerPressure: ["11.5", "10.8", "10.2", "-", "-"],
    outerPressure: ["10.8", "10.0", "9.6", "-", "-"],
    remark: "正常",
  },
];

const SMART_TEST_HISTORY_ROWS = Array.from({ length: 26 }, (_, index) => {
  const template = SMART_TEST_HISTORY_TEMPLATE_ROWS[index % SMART_TEST_HISTORY_TEMPLATE_ROWS.length];
  const date = new Date(2026, 4, 9 - index);
  return {
    ...template,
    wellNo: `${template.wellNo}-${String(index + 1).padStart(2, "0")}`,
    testDate: date.toISOString().slice(0, 10),
  };
});

function SmartTestHistoryPage() {
  const headClass = "border border-[#9fc4e8] bg-[#e3f0fb] px-1.5 py-2 text-center text-xs font-bold leading-tight text-[#001a33]";
  const cellClass = "border border-[#9fc4e8] bg-white px-2 py-2 text-center text-sm text-[#001a33]";
  const inputClass = "h-6 rounded border border-[#8fb7df] bg-white px-2 text-[12px] text-[#001a33] outline-none";
  const toolButtonClass = "h-6 rounded border border-[#8aaed3] bg-[#e4f0fa] px-3 text-[12px] font-bold text-[#001a33] hover:bg-[#d6e8f8]";
  const layers = ["1层", "2层", "3层", "4层", "5层"];
  const pageSize = 10;
  const [records, setRecords] = useState<SmartTestRecord[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({ unit: "", block: "", wellNo: "", fromDate: "", toDate: "" });
  const [form, setForm] = useState<SmartTestForm>(() => createEmptySmartTestForm());
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { confirmDialog, requestConfirm } = useStyledConfirmDialog();

  const loadRecords = async (page = currentPage, nextFilters = filters) => {
    try {
      setError("");
      const params = Object.fromEntries(Object.entries({ ...nextFilters, page, pageSize }).filter(([, value]) => String(value).trim()));
      const { data } = await axios.get<PaginatedApiResponse<SmartTestRecord>>("/api/smart-test-records", { params });
      setRecords(data.rows);
      setTotalItems(data.total);
      setCurrentPage(data.page);
      setSelectedId((current) => (data.rows.some((row) => row.id === current) ? current : null));
    } catch (err: any) {
      setError(err?.response?.data?.error || "智能测调记录加载失败");
    }
  };

  useEffect(() => {
    void loadRecords(1);
  }, []);

  const updateForm = (key: keyof SmartTestForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateArrayForm = (
    key: "dailyAllocation" | "dailyInjection" | "allocationDiff" | "nozzleOpening" | "innerPressure" | "outerPressure",
    index: number,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [key]: current[key].map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  };

  const openCreateForm = () => {
    setForm({ ...createEmptySmartTestForm(), unit: filters.unit || "\u9ad8\u91c7\u91c7\u6cb9\u4f5c\u4e1a\u4e00\u533a", block: filters.block, wellNo: filters.wellNo, testDate: filters.fromDate || new Date().toISOString().slice(0, 10) });
    setShowForm(true);
    setError("");
  };

  const handleSave = async () => {
    if (!form.unit.trim() || !form.block.trim() || !form.wellNo.trim() || !form.testDate || !Number.isFinite(Number(form.allocatorCount))) {
      setError("请填写作业区、区块、井号、测调日期和配水器总个数");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await axios.post("/api/smart-test-records", form);
      setShowForm(false);
      setForm(createEmptySmartTestForm());
      await loadRecords(1);
    } catch (err: any) {
      setError(err?.response?.data?.error || "智能测调记录新增失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const record = records.find((row) => row.id === selectedId);
    if (!record) return;
    requestConfirm(`确认删除 ${record.wellNo} 的智能测调记录？`, async () => {
      try {
        await axios.delete(`/api/smart-test-records/${record.id}`);
        setSelectedId(null);
        await loadRecords(records.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage);
      } catch (err: any) {
        setError(err?.response?.data?.error || "智能测调记录删除失败");
      }
    });
  };

  const toolbar = (
    <>
      <span>作业区</span><select className="h-6 w-36 border px-1" value={filters.unit} onChange={(event) => setFilters({ ...filters, unit: event.target.value, block: "" })}><option value="">请选择</option>{FILTER_UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
      <span>区块</span><select className="h-6 w-28 border px-1" value={filters.block} onChange={(event) => setFilters({ ...filters, block: event.target.value })}><option value="">请选择</option>{getFilterBlockOptions(filters.unit).map((option) => <option key={option} value={option}>{option}</option>)}</select>
      <span>日期</span><input type="date" className="h-6 border px-1" value={filters.fromDate} onChange={(event) => setFilters({ ...filters, fromDate: event.target.value })} />
      <span>至</span><input type="date" className="h-6 border px-1" value={filters.toDate} onChange={(event) => setFilters({ ...filters, toDate: event.target.value })} />
      <button className={toolButtonClass} onClick={() => loadRecords(1)}>确定</button>
      <button className={toolButtonClass} onClick={openCreateForm}>新增</button>
      <button className={`${toolButtonClass} disabled:cursor-not-allowed disabled:opacity-50`} disabled={!selectedId} onClick={handleDelete}>删除</button>
      {error && <span className="text-red-600">{error}</span>}
    </>
  );

  return (
    <div>
      {confirmDialog}
      <ZonalTableShell title="智能测调井史" filterMode="concentric" toolbar={toolbar} currentPage={currentPage} pageSize={pageSize} totalItems={totalItems} onPageChange={(page) => loadRecords(page)}>
        <table className="w-full min-w-[1820px] border-collapse bg-white">
          <thead>
            <tr>
              <th rowSpan={2} className={headClass}>序号</th>
              <th rowSpan={2} className={headClass}>井号</th>
              <th rowSpan={2} className={headClass}>作业区</th>
              <th rowSpan={2} className={headClass}>区块</th>
              <th rowSpan={2} className={headClass}>测调<br />日期</th>
              <th rowSpan={2} className={headClass}>配水器<br />总个数</th>
              <th colSpan={5} className={headClass}>单层日配注量（自上而下）</th>
              <th colSpan={5} className={headClass}>单层日注水量（自上而下）</th>
              <th colSpan={5} className={headClass}>对比配注差值（自上而下）</th>
              <th colSpan={5} className={headClass}>水嘴开度</th>
              <th rowSpan={2} className={headClass}>井口<br />油压</th>
              <th colSpan={5} className={headClass}>内压</th>
              <th colSpan={5} className={headClass}>外压</th>
              <th rowSpan={2} className={headClass}>备注</th>
            </tr>
            <tr>
              {Array.from({ length: 6 }).flatMap((_, groupIndex) =>
                layers.map((layer) => (
                  <th key={`${groupIndex}-${layer}`} className={headClass}>{layer}</th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {records.map((row, index) => (
              <tr key={row.id} className="cursor-pointer" onClick={() => setSelectedId(row.id)}>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{(currentPage - 1) * pageSize + index + 1}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.wellNo}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.unit}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.block}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{apiDateOnly(row.testDate)}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.allocatorCount}</td>
                {[row.dailyAllocation, row.dailyInjection, row.allocationDiff, row.nozzleOpening].flatMap((values, groupIndex) =>
                  values.map((value, valueIndex) => (
                    <td key={`${groupIndex}-${valueIndex}`} className={selectedTableCellClass(cellClass, row.id === selectedId)}>{value}</td>
                  )),
                )}
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.wellheadPressure}</td>
                {[row.innerPressure, row.outerPressure].flatMap((values, groupIndex) =>
                  values.map((value, valueIndex) => (
                    <td key={`pressure-${groupIndex}-${valueIndex}`} className={selectedTableCellClass(cellClass, row.id === selectedId)}>{value}</td>
                  )),
                )}
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.remark}</td>
              </tr>
            ))}
            {!records.length && <tr><td colSpan={38} className={cellClass}>暂无符合条件的数据</td></tr>}
          </tbody>
        </table>
      </ZonalTableShell>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto border border-shell-border bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">新增智能测调井史</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm font-bold text-gray-500 hover:text-gray-900">关闭</button>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <select className={inputClass} value={form.unit} onChange={(event) => { updateForm("unit", event.target.value); updateForm("block", ""); }}>
                {FILTER_UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <select className={inputClass} value={form.block} onChange={(event) => updateForm("block", event.target.value)}>
                <option value="">请选择区块</option>
                {getFilterBlockOptions(form.unit).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <input className={inputClass} placeholder="井号" value={form.wellNo} onChange={(event) => updateForm("wellNo", event.target.value)} />
              <input type="date" className={inputClass} value={form.testDate} onChange={(event) => updateForm("testDate", event.target.value)} />
              <input type="number" className={inputClass} placeholder="配水器总个数" value={form.allocatorCount} onChange={(event) => updateForm("allocatorCount", event.target.value)} />
              <input className={inputClass} placeholder="井口油压" value={form.wellheadPressure} onChange={(event) => updateForm("wellheadPressure", event.target.value)} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                ["dailyAllocation", "单层日配注量（自上而下）"],
                ["dailyInjection", "单层日注水量（自上而下）"],
                ["allocationDiff", "对比配注差值（自上而下）"],
                ["nozzleOpening", "水嘴开度"],
                ["innerPressure", "内压"],
                ["outerPressure", "外压"],
              ].map(([key, title]) => (
                <div key={key} className="rounded border border-[#d7e5f3] p-3">
                  <div className="mb-2 text-sm font-bold text-[#001a33]">{title}</div>
                  <div className="grid gap-2 sm:grid-cols-5">
                    {form[key as keyof Pick<SmartTestForm, "dailyAllocation" | "dailyInjection" | "allocationDiff" | "nozzleOpening" | "innerPressure" | "outerPressure">].map((value, index) => (
                      <input key={`${key}-${index}`} className={inputClass} placeholder={`${index + 1}层`} value={value} onChange={(event) => updateArrayForm(key as "dailyAllocation" | "dailyInjection" | "allocationDiff" | "nozzleOpening" | "innerPressure" | "outerPressure", index, event.target.value)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <textarea className="mt-3 min-h-20 w-full rounded border border-[#b8c8d8] px-3 py-2 text-sm outline-none focus:border-cnpc-blue" placeholder="备注" value={form.remark} onChange={(event) => updateForm("remark", event.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">取消</button>
              <button type="button" onClick={handleSave} disabled={saving} className="rounded bg-cnpc-red px-4 py-2 text-sm font-bold text-white hover:bg-cnpc-red-dark disabled:opacity-60">{saving ? "保存中..." : "保存"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SINGLE_WELL_INJECTION_EVALUATION_TEMPLATE_ROWS = [
  { wellNo: "雷19-10", process: "同心分注", unit: "", date: "2026-05-10", intervalCount: 4, actualCount: 4, qualifiedCount: 3, unqualified: ["1", "0", "1", "0", "0", "0"], remark: "欠注1层" },
  { wellNo: "雷20-12侧", process: "智能分注", unit: "", date: "2026-05-08", intervalCount: 4, actualCount: 4, qualifiedCount: 4, unqualified: ["0", "0", "0", "0", "0", "0"], remark: "合格" },
  { wellNo: "雷21-8", process: "桥式同心", unit: "高采采油作业二区", date: "2026-05-06", intervalCount: 3, actualCount: 3, qualifiedCount: 2, unqualified: ["1", "1", "0", "0", "0", "0"], remark: "封隔器待复核" },
];

const SINGLE_WELL_INJECTION_EVALUATION_ROWS = Array.from({ length: 38 }, (_, index) => {
  const template = SINGLE_WELL_INJECTION_EVALUATION_TEMPLATE_ROWS[index % SINGLE_WELL_INJECTION_EVALUATION_TEMPLATE_ROWS.length];
  const date = new Date(2026, 4, 10 - index);
  return {
    ...template,
    wellNo: `${template.wellNo}-${String(index + 1).padStart(2, "0")}`,
    date: date.toISOString().slice(0, 10),
  };
});

function SingleWellInjectionEvaluationPage() {
  const headClass = "border border-[#9fc4e8] bg-[#e3f0fb] px-2 py-2 text-center text-sm font-bold leading-tight text-[#001a33]";
  const cellClass = "border border-[#9fc4e8] bg-white px-2 py-2 text-center text-sm text-[#001a33]";
  const inputClass = "h-6 rounded border border-[#8fb7df] bg-white px-2 text-[12px] text-[#001a33] outline-none";
  const toolButtonClass = "h-6 rounded border border-[#8aaed3] bg-[#e4f0fa] px-3 text-[12px] font-bold text-[#001a33] hover:bg-[#d6e8f8]";
  const pageSize = 15;
  const [records, setRecords] = useState<SingleWellInjectionEvaluationRecord[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({ unit: "", block: "", process: "", wellNo: "" });
  const [form, setForm] = useState<SingleWellInjectionEvaluationForm>(() => createEmptySingleWellInjectionEvaluationForm());
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { confirmDialog, requestConfirm } = useStyledConfirmDialog();

  const loadRecords = async (page = currentPage, nextFilters = filters) => {
    try {
      setError("");
      const params = Object.fromEntries(Object.entries({ ...nextFilters, page, pageSize }).filter(([, value]) => String(value).trim()));
      const { data } = await axios.get<PaginatedApiResponse<SingleWellInjectionEvaluationRecord>>("/api/single-well-injection-evaluations", { params });
      setRecords(data.rows);
      setTotalItems(data.total);
      setCurrentPage(data.page);
      setSelectedId((current) => (data.rows.some((row) => row.id === current) ? current : null));
    } catch (err: any) {
      setError(err?.response?.data?.error || "单井注入评价加载失败");
    }
  };

  useEffect(() => {
    void loadRecords(1);
  }, []);

  const updateForm = (key: keyof SingleWellInjectionEvaluationForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateUnqualified = (index: number, value: string) => {
    setForm((current) => ({
      ...current,
      unqualified: current.unqualified.map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  };

  const openCreateForm = () => {
    setForm({ ...createEmptySingleWellInjectionEvaluationForm(), wellNo: filters.wellNo, process: filters.process, unit: filters.unit || "\u9ad8\u91c7\u91c7\u6cb9\u4f5c\u4e1a\u4e00\u533a", block: filters.block });
    setShowForm(true);
    setError("");
  };

  const handleSave = async () => {
    if (!form.unit.trim() || !form.block.trim() || !form.wellNo.trim() || !form.process.trim() || !form.evaluationDate) {
      setError("请填写作业区、区块、井号、分注工艺、评价单位和评价日期");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await axios.post("/api/single-well-injection-evaluations", form);
      setShowForm(false);
      setForm(createEmptySingleWellInjectionEvaluationForm());
      await loadRecords(1);
    } catch (err: any) {
      setError(err?.response?.data?.error || "单井注入评价新增失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const record = records.find((row) => row.id === selectedId);
    if (!record) return;
    requestConfirm(`确认删除 ${record.wellNo} 的单井注入评价？`, async () => {
      try {
        await axios.delete(`/api/single-well-injection-evaluations/${record.id}`);
        setSelectedId(null);
        await loadRecords(records.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage);
      } catch (err: any) {
        setError(err?.response?.data?.error || "单井注入评价删除失败");
      }
    });
  };

  const toolbar = (
    <>
      <span>作业区</span><select className="h-6 w-36 border px-1" value={filters.unit} onChange={(event) => setFilters({ ...filters, unit: event.target.value, block: "" })}><option value="">请选择</option>{FILTER_UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
      <span>区块</span><select className="h-6 w-28 border px-1" value={filters.block} onChange={(event) => setFilters({ ...filters, block: event.target.value })}><option value="">请选择</option>{getFilterBlockOptions(filters.unit).map((option) => <option key={option} value={option}>{option}</option>)}</select>
      <span>工艺</span><input className="h-6 w-24 border px-1" value={filters.process} onChange={(event) => setFilters({ ...filters, process: event.target.value })} />
      <button className={toolButtonClass} onClick={() => loadRecords(1)}>确定</button>
      <button className={toolButtonClass} onClick={openCreateForm}>新增</button>
      <button className={`${toolButtonClass} disabled:cursor-not-allowed disabled:opacity-50`} disabled={!selectedId} onClick={handleDelete}>删除</button>
      {error && <span className="text-red-600">{error}</span>}
    </>
  );

  return (
    <div>
      {confirmDialog}
      <ZonalTableShell title="单井注入评价" filterMode="single-injection" toolbar={toolbar} currentPage={currentPage} pageSize={pageSize} totalItems={totalItems} onPageChange={(page) => loadRecords(page)}>
        <table className="w-full min-w-[1320px] border-collapse bg-white">
          <thead>
            <tr>
              {["序号", "井号", "作业区", "区块", "分注工艺", "评价单位", "评价日期", "分注层段数", "实注层段数", "合格层段数"].map((header) => (
                <th key={header} rowSpan={3} className={headClass}>{header}</th>
              ))}
              <th colSpan={6} className={headClass}>分注不合格层段统计</th>
              <th rowSpan={3} className={headClass}>备注</th>
            </tr>
            <tr>
              {["小计", "封隔器失效", "欠注"].map((header) => (
                <th key={header} rowSpan={2} className={headClass}>{header}</th>
              ))}
              <th className={headClass}>测调</th>
              {["窜槽", "其它"].map((header) => (
                <th key={header} rowSpan={2} className={headClass}>{header}</th>
              ))}
            </tr>
            <tr>
              <th className={headClass}>不准</th>
            </tr>
          </thead>
          <tbody>
            {records.map((row, index) => (
              <tr key={row.id} className="cursor-pointer" onClick={() => setSelectedId(row.id)}>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{(currentPage - 1) * pageSize + index + 1}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.wellNo}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.unit}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.block}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.process}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.unit}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{apiDateOnly(row.evaluationDate)}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.intervalCount}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.actualCount}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.qualifiedCount}</td>
                {row.unqualified.map((value, valueIndex) => (
                  <td key={valueIndex} className={selectedTableCellClass(cellClass, row.id === selectedId)}>{value}</td>
                ))}
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.remark}</td>
              </tr>
            ))}
            {!records.length && <tr><td colSpan={17} className={cellClass}>暂无符合条件的数据</td></tr>}
          </tbody>
        </table>
      </ZonalTableShell>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto border border-shell-border bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">新增单井注入评价</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm font-bold text-gray-500 hover:text-gray-900">关闭</button>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <input className={inputClass} placeholder="井号" value={form.wellNo} onChange={(event) => updateForm("wellNo", event.target.value)} />
              <select className={inputClass} value={form.unit} onChange={(event) => { updateForm("unit", event.target.value); updateForm("block", ""); }}>
                {FILTER_UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <select className={inputClass} value={form.block} onChange={(event) => updateForm("block", event.target.value)}>
                <option value="">请选择区块</option>
                {getFilterBlockOptions(form.unit).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <input className={inputClass} placeholder="分注工艺" value={form.process} onChange={(event) => updateForm("process", event.target.value)} />
              <input className={inputClass} placeholder="评价单位（默认同作业区）" value={form.unit} readOnly />
              <input type="date" className={inputClass} value={form.evaluationDate} onChange={(event) => updateForm("evaluationDate", event.target.value)} />
              <input type="number" className={inputClass} placeholder="分注层段数" value={form.intervalCount} onChange={(event) => updateForm("intervalCount", event.target.value)} />
              <input type="number" className={inputClass} placeholder="实注层段数" value={form.actualCount} onChange={(event) => updateForm("actualCount", event.target.value)} />
              <input type="number" className={inputClass} placeholder="合格层段数" value={form.qualifiedCount} onChange={(event) => updateForm("qualifiedCount", event.target.value)} />
            </div>
            <div className="mt-4 rounded border border-[#d7e5f3] p-3">
              <div className="mb-2 text-sm font-bold text-[#001a33]">分注不合格层段统计</div>
              <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-6">
                {["小计", "封隔器失效", "欠注", "测调不准", "窜槽", "其它"].map((label, index) => (
                  <input key={label} className={inputClass} placeholder={label} value={form.unqualified[index]} onChange={(event) => updateUnqualified(index, event.target.value)} />
                ))}
              </div>
            </div>
            <textarea className="mt-3 min-h-20 w-full rounded border border-[#b8c8d8] px-3 py-2 text-sm outline-none focus:border-cnpc-blue" placeholder="备注" value={form.remark} onChange={(event) => updateForm("remark", event.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">取消</button>
              <button type="button" onClick={handleSave} disabled={saving} className="rounded bg-cnpc-red px-4 py-2 text-sm font-bold text-white hover:bg-cnpc-red-dark disabled:opacity-60">{saving ? "保存中..." : "保存"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AbnormalWellsPage() {
  const headClass = "whitespace-nowrap border border-[#9fc4e8] bg-[#dcecf9] px-2 py-2 text-center text-sm font-bold leading-tight text-[#001a33]";
  const cellClass = "h-8 whitespace-nowrap border border-[#9fc4e8] bg-white px-2 py-1 text-center text-sm leading-tight text-[#001a33]";
  const selectableCellClass = (selected: boolean) => cn(cellClass, "group-hover:bg-red-50", selected && "bg-red-50");
  const filterClass = "h-6 rounded border border-[#8fb7df] bg-white px-2 text-[12px] text-[#001a33] outline-none";
  const toolButtonClass = "h-6 rounded border border-[#8aaed3] bg-[#e4f0fa] px-3 text-[12px] font-bold text-[#001a33] hover:bg-[#d6e8f8] disabled:cursor-not-allowed disabled:opacity-50";
  const pageSize = 15;
  const [records, setRecords] = useState<AbnormalWellRecord[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({ unit: "", block: "", wellNo: "", category: "", process: "" });
  const [form, setForm] = useState<AbnormalWellForm>(() => createEmptyAbnormalWellForm());
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { confirmDialog, requestConfirm } = useStyledConfirmDialog();
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const displayPage = Math.min(currentPage, totalPages);

  const loadRecords = async (page = currentPage, nextFilters = filters) => {
    setLoading(true);
    setError("");
    try {
      const params = Object.fromEntries(
        Object.entries({ ...nextFilters, page, pageSize }).filter(([, value]) => String(value).trim()),
      );
      const { data } = await axios.get<PaginatedApiResponse<AbnormalWellRecord>>("/api/abnormal-well-records", { params });
      setRecords(data.rows);
      setTotalItems(data.total);
      setCurrentPage(data.page);
      setSelectedId((current) => (data.rows.some((row) => row.id === current) ? current : null));
    } catch (err: any) {
      setError(err?.response?.data?.error || "异常水井记录加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords(1);
  }, []);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const applyFilters = () => {
    void loadRecords(1);
  };

  const goToPage = (page: number) => {
    void loadRecords(Math.min(Math.max(page, 1), totalPages));
  };

  const updateForm = (key: keyof AbnormalWellForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openCreateForm = () => {
    setForm({
      ...createEmptyAbnormalWellForm(),
      unit: filters.unit || "高采采油作业一区",
      block: filters.block,
      wellNo: filters.wellNo,
      category: filters.category || "欠注",
      process: filters.process || "分注",
    });
    setShowForm(true);
    setError("");
  };

  const handleSave = async () => {
    if (!form.category.trim() || !form.wellNo.trim() || !form.block.trim() || !form.unit.trim() || !form.process.trim()) {
      setError("新增异常水井需要填写异常分类、井号、区块、单位和注水工艺");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await axios.post("/api/abnormal-well-records", form);
      setShowForm(false);
      setForm(createEmptyAbnormalWellForm());
      await loadRecords(1);
    } catch (err: any) {
      setError(err?.response?.data?.error || "异常水井记录新增失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const record = records.find((row) => row.id === selectedId);
    if (!record) return;
    requestConfirm(`确认删除 ${record.wellNo} 的异常水井记录？`, async () => {
      try {
        await axios.delete(`/api/abnormal-well-records/${record.id}`);
        setSelectedId(null);
        const nextPage = records.length === 1 && displayPage > 1 ? displayPage - 1 : displayPage;
        await loadRecords(nextPage);
      } catch (err: any) {
        setError(err?.response?.data?.error || "异常水井记录删除失败");
      }
    });
  };

  return (
    <div className="rounded-sm border border-[#9fc4e8] bg-[#f4f8fc] shadow-sm">
      {confirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#9fc4e8] bg-[#f7fbff] px-0 py-2 text-[12px] text-[#001a33]">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1">
            <span>作业区</span>
            <select className={`${filterClass} w-32`} value={filters.unit} onChange={(event) => setFilters((current) => ({ ...current, unit: event.target.value, block: "" }))}>
              <option value="">请选择</option>
              {FILTER_UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span>区块</span>
            <select className={`${filterClass} w-28`} value={filters.block} onChange={(event) => updateFilter("block", event.target.value)}>
              <option value="">请选择</option>
              {getFilterBlockOptions(filters.unit).map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span>井号</span>
            <input className={`${filterClass} w-24`} value={filters.wellNo} onChange={(event) => updateFilter("wellNo", event.target.value)} />
          </label>
          <label className="flex items-center gap-1">
            <span>异常分类</span>
            <select className={`${filterClass} w-24`} value={filters.category} onChange={(event) => updateFilter("category", event.target.value)}>
              <option value="">请选择</option>
              <option>欠注</option>
              <option>封隔器失效</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span>注水工艺</span>
            <select className={`${filterClass} w-24`} value={filters.process} onChange={(event) => updateFilter("process", event.target.value)}>
              <option value="">请选择</option>
              <option>分注</option>
              <option>同心分注</option>
              <option>智能分注</option>
            </select>
          </label>
          <button type="button" onClick={applyFilters} className={toolButtonClass}>确定</button>
          <button type="button" onClick={openCreateForm} className={toolButtonClass}>新增</button>
          <button type="button" disabled={!selectedId} onClick={handleDelete} className={toolButtonClass}>删除</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 whitespace-nowrap pr-2 text-[12px] text-[#001a33]">
          <span>第{displayPage}页 共{totalPages}页 共{totalItems}条</span>
          <button type="button" className="font-bold text-[#0000ee] hover:underline" onClick={() => goToPage(1)}>首页</button>
          <button type="button" className="font-bold text-[#0000ee] hover:underline" onClick={() => goToPage(displayPage - 1)}>上一页</button>
          <button type="button" className="font-bold text-[#0000ee] hover:underline" onClick={() => goToPage(displayPage + 1)}>下一页</button>
          <button type="button" className="font-bold text-[#0000ee] hover:underline" onClick={() => goToPage(totalPages)}>尾页</button>
        </div>
      </div>
      <h1 className="py-2 text-center text-[22px] font-bold leading-none text-[#cc0000]">异常水井列表</h1>
      {error && <div className="border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      <div className="overflow-x-auto border-t border-[#99c7f3] bg-white">
        <table className="w-full min-w-[1180px] table-fixed border-collapse bg-white">
          <colgroup>
            <col className="w-[86px]" />
            <col className="w-[76px]" />
            <col className="w-[76px]" />
            <col className="w-[86px]" />
            <col className="w-[86px]" />
            <col className="w-[128px]" />
            <col className="w-[74px]" />
            <col className="w-[74px]" />
            <col className="w-[122px]" />
            <col className="w-[74px]" />
            <col className="w-[74px]" />
            <col className="w-[74px]" />
            <col className="w-[74px]" />
            <col className="w-[88px]" />
          </colgroup>
          <thead>
            <tr>
              {["异常分类", "井号", "区块", "单位", "注水工艺"].map((header) => (
                <th key={header} rowSpan={2} className={headClass}>{header}</th>
              ))}
              <th colSpan={4} className={headClass}>正常注水状态</th>
              <th colSpan={4} className={headClass}>异常注水状态</th>
              <th rowSpan={2} className={headClass}>建议措施</th>
            </tr>
            <tr>
              {["日注", "油压", "套压", "分层压力", "日注", "油压", "套压", "分层压力"].map((header, index) => (
                <th key={`${header}-${index}`} className={headClass}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={14} className={cellClass}>正在加载...</td></tr>
            ) : records.map((row) => (
              <tr key={row.id} onClick={() => setSelectedId(row.id)} className="group cursor-pointer">
                <td className={selectableCellClass(row.id === selectedId)}>{row.category}</td>
                <td className={selectableCellClass(row.id === selectedId)}>{row.wellNo}</td>
                <td className={selectableCellClass(row.id === selectedId)}>{row.block}</td>
                <td className={selectableCellClass(row.id === selectedId)}>{row.unit}</td>
                <td className={selectableCellClass(row.id === selectedId)}>{row.process}</td>
                <td className={selectableCellClass(row.id === selectedId)}>{row.normalDaily}</td>
                <td className={selectableCellClass(row.id === selectedId)}>{row.normalOilPressure}</td>
                <td className={selectableCellClass(row.id === selectedId)}>{row.normalCasingPressure}</td>
                <td className={selectableCellClass(row.id === selectedId)}>{row.normalLayerPressure}</td>
                <td className={selectableCellClass(row.id === selectedId)}>{row.abnormalDaily}</td>
                <td className={selectableCellClass(row.id === selectedId)}>{row.abnormalOilPressure}</td>
                <td className={selectableCellClass(row.id === selectedId)}>{row.abnormalCasingPressure}</td>
                <td className={selectableCellClass(row.id === selectedId)}>{row.abnormalLayerPressure}</td>
                <td className={selectableCellClass(row.id === selectedId)}>{row.suggestion}</td>
              </tr>
            ))}
            {!loading && !records.length && (
              <tr><td colSpan={14} className={cellClass}>暂无符合条件的数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto border border-shell-border bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">新增异常水井</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm font-bold text-gray-500 hover:text-gray-900">关闭</button>
            </div>
            <div className="grid gap-3 md:grid-cols-5">
              <select className={filterClass} value={form.category} onChange={(event) => updateForm("category", event.target.value)}>
                <option>欠注</option>
                <option>封隔器失效</option>
              </select>
              <input className={filterClass} placeholder="井号" value={form.wellNo} onChange={(event) => updateForm("wellNo", event.target.value)} />
              <select className={filterClass} value={form.unit} onChange={(event) => { updateForm("unit", event.target.value); updateForm("block", ""); }}>
                {FILTER_UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <select className={filterClass} value={form.block} onChange={(event) => updateForm("block", event.target.value)}>
                <option value="">请选择区块</option>
                {getFilterBlockOptions(form.unit).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <select className={filterClass} value={form.process} onChange={(event) => updateForm("process", event.target.value)}>
                <option>分注</option>
                <option>同心分注</option>
                <option>智能分注</option>
              </select>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded border border-[#d7e5f3] p-3">
                <div className="mb-2 text-sm font-bold text-[#001a33]">正常注水状态</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className={filterClass} placeholder="日注" value={form.normalDaily} onChange={(event) => updateForm("normalDaily", event.target.value)} />
                  <input className={filterClass} placeholder="油压" value={form.normalOilPressure} onChange={(event) => updateForm("normalOilPressure", event.target.value)} />
                  <input className={filterClass} placeholder="套压" value={form.normalCasingPressure} onChange={(event) => updateForm("normalCasingPressure", event.target.value)} />
                  <input className={filterClass} placeholder="分层压力" value={form.normalLayerPressure} onChange={(event) => updateForm("normalLayerPressure", event.target.value)} />
                </div>
              </div>
              <div className="rounded border border-[#d7e5f3] p-3">
                <div className="mb-2 text-sm font-bold text-[#001a33]">异常注水状态</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className={filterClass} placeholder="日注" value={form.abnormalDaily} onChange={(event) => updateForm("abnormalDaily", event.target.value)} />
                  <input className={filterClass} placeholder="油压" value={form.abnormalOilPressure} onChange={(event) => updateForm("abnormalOilPressure", event.target.value)} />
                  <input className={filterClass} placeholder="套压" value={form.abnormalCasingPressure} onChange={(event) => updateForm("abnormalCasingPressure", event.target.value)} />
                  <input className={filterClass} placeholder="分层压力" value={form.abnormalLayerPressure} onChange={(event) => updateForm("abnormalLayerPressure", event.target.value)} />
                </div>
              </div>
            </div>
            <textarea className="mt-3 min-h-20 w-full rounded border border-[#b8c8d8] px-3 py-2 text-sm outline-none focus:border-cnpc-blue" placeholder="建议措施" value={form.suggestion} onChange={(event) => updateForm("suggestion", event.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">取消</button>
              <button type="button" onClick={handleSave} disabled={saving} className="rounded bg-cnpc-red px-4 py-2 text-sm font-bold text-white hover:bg-cnpc-red-dark disabled:opacity-60">{saving ? "保存中..." : "保存"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SINGLE_WELL_SEAL_EVALUATION_TEMPLATE_ROWS = [
  { wellNo: "雷19-10", process: "同心分注", intervalCount: 4, actualCount: 4, date: "2026-05-10", needSealCount: 3, qualifiedSealCount: 2, sealStats: ["合格", "不合格", "合格", "-", "-"] },
  { wellNo: "雷20-12侧", process: "智能分注", intervalCount: 4, actualCount: 4, date: "2026-05-08", needSealCount: 3, qualifiedSealCount: 3, sealStats: ["合格", "合格", "合格", "-", "-"] },
  { wellNo: "雷21-8", process: "桥式同心", intervalCount: 3, actualCount: 3, date: "2026-05-06", needSealCount: 2, qualifiedSealCount: 1, sealStats: ["待核实", "合格", "-", "-", "-"] },
];

const SINGLE_WELL_SEAL_EVALUATION_ROWS = Array.from({ length: 38 }, (_, index) => {
  const template = SINGLE_WELL_SEAL_EVALUATION_TEMPLATE_ROWS[index % SINGLE_WELL_SEAL_EVALUATION_TEMPLATE_ROWS.length];
  const date = new Date(2026, 4, 10 - index);
  return {
    ...template,
    wellNo: `${template.wellNo}-${String(index + 1).padStart(2, "0")}`,
    date: date.toISOString().slice(0, 10),
  };
});

function SingleWellSealEvaluationPage() {
  const headClass = "border border-[#9fc4e8] bg-[#e3f0fb] px-2 py-2 text-center text-sm font-bold leading-tight text-[#001a33]";
  const cellClass = "border border-[#9fc4e8] bg-white px-2 py-2 text-center text-sm text-[#001a33]";
  const inputClass = "h-6 rounded border border-[#8fb7df] bg-white px-2 text-[12px] text-[#001a33] outline-none";
  const toolButtonClass = "h-6 rounded border border-[#8aaed3] bg-[#e4f0fa] px-3 text-[12px] font-bold text-[#001a33] hover:bg-[#d6e8f8]";
  const pageSize = 15;
  const [records, setRecords] = useState<SingleWellSealEvaluationRecord[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState({ unit: "", block: "", process: "", wellNo: "" });
  const [form, setForm] = useState<SingleWellSealEvaluationForm>(() => createEmptySingleWellSealEvaluationForm());
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { confirmDialog, requestConfirm } = useStyledConfirmDialog();

  const loadRecords = async (page = currentPage, nextFilters = filters) => {
    try {
      setError("");
      const params = Object.fromEntries(Object.entries({ ...nextFilters, page, pageSize }).filter(([, value]) => String(value).trim()));
      const { data } = await axios.get<PaginatedApiResponse<SingleWellSealEvaluationRecord>>("/api/single-well-seal-evaluations", { params });
      setRecords(data.rows);
      setTotalItems(data.total);
      setCurrentPage(data.page);
      setSelectedId((current) => (data.rows.some((row) => row.id === current) ? current : null));
    } catch (err: any) {
      setError(err?.response?.data?.error || "单井密封评价加载失败");
    }
  };

  useEffect(() => {
    void loadRecords(1);
  }, []);

  const updateForm = (key: keyof SingleWellSealEvaluationForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateSealStats = (index: number, value: string) => {
    setForm((current) => ({
      ...current,
      sealStats: current.sealStats.map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  };

  const openCreateForm = () => {
    setForm({ ...createEmptySingleWellSealEvaluationForm(), wellNo: filters.wellNo, process: filters.process, unit: filters.unit || "\u9ad8\u91c7\u91c7\u6cb9\u4f5c\u4e1a\u4e00\u533a", block: filters.block });
    setShowForm(true);
    setError("");
  };

  const handleSave = async () => {
    if (!form.unit.trim() || !form.block.trim() || !form.wellNo.trim() || !form.process.trim() || !form.evaluationDate) {
      setError("请填写作业区、区块、井号、分注工艺和评价日期");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await axios.post("/api/single-well-seal-evaluations", form);
      setShowForm(false);
      setForm(createEmptySingleWellSealEvaluationForm());
      await loadRecords(1);
    } catch (err: any) {
      setError(err?.response?.data?.error || "单井密封评价新增失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const record = records.find((row) => row.id === selectedId);
    if (!record) return;
    requestConfirm(`确认删除 ${record.wellNo} 的单井密封评价？`, async () => {
      try {
        await axios.delete(`/api/single-well-seal-evaluations/${record.id}`);
        setSelectedId(null);
        await loadRecords(records.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage);
      } catch (err: any) {
        setError(err?.response?.data?.error || "单井密封评价删除失败");
      }
    });
  };

  const toolbar = (
    <>
      <span>作业区</span><select className="h-6 w-36 border px-1" value={filters.unit} onChange={(event) => setFilters({ ...filters, unit: event.target.value, block: "" })}><option value="">请选择</option>{FILTER_UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}</select>
      <span>区块</span><select className="h-6 w-28 border px-1" value={filters.block} onChange={(event) => setFilters({ ...filters, block: event.target.value })}><option value="">请选择</option>{getFilterBlockOptions(filters.unit).map((option) => <option key={option} value={option}>{option}</option>)}</select>
      <span>工艺</span><input className="h-6 w-24 border px-1" value={filters.process} onChange={(event) => setFilters({ ...filters, process: event.target.value })} />
      <button className={toolButtonClass} onClick={() => loadRecords(1)}>确定</button>
      <button className={toolButtonClass} onClick={openCreateForm}>新增</button>
      <button className={`${toolButtonClass} disabled:cursor-not-allowed disabled:opacity-50`} disabled={!selectedId} onClick={handleDelete}>删除</button>
      {error && <span className="text-red-600">{error}</span>}
    </>
  );

  return (
    <div>
      {confirmDialog}
      <ZonalTableShell title="单井密封评价" filterMode="single-seal" toolbar={toolbar} currentPage={currentPage} pageSize={pageSize} totalItems={totalItems} onPageChange={(page) => loadRecords(page)}>
        <table className="w-full min-w-[1160px] border-collapse bg-white">
          <thead>
            <tr>
              {["\u5e8f\u53f7", "\u4e95\u53f7", "\u4f5c\u4e1a\u533a", "\u533a\u5757", "\u5206\u6ce8\u5de5\u827a", "\u5206\u6ce8\u5c42\u6bb5\u6570", "\u5b9e\u6ce8\u5c42\u6bb5\u6570", "\u8bc4\u4ef7\u65e5\u671f", "\u9700\u8bc4\u4ef7\u5bc6\u5c01\u4f4d\u7f6e\u6570", "\u5bc6\u5c01\u5408\u683c\u4f4d\u7f6e\u6570"].map((header) => (
                <th key={header} rowSpan={2} className={headClass}>{header}</th>
              ))}
              <th colSpan={4} className={headClass}>{"\u5c01\u9694\u5668\u5bc6\u5c01\u7edf\u8ba1"}</th>
            </tr>
            <tr>
              {["\u4e00\u5c42\u4e0e\u4e8c\u5c42\u95f4", "\u4e8c\u5c42\u4e0e\u4e09\u5c42\u95f4", "\u4e09\u5c42\u4e0e\u56db\u5c42\u95f4", "\u56db\u5c42\u4e0e\u4e94\u5c42\u95f4"].map((header) => (
                <th key={header} className={headClass}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((row, index) => (
              <tr key={row.id} className="cursor-pointer" onClick={() => setSelectedId(row.id)}>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{(currentPage - 1) * pageSize + index + 1}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.wellNo}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.unit}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.block}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.process}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.intervalCount}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.actualCount}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{apiDateOnly(row.evaluationDate)}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.needSealCount}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.qualifiedSealCount}</td>
                {row.sealStats.slice(0, 4).map((value, valueIndex) => (
                  <td key={valueIndex} className={selectedTableCellClass(cellClass, row.id === selectedId)}>{value}</td>
                ))}
              </tr>
            ))}
            {!records.length && <tr><td colSpan={14} className={cellClass}>暂无符合条件的数据</td></tr>}
          </tbody>
        </table>
      </ZonalTableShell>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto border border-shell-border bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">新增单井密封评价</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm font-bold text-gray-500 hover:text-gray-900">关闭</button>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <input className={inputClass} placeholder="井号" value={form.wellNo} onChange={(event) => updateForm("wellNo", event.target.value)} />
              <select className={inputClass} value={form.unit} onChange={(event) => { updateForm("unit", event.target.value); updateForm("block", ""); }}>
                {FILTER_UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <select className={inputClass} value={form.block} onChange={(event) => updateForm("block", event.target.value)}>
                <option value="">请选择区块</option>
                {getFilterBlockOptions(form.unit).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <input className={inputClass} placeholder="分注工艺" value={form.process} onChange={(event) => updateForm("process", event.target.value)} />
              <input type="date" className={inputClass} value={form.evaluationDate} onChange={(event) => updateForm("evaluationDate", event.target.value)} />
              <input type="number" className={inputClass} placeholder="分注层段数" value={form.intervalCount} onChange={(event) => updateForm("intervalCount", event.target.value)} />
              <input type="number" className={inputClass} placeholder="实注层段数" value={form.actualCount} onChange={(event) => updateForm("actualCount", event.target.value)} />
              <input type="number" className={inputClass} placeholder="需评价密封位置数" value={form.needSealCount} onChange={(event) => updateForm("needSealCount", event.target.value)} />
              <input type="number" className={inputClass} placeholder="密封合格位置数" value={form.qualifiedSealCount} onChange={(event) => updateForm("qualifiedSealCount", event.target.value)} />
            </div>
            <div className="mt-4 rounded border border-[#d7e5f3] p-3">
              <div className="mb-2 text-sm font-bold text-[#001a33]">封隔器密封统计</div>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                {["一层与二层间", "二层与三层间", "三层与四层间", "四层与五层间"].map((label, index) => (
                  <input key={label} className={inputClass} placeholder={label} value={form.sealStats[index]} onChange={(event) => updateSealStats(index, event.target.value)} />
                ))}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">取消</button>
              <button type="button" onClick={handleSave} disabled={saving} className="rounded bg-cnpc-red px-4 py-2 text-sm font-bold text-white hover:bg-cnpc-red-dark disabled:opacity-60">{saving ? "保存中..." : "保存"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const ZONAL_INDICATOR_SUMMARY_ROWS = [
  { category: "地面定量", process: "油套", wellCount: 12, processRate: "18.5%", intervalCount: 36, actualCount: 35, level: "二级", segmentSeal: ["18", "17", "94.4%", "16", "88.9%"], fullSeal: ["12", "100%", "10", "83.3%"], allocation: ["35", "97.2%", "3", "32", "91.4%"] },
  { category: "地面定量", process: "同心双管", wellCount: 8, processRate: "12.3%", intervalCount: 24, actualCount: 24, level: "二级", segmentSeal: ["12", "12", "100%", "11", "91.7%"], fullSeal: ["8", "100%", "7", "87.5%"], allocation: ["24", "100%", "2", "22", "91.7%"] },
  { category: "地面定量", process: "同心三管", wellCount: 6, processRate: "9.2%", intervalCount: 24, actualCount: 23, level: "三级", segmentSeal: ["10", "9", "90.0%", "8", "80.0%"], fullSeal: ["6", "100%", "5", "83.3%"], allocation: ["23", "95.8%", "3", "20", "87.0%"] },
  { category: "地面定量", process: "小计", wellCount: 26, processRate: "40.0%", intervalCount: 84, actualCount: 82, level: "-", segmentSeal: ["40", "38", "95.0%", "35", "87.5%"], fullSeal: ["26", "100%", "22", "84.6%"], allocation: ["82", "97.6%", "8", "74", "90.2%"] },
  { category: "地下测调", process: "桥式同心", wellCount: 16, processRate: "24.6%", intervalCount: 48, actualCount: 47, level: "一级", segmentSeal: ["24", "23", "95.8%", "22", "91.7%"], fullSeal: ["16", "100%", "15", "93.8%"], allocation: ["47", "97.9%", "2", "45", "95.7%"] },
  { category: "地下测调", process: "智能有缆", wellCount: 14, processRate: "21.5%", intervalCount: 56, actualCount: 55, level: "一级", segmentSeal: ["28", "27", "96.4%", "26", "92.9%"], fullSeal: ["14", "100%", "13", "92.9%"], allocation: ["55", "98.2%", "3", "52", "94.5%"] },
  { category: "地下测调", process: "智能无缆", wellCount: 9, processRate: "13.9%", intervalCount: 36, actualCount: 35, level: "二级", segmentSeal: ["18", "17", "94.4%", "16", "88.9%"], fullSeal: ["9", "100%", "8", "88.9%"], allocation: ["35", "97.2%", "3", "32", "91.4%"] },
  { category: "地下测调", process: "小计", wellCount: 39, processRate: "60.0%", intervalCount: 140, actualCount: 137, level: "-", segmentSeal: ["70", "67", "95.7%", "64", "91.4%"], fullSeal: ["39", "100%", "36", "92.3%"], allocation: ["137", "97.9%", "8", "129", "94.2%"] },
  { category: "合计", process: "合计", wellCount: 65, processRate: "100%", intervalCount: 224, actualCount: 219, level: "-", segmentSeal: ["110", "105", "95.5%", "99", "90.0%"], fullSeal: ["65", "100%", "58", "89.2%"], allocation: ["219", "97.8%", "16", "203", "92.7%"] },
];

function ZonalIndicatorSummaryPage() {
  const headClass = "border border-[#9fc4e8] bg-[#e3f0fb] px-1.5 py-2 text-center text-xs font-bold leading-tight text-[#001a33]";
  const cellClass = "border border-[#9fc4e8] bg-white px-2 py-1.5 text-center text-sm text-[#001a33]";
  const [records, setRecords] = useState<ZonalIndicatorSummaryRecord[]>([]);
  const [filters, setFilters] = useState({ category: "", process: "" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { confirmDialog, requestConfirm } = useStyledConfirmDialog();

  const loadRecords = async (nextFilters = filters) => {
    try {
      setError("");
      const params = Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => String(value).trim()));
      const { data } = await axios.get<{ rows: ZonalIndicatorSummaryRecord[]; total: number }>("/api/zonal-indicator-summaries", { params });
      setRecords(data.rows);
      setSelectedId((current) => (data.rows.some((row) => row.id === current) ? current : null));
    } catch (err: any) {
      setError(err?.response?.data?.error || "分注指标汇总加载失败");
    }
  };

  useEffect(() => {
    void loadRecords();
  }, []);

  const handleDelete = async () => {
    const record = records.find((row) => row.id === selectedId);
    if (!record) return;
    requestConfirm(`确认删除 ${record.category}/${record.process}？`, async () => {
      try {
        await axios.delete(`/api/zonal-indicator-summaries/${record.id}`);
        setSelectedId(null);
        await loadRecords();
      } catch (err: any) {
        setError(err?.response?.data?.error || "分注指标汇总删除失败");
      }
    });
  };

  return (
    <div>
      {confirmDialog}
      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-sm border border-[#9fc4e8] bg-[#f7fbff] px-2 py-2 text-[12px]">
        <span>分类</span><input className="h-6 w-24 border px-1" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })} />
        <span>工艺</span><input className="h-6 w-24 border px-1" value={filters.process} onChange={(event) => setFilters({ ...filters, process: event.target.value })} />
        <button className="h-6 rounded border bg-[#e4f0fa] px-3 font-bold" onClick={() => loadRecords()}>确定</button>
        <button className="h-6 rounded border bg-[#e4f0fa] px-3 font-bold disabled:opacity-50" disabled={!selectedId} onClick={handleDelete}>删除</button>
        <span>共{records.length}条</span>
        {error && <span className="text-red-600">{error}</span>}
      </div>
      <ZonalTableShell title="分注指标汇总" filterMode="zonal-summary" showFilters={false} showPagination={false} showTitle={false}>
        <table className="w-full min-w-[1560px] border-collapse bg-white">
          <thead>
            <tr>
              <th colSpan={22} className="border border-[#9fc4e8] bg-[#f7fbff] px-2 py-2 text-center text-[22px] font-bold leading-none text-[#cc0000]">
                分注指标汇总
              </th>
            </tr>
            <tr>
              {["水井总数", "分类", "分注工艺", "分注井数", "分注工艺占比", "分注层段数", "实注层段数", "分注级别"].map((header) => (
                <th key={header} rowSpan={2} className={headClass}>{header}</th>
              ))}
              <th colSpan={5} className={headClass}>层段间封隔器密封统计(不含保护封)</th>
              <th colSpan={4} className={headClass}>全井封隔器密封统计</th>
              <th colSpan={5} className={headClass}>分层配注合格率统计</th>
            </tr>
            <tr>
              {[
                "封隔器总个数",
                "核实个数",
                "核实占比",
                "合格个数",
                "层段密封合格率",
                "核实井数",
                "核实占比",
                "合格井数",
                "全井密封合格率",
                "核实层数",
                "核实占比",
                "不合格层数",
                "合格层数",
                "配注合格率",
              ].map((header) => (
                <th key={header} className={headClass}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((row, rowIndex) => (
              <tr key={row.id} className="cursor-pointer" onClick={() => setSelectedId(row.id)}>
                {rowIndex === 0 && <td rowSpan={records.length || 1} className={selectedTableCellClass(cellClass, row.id === selectedId)}>65</td>}
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.category}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.process}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.wellCount}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.processRate}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.intervalCount}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.actualCount}</td>
                <td className={selectedTableCellClass(cellClass, row.id === selectedId)}>{row.level}</td>
                {[...row.segmentSeal, ...row.fullSeal, ...row.allocation].map((value, valueIndex) => (
                  <td key={valueIndex} className={selectedTableCellClass(cellClass, row.id === selectedId)}>{value}</td>
                ))}
              </tr>
            ))}
            {!records.length && <tr><td colSpan={22} className={cellClass}>暂无符合条件的数据</td></tr>}
          </tbody>
        </table>
      </ZonalTableShell>
    </div>
  );
}

function IndicatorCurvePage() {
  const headers = ["单位", "区块", "井号", "测试日期", "测试井段", "日注1", "压力1", "日注2", "压力2", "日注3", "压力3", "日注4", "压力4", "日注5", "压力5"];
  const pageSize = 15;
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const createEmptyIndicatorCurveForm = (): IndicatorCurveForm => ({
    unit: FILTER_UNIT_OPTIONS[0],
    block: "",
    wellNo: "",
    testDate: new Date().toISOString().slice(0, 10),
    testInterval: "Ⅰ-Ⅱ",
    injection1: "",
    pressure1: "",
    injection2: "",
    pressure2: "",
    injection3: "",
    pressure3: "",
    injection4: "",
    pressure4: "",
    injection5: "",
    pressure5: "",
  });
  const [records, setRecords] = useState<IndicatorCurveRecord[]>([]);
  const [chartRecords, setChartRecords] = useState<IndicatorCurveRecord[]>([]);
  const [optionRecords, setOptionRecords] = useState<IndicatorCurveRecord[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPage, setJumpPage] = useState("1");
  const [filters, setFilters] = useState<IndicatorCurveFilters>({ wellNo: "", testDate: "", testInterval: "" });
  const [appliedFilters, setAppliedFilters] = useState<IndicatorCurveFilters>({ wellNo: "", testDate: "", testInterval: "" });
  const [selectedCurveIds, setSelectedCurveIds] = useState<string[]>([]);
  const [curveDialogPosition, setCurveDialogPosition] = useState<{ x: number; y: number } | null>(null);
  const curveDragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState<IndicatorCurveForm>(() => createEmptyIndicatorCurveForm());
  const { confirmDialog, requestConfirm } = useStyledConfirmDialog();
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const queryParams = (page: number, size: number) => ({
    page,
    pageSize: size,
    wellNo: appliedFilters.wellNo || undefined,
    testInterval: appliedFilters.testInterval || undefined,
    fromDate: appliedFilters.testDate || undefined,
    toDate: appliedFilters.testDate || undefined,
  });
  const wellOptions = useMemo(() => Array.from(new Set(optionRecords.map((row) => row.wellNo))).sort(), [optionRecords]);
  const dateOptions = useMemo(() => Array.from(new Set(optionRecords.map((row) => String(row.testDate).slice(0, 10)))).sort().reverse(), [optionRecords]);
  const intervalOptions = useMemo(() => Array.from(new Set(optionRecords.map((row) => row.testInterval))).sort(), [optionRecords]);
  const hasAppliedFilters = Boolean(appliedFilters.wellNo || appliedFilters.testDate || appliedFilters.testInterval);
  const selectedCurveRecords = useMemo(
    () => selectedCurveIds
      .map((id) => records.find((row) => row.id === id) || chartRecords.find((row) => row.id === id))
      .filter((row): row is IndicatorCurveRecord => Boolean(row)),
    [chartRecords, records, selectedCurveIds],
  );
  const displayedChartRecords = selectedCurveRecords;
  const chartSeries = useMemo(() => displayedChartRecords.map((row) => ({
    id: row.id,
    name: `${row.wellNo} / ${String(row.testDate).slice(0, 10)} / ${row.testInterval}`,
    points: [
      { injection: row.injection1, pressure: row.pressure1 },
      { injection: row.injection2, pressure: row.pressure2 },
      { injection: row.injection3, pressure: row.pressure3 },
      { injection: row.injection4, pressure: row.pressure4 },
      { injection: row.injection5, pressure: row.pressure5 },
    ].sort((a, b) => a.injection - b.injection),
  })), [displayedChartRecords]);
  const chartDomains = useMemo(() => {
    const points = chartSeries.flatMap((series) => series.points);
    if (!points.length) {
      return { x: [0, 100] as [number, number], y: [0, 20] as [number, number] };
    }
    const injections = points.map((point) => point.injection);
    const pressures = points.map((point) => point.pressure);
    const getDomain = (values: number[], minPadding: number): [number, number] => {
      const min = Math.min(...values);
      const max = Math.max(...values);
      const span = Math.max(max - min, minPadding);
      const padding = Math.max(span * 0.1, minPadding);
      return [Math.max(0, Number((min - padding).toFixed(1))), Number((max + padding).toFixed(1))];
    };
    return {
      x: getDomain(injections, 5),
      y: getDomain(pressures, 1),
    };
  }, [chartSeries]);
  const chartColors = ["#d7000f", "#005bac", "#00a56a", "#8b5cf6", "#f97316", "#0f766e", "#7c2d12", "#1d4ed8"];
  const toVisibleRow = (row: IndicatorCurveRecord) => [
    row.unit,
    row.block,
    row.wellNo,
    String(row.testDate).slice(0, 10),
    row.testInterval,
    row.injection1.toFixed(1),
    row.pressure1.toFixed(1),
    row.injection2.toFixed(1),
    row.pressure2.toFixed(1),
    row.injection3.toFixed(1),
    row.pressure3.toFixed(1),
    row.injection4.toFixed(1),
    row.pressure4.toFixed(1),
    row.injection5.toFixed(1),
    row.pressure5.toFixed(1),
  ];
  const goToPage = (page: number) => {
    const nextPage = Math.min(totalPages, Math.max(1, page));
    setCurrentPage(nextPage);
    setJumpPage(String(nextPage));
  };
  const applyFilters = () => {
    setAppliedFilters(filters);
    setSelectedCurveIds([]);
    setCurrentPage(1);
    setJumpPage("1");
  };
  const handleCurveRowClick = (recordId: string) => {
    setSelectedCurveIds((current) => (current.includes(recordId) ? current.filter((id) => id !== recordId) : [...current, recordId]));
  };
  const handleCurveDialogPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const dialog = event.currentTarget.closest('[data-indicator-curve-dialog="true"]') as HTMLDivElement | null;
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    curveDragOffsetRef.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    setCurveDialogPosition({ x: rect.left, y: rect.top });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const offset = curveDragOffsetRef.current;
      if (!offset) return;
      const minY = 88;
      const maxX = Math.max(0, window.innerWidth - rect.width);
      const maxY = Math.max(minY, window.innerHeight - rect.height);
      setCurveDialogPosition({
        x: Math.min(Math.max(0, moveEvent.clientX - offset.x), maxX),
        y: Math.min(Math.max(minY, moveEvent.clientY - offset.y), maxY),
      });
    };
    const handlePointerUp = () => {
      curveDragOffsetRef.current = null;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };
  const selectedDeleteRecord = selectedCurveIds.length === 1
    ? records.find((row) => row.id === selectedCurveIds[0]) || chartRecords.find((row) => row.id === selectedCurveIds[0]) || null
    : null;
  const openCreateForm = () => {
    setForm(createEmptyIndicatorCurveForm());
    setFormError("");
    setShowForm(true);
  };
  const updateForm = (key: keyof IndicatorCurveForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const handleCreate = async () => {
    const required = [form.unit, form.block, form.wellNo, form.testDate, form.testInterval];
    const numericValues = [
      form.injection1,
      form.pressure1,
      form.injection2,
      form.pressure2,
      form.injection3,
      form.pressure3,
      form.injection4,
      form.pressure4,
      form.injection5,
      form.pressure5,
    ];
    if (required.some((value) => !value.trim()) || numericValues.some((value) => !value.trim() || !Number.isFinite(Number(value)))) {
      setFormError("请完整填写单位、区块、井号、测试日期、测试井段，以及 5 组日注/压力数值");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      await axios.post("/api/indicator-curve-records", form);
      setShowForm(false);
      setForm(createEmptyIndicatorCurveForm());
      setSelectedCurveIds([]);
      setCurrentPage(1);
      setJumpPage("1");
      const optionResponse = await axios.get<{ rows: IndicatorCurveRecord[] }>("/api/indicator-curve-records", { params: { page: 1, pageSize: 200 } });
      const pageResponse = await axios.get<{ rows: IndicatorCurveRecord[]; total: number }>("/api/indicator-curve-records", { params: queryParams(1, pageSize) });
      const chartResponse = await axios.get<{ rows: IndicatorCurveRecord[] }>("/api/indicator-curve-records", { params: queryParams(1, 200) });
      setOptionRecords(optionResponse.data.rows);
      setRecords(pageResponse.data.rows);
      setTotalRows(pageResponse.data.total);
      setChartRecords(chartResponse.data.rows);
    } catch (err: any) {
      setFormError(err?.response?.data?.error || "指示曲线记录新增失败");
    } finally {
      setSaving(false);
    }
  };
  const refreshIndicatorCurveData = async (page = currentPage) => {
    const [optionResponse, pageResponse, chartResponse] = await Promise.all([
      axios.get<{ rows: IndicatorCurveRecord[] }>("/api/indicator-curve-records", { params: { page: 1, pageSize: 200 } }),
      axios.get<{ rows: IndicatorCurveRecord[]; total: number }>("/api/indicator-curve-records", { params: queryParams(page, pageSize) }),
      axios.get<{ rows: IndicatorCurveRecord[] }>("/api/indicator-curve-records", { params: queryParams(1, 200) }),
    ]);
    setOptionRecords(optionResponse.data.rows);
    setRecords(pageResponse.data.rows);
    setTotalRows(pageResponse.data.total);
    setChartRecords(chartResponse.data.rows);
  };
  const handleDelete = (record: IndicatorCurveRecord) => {
    requestConfirm(`确认删除 ${record.wellNo} ${String(record.testDate).slice(0, 10)} ${record.testInterval} 的指示曲线记录？`, async () => {
      setFormError("");
      try {
        await axios.delete(`/api/indicator-curve-records/${record.id}`);
        setSelectedCurveIds([]);
        const nextPage = records.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
        setCurrentPage(nextPage);
        setJumpPage(String(nextPage));
        await refreshIndicatorCurveData(nextPage);
      } catch (err: any) {
        setFormError(err?.response?.data?.error || "指示曲线记录删除失败");
      }
    });
  };
  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    setImportStatus("");
    setFormError("");
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error("Excel 文件中没有可导入的工作表");
      }
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "" });
      const parsedRows = rows
        .map((row) => ({
          unit: String(readExcelCell(row, ["单位"])).trim(),
          block: String(readExcelCell(row, ["区块"])).trim(),
          wellNo: String(readExcelCell(row, ["井号"])).trim(),
          testDate: formatExcelDate(readExcelCell(row, ["测试日期", "日期"])),
          testInterval: String(readExcelCell(row, ["测试井段", "井段"])).trim(),
          injection1: String(readExcelCell(row, ["日注1"])).trim(),
          pressure1: String(readExcelCell(row, ["压力1"])).trim(),
          injection2: String(readExcelCell(row, ["日注2"])).trim(),
          pressure2: String(readExcelCell(row, ["压力2"])).trim(),
          injection3: String(readExcelCell(row, ["日注3"])).trim(),
          pressure3: String(readExcelCell(row, ["压力3"])).trim(),
          injection4: String(readExcelCell(row, ["日注4"])).trim(),
          pressure4: String(readExcelCell(row, ["压力4"])).trim(),
          injection5: String(readExcelCell(row, ["日注5"])).trim(),
          pressure5: String(readExcelCell(row, ["压力5"])).trim(),
        }))
        .filter((row) => row.unit || row.block || row.wellNo || row.testDate || row.testInterval);

      if (!parsedRows.length) {
        throw new Error("未读取到可导入的数据，请确认表头包含单位、区块、井号、测试日期、测试井段、日注1-5、压力1-5");
      }

      const { data } = await axios.post<{ imported: number; skipped: number }>("/api/indicator-curve-records/import", { rows: parsedRows });
      setImportStatus(`已导入 ${data.imported} 条${data.skipped ? `，跳过重复 ${data.skipped} 条` : ""}`);
      setSelectedCurveIds([]);
      setCurrentPage(1);
      setJumpPage("1");
      await refreshIndicatorCurveData(1);
    } catch (err: any) {
      setFormError(err?.response?.data?.error || err?.message || "Excel 导入失败");
    } finally {
      setImporting(false);
    }
  };
  const handleDownloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([
      {
        "单位": "高采采油作业一区",
        "区块": "区块1",
        "井号": "GS-201",
        "测试日期": "2026-05-24",
        "测试井段": "Ⅰ-Ⅱ",
        "日注1": 18,
        "压力1": 7.8,
        "日注2": 24,
        "压力2": 8.6,
        "日注3": 30,
        "压力3": 9.3,
        "日注4": 36,
        "压力4": 10.1,
        "日注5": 42,
        "压力5": 10.8,
      },
      {
        "单位": "高采采油作业一区",
        "区块": "区块1",
        "井号": "GS-201",
        "测试日期": "2026-05-27",
        "测试井段": "Ⅱ-Ⅲ",
        "日注1": 20,
        "压力1": 8.0,
        "日注2": 26,
        "压力2": 8.9,
        "日注3": 32,
        "压力3": 9.7,
        "日注4": 38,
        "压力4": 10.5,
        "日注5": 44,
        "压力5": 11.2,
      },
    ]);
    worksheet["!cols"] = [
      { wch: 16 },
      { wch: 10 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      ...Array.from({ length: 10 }, () => ({ wch: 10 })),
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "指示曲线导入模板");
    XLSX.writeFile(workbook, "指示曲线导入模板.xlsx");
  };
  useEffect(() => {
    axios
      .get<{ rows: IndicatorCurveRecord[] }>("/api/indicator-curve-records", { params: { page: 1, pageSize: 200 } })
      .then(({ data }) => setOptionRecords(data.rows))
      .catch(() => setOptionRecords([]));
  }, []);
  useEffect(() => {
    axios
      .get<{ rows: IndicatorCurveRecord[]; total: number }>("/api/indicator-curve-records", {
        params: queryParams(currentPage, pageSize),
      })
      .then(({ data }) => {
        setRecords(data.rows);
        setTotalRows(data.total);
      })
      .catch(() => {
        setRecords([]);
        setTotalRows(0);
      });
  }, [currentPage, appliedFilters]);
  useEffect(() => {
    setSelectedCurveIds((current) => current.filter((id) => records.some((row) => row.id === id)));
  }, [records]);
  useEffect(() => {
    axios
      .get<{ rows: IndicatorCurveRecord[] }>("/api/indicator-curve-records", {
        params: queryParams(1, 200),
      })
      .then(({ data }) => setChartRecords(data.rows))
      .catch(() => setChartRecords([]));
  }, [appliedFilters]);
  const filterClass = "h-6 rounded border border-[#8aaed3] bg-white px-2 text-[12px] text-[#001a33] outline-none";
  const headClass = "h-9 border border-[#99c7f3] bg-[#dceefc] px-2 text-center text-[13px] font-bold leading-tight text-[#001a33]";
  const cellClass = "h-9 border border-[#99c7f3] bg-white px-2 text-center text-[13px] leading-tight text-[#001a33]";
  const selectableCellClass = (selected: boolean) => cn(cellClass, "group-hover:!bg-red-50", selected && "!bg-red-50 text-red-700");

  return (
    <div className="rounded border border-[#9fc3e7] bg-[#f8fbff] shadow-[0_1px_3px_rgba(64,128,191,0.25)]">
      {confirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-2 py-1 text-[12px] text-[#001a33]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <label className="flex items-center gap-1">
            <span>井号</span>
            <select className={`${filterClass} w-24`} value={filters.wellNo} onChange={(event) => setFilters((prev) => ({ ...prev, wellNo: event.target.value }))}>
              <option value="">全部</option>
              {wellOptions.map((wellNo) => (
                <option key={wellNo} value={wellNo}>{wellNo}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span>测试日期</span>
            <select className={`${filterClass} w-32`} value={filters.testDate} onChange={(event) => setFilters((prev) => ({ ...prev, testDate: event.target.value }))}>
              <option value="">全部</option>
              {dateOptions.map((testDate) => (
                <option key={testDate} value={testDate}>{testDate}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span>测试井段</span>
            <select className={`${filterClass} w-24`} value={filters.testInterval} onChange={(event) => setFilters((prev) => ({ ...prev, testInterval: event.target.value }))}>
              <option value="">全部</option>
              {intervalOptions.map((testInterval) => (
                <option key={testInterval} value={testInterval}>{testInterval}</option>
              ))}
            </select>
          </label>
          <button type="button" onClick={applyFilters} className="h-6 rounded border border-[#8aaed3] bg-[#d8e7f5] px-4 text-[12px] font-bold text-[#001a33] hover:bg-[#cfe1f2]">
            确定
          </button>
          <button type="button" onClick={openCreateForm} className="h-6 rounded border border-[#8aaed3] bg-[#e4f0fa] px-4 text-[12px] font-bold text-[#001a33] hover:bg-[#d6e8f8]">
            新增
          </button>
          <button
            type="button"
            disabled={!selectedDeleteRecord}
            onClick={() => selectedDeleteRecord && handleDelete(selectedDeleteRecord)}
            className="h-6 rounded border border-[#8aaed3] bg-[#e4f0fa] px-4 text-[12px] font-bold text-[#001a33] hover:bg-[#d6e8f8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            删除
          </button>
          <input ref={excelInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelImport} />
          <button type="button" disabled={importing} onClick={() => excelInputRef.current?.click()} className="h-6 rounded border border-[#8aaed3] bg-[#e4f0fa] px-3 text-[12px] font-bold text-[#001a33] hover:bg-[#d6e8f8] disabled:opacity-50">
            {importing ? "导入中" : "Excel导入"}
          </button>
          <button type="button" onClick={handleDownloadTemplate} className="h-6 rounded border border-[#8aaed3] bg-[#e4f0fa] px-3 text-[12px] font-bold text-[#001a33] hover:bg-[#d6e8f8]">
            模板下载
          </button>
          {importStatus && <span className="text-[12px] font-bold text-emerald-600">{importStatus}</span>}
          {formError && !showForm && <span className="text-[12px] font-bold text-red-600">{formError}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2 whitespace-nowrap text-[12px] text-[#001a33]">
          <span>第{currentPage}页 共{totalPages}页 共{totalRows}条</span>
          <button type="button" onClick={() => goToPage(1)} className="font-bold text-[#0000ee] hover:underline">首页</button>
          <button type="button" onClick={() => goToPage(currentPage - 1)} className="font-bold text-[#0000ee] hover:underline">上一页</button>
          <button type="button" onClick={() => goToPage(currentPage + 1)} className="font-bold text-[#0000ee] hover:underline">下一页</button>
          <button type="button" onClick={() => goToPage(totalPages)} className="font-bold text-[#0000ee] hover:underline">尾页</button>
          <span>跳转</span>
          <input
            className="h-6 w-8 rounded border border-[#9bbfe5] bg-white px-1 text-center text-[12px] outline-none"
            value={jumpPage}
            onChange={(event) => setJumpPage(event.target.value)}
          />
          <span>页</span>
          <button type="button" onClick={() => goToPage(Number(jumpPage) || 1)} className="h-6 rounded border border-[#8aaed3] bg-[#d8e7f5] px-1 text-[11px] font-bold text-[#001a33]">
            GO
          </button>
        </div>
      </div>

      <div className="max-h-[540px] overflow-auto border-t border-[#99c7f3] bg-white custom-scrollbar">
        <table className="w-full min-w-[1170px] table-fixed border-collapse bg-white">
          <colgroup>
            {headers.map((header) => (
              <col key={header} className="w-[78px]" />
            ))}
          </colgroup>
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header} className={`${headClass} sticky top-0 z-10`}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const row = toVisibleRow(record);
              const selected = selectedCurveIds.includes(record.id);

              return (
                <tr key={record.id} className="group cursor-pointer" onClick={() => handleCurveRowClick(record.id)}>
                  {row.map((value, valueIndex) => (
                    <td key={`${record.id}-${valueIndex}`} className={selectableCellClass(selected)}>{value}</td>
                  ))}
                </tr>
              );
            })}
            {Array.from({ length: pageSize - records.length }, (_, index) => (
              <tr key={`empty-${index}`}>
                {headers.map((header) => (
                  <td key={header} className={cellClass} />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {chartSeries.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-[9999]">
          <div
            data-indicator-curve-dialog="true"
            className="pointer-events-auto absolute w-[min(1024px,calc(100vw-48px))] border border-[#99c7f3] bg-white shadow-2xl"
            style={curveDialogPosition ? { left: curveDialogPosition.x, top: curveDialogPosition.y } : { left: "50%", top: 96, transform: "translateX(-50%)" }}
          >
            <div className="flex cursor-move select-none items-center justify-between border-b border-[#99c7f3] bg-[#f4f8fc] px-4 py-2" onPointerDown={handleCurveDialogPointerDown}>
              <h2 className="text-[20px] font-bold text-[#cc0000]">{"\u6307\u793a\u66f2\u7ebf"}</h2>
              <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setSelectedCurveIds([])} className="cursor-pointer rounded border border-[#8aaed3] bg-[#e4f0fa] px-3 py-1 text-[12px] font-bold text-[#001a33] hover:bg-[#d6e8f8]">
                {"\u5173\u95ed"}
              </button>
            </div>
            <div className="flex h-[420px] bg-white">
              <div className="w-64 shrink-0 overflow-y-auto border-r border-[#d7e8f8] bg-white px-3 py-4 text-[12px] leading-5">
                <div className="mb-2 font-bold text-[#001a33]">{"\u4e95\u53f7"}</div>
                <div className="grid grid-cols-1 gap-y-1">
                  {chartSeries.map((series, index) => (
                    <div key={`indicator-legend-${series.id}`} className="flex min-w-0 items-center gap-1.5">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />
                      <span className="truncate" style={{ color: chartColors[index % chartColors.length] }}>{series.name}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 24, right: 32, bottom: 42, left: 28 }}>
                  <CartesianGrid stroke="#d7e8f8" />
                  <XAxis
                    dataKey="injection"
                    name={"\u65e5\u6ce8"}
                    type="number"
                    domain={chartDomains.x}
                    allowDataOverflow={false}
                    tick={{ fontSize: 12, fill: "#001a33" }}
                    label={{ value: "\u65e5\u6ce8", position: "insideBottom", offset: -24, fill: "#001a33", fontSize: 13 }}
                  />
                  <YAxis
                    dataKey="pressure"
                    name={"\u538b\u529b"}
                    type="number"
                    domain={chartDomains.y}
                    allowDataOverflow={false}
                    tick={{ fontSize: 12, fill: "#001a33" }}
                    label={{ value: "\u538b\u529b", angle: -90, position: "insideLeft", fill: "#001a33", fontSize: 13 }}
                  />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} formatter={(value, name) => [value, name === "pressure" ? "\u538b\u529b" : "\u65e5\u6ce8"]} />
                  {chartSeries.map((series, index) => (
                    <Scatter
                      key={series.id}
                      name={series.name}
                      data={series.points}
                      fill={chartColors[index % chartColors.length]}
                      line={{ stroke: chartColors[index % chartColors.length], strokeWidth: 2 }}
                      shape="circle"
                    />
                  ))}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto border border-shell-border bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">新增指示曲线</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm font-bold text-gray-500 hover:text-gray-900">关闭</button>
            </div>
            {formError && <div className="mb-4 border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">{formError}</div>}
            <div className="grid gap-4 md:grid-cols-5">
              <label className="block text-sm font-bold text-gray-700">
                作业区
                <select value={form.unit} onChange={(event) => { updateForm("unit", event.target.value); updateForm("block", ""); }} className="mt-2 w-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-cnpc-red">
                  {FILTER_UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="block text-sm font-bold text-gray-700">
                区块
                <select value={form.block} onChange={(event) => updateForm("block", event.target.value)} className="mt-2 w-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-cnpc-red">
                  <option value="">请选择区块</option>
                  {getFilterBlockOptions(form.unit).map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="block text-sm font-bold text-gray-700">
                井号
                <input value={form.wellNo} onChange={(event) => updateForm("wellNo", event.target.value)} className="mt-2 w-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-cnpc-red" />
              </label>
              <label className="block text-sm font-bold text-gray-700">
                测试日期
                <input type="date" value={form.testDate} onChange={(event) => updateForm("testDate", event.target.value)} className="mt-2 w-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-cnpc-red" />
              </label>
              <label className="block text-sm font-bold text-gray-700">
                测试井段
                <input value={form.testInterval} onChange={(event) => updateForm("testInterval", event.target.value)} className="mt-2 w-full border border-gray-200 px-3 py-2 text-sm outline-none focus:border-cnpc-red" />
              </label>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={headClass}>序号</th>
                    {[1, 2, 3, 4, 5].map((index) => (
                      <th key={`injection-head-${index}`} className={headClass}>日注{index}</th>
                    ))}
                    {[1, 2, 3, 4, 5].map((index) => (
                      <th key={`pressure-head-${index}`} className={headClass}>压力{index}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className={cellClass}>数值</td>
                    {([1, 2, 3, 4, 5] as const).map((index) => (
                      <td key={`injection-${index}`} className={cellClass}>
                        <input value={form[`injection${index}`]} onChange={(event) => updateForm(`injection${index}`, event.target.value)} className="w-full border border-gray-200 px-2 py-1 text-center outline-none focus:border-cnpc-red" />
                      </td>
                    ))}
                    {([1, 2, 3, 4, 5] as const).map((index) => (
                      <td key={`pressure-${index}`} className={cellClass}>
                        <input value={form[`pressure${index}`]} onChange={(event) => updateForm(`pressure${index}`, event.target.value)} className="w-full border border-gray-200 px-2 py-1 text-center outline-none focus:border-cnpc-red" />
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">取消</button>
              <button type="button" disabled={saving} onClick={() => void handleCreate()} className="rounded bg-cnpc-red px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const WELL_FLUSHING_PAGE_SIZE = 15;

function WellFlushingPage() {
  const pageSize = WELL_FLUSHING_PAGE_SIZE;
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const [records, setRecords] = useState<WellFlushingRecord[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPage, setJumpPage] = useState("1");
  const [filters, setFilters] = useState({ unit: "", block: "", wellNo: "", fromDate: "", toDate: "" });
  const [form, setForm] = useState<WellFlushingForm>(() => createEmptyWellFlushingForm());
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [error, setError] = useState("");
  const { confirmDialog, requestConfirm } = useStyledConfirmDialog();
  const filterClass = "h-6 rounded border border-[#8aaed3] bg-white px-2 text-[12px] text-[#001a33] outline-none";
  const headClass = "h-[38px] border border-[#8dbcf0] bg-[#dceefc] px-1 text-center text-[12px] font-bold leading-tight text-[#001a33]";
  const cellClass = "h-9 border border-[#8dbcf0] bg-white px-2 text-center text-[12px] leading-tight text-black";
  const narrowHeadClass = `${headClass} h-[36px] text-[11px]`;
  const compactNumberHeadClass = `${narrowHeadClass} w-12`;
  const nowrapCellClass = `${cellClass} whitespace-nowrap`;
  const selectableCellClass = (baseClass: string, selected: boolean) => cn(baseClass, "group-hover:bg-red-50", selected && "bg-red-50");
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const displayPage = Math.min(currentPage, totalPages);
  const pageButtonClass = "font-bold text-[#0000ee] hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline";

  const loadRecords = async (page = currentPage, nextFilters = filters) => {
    setLoading(true);
    setError("");
    try {
      const params = Object.fromEntries(
        Object.entries({ ...nextFilters, page, pageSize }).filter(([, value]) => String(value).trim()),
      );
      const { data } = await axios.get<PaginatedApiResponse<WellFlushingRecord>>("/api/well-flushing-records", { params });
      setRecords(data.rows);
      setTotalRows(data.total);
      setCurrentPage(data.page);
      setJumpPage(String(data.page));
      setSelectedId((current) => (data.rows.some((row) => row.id === current) ? current : null));
    } catch (err: any) {
      setError(err?.response?.data?.error || "水井洗井记录加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords(1);
  }, []);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const goToPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    void loadRecords(nextPage);
  };

  const applyFilters = () => {
    void loadRecords(1);
  };

  const formatCell = (value?: string | number | null) => (value === null || value === undefined ? "" : String(value));

  const updateForm = (key: keyof WellFlushingForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const updateArrayForm = (key: "firstLevel" | "secondLevel" | "suspendedMatter", index: number, value: string) => {
    setForm((current) => ({
      ...current,
      [key]: current[key].map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  };

  const openCreateForm = () => {
    setForm({
      ...createEmptyWellFlushingForm(),
      unit: filters.unit || "高采采油作业一区",
      wellNo: filters.wellNo,
      washDate: filters.fromDate || new Date().toISOString().slice(0, 10),
    });
    setShowForm(true);
    setError("");
  };

  const handleSave = async () => {
    if (!form.unit.trim() || !form.wellNo.trim() || !form.washDate || !Number.isFinite(Number(form.daysSinceLastWash)) || !form.method.trim()) {
      setError("新增洗井记录需要填写单位、井号、洗井日期、距上次洗井时间和洗井方式");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await axios.post("/api/well-flushing-records", form);
      setShowForm(false);
      setForm(createEmptyWellFlushingForm());
      await loadRecords(1);
    } catch (err: any) {
      setError(err?.response?.data?.error || "水井洗井记录新增失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const record = records.find((row) => row.id === selectedId);
    if (!record) return;
    requestConfirm(`确认删除 ${record.wellNo} ${formatCell(record.washDate)} 的洗井记录？`, async () => {
      try {
        await axios.delete(`/api/well-flushing-records/${record.id}`);
        setSelectedId(null);
        const nextPage = records.length === 1 && displayPage > 1 ? displayPage - 1 : displayPage;
        await loadRecords(nextPage);
      } catch (err: any) {
        setError(err?.response?.data?.error || "水井洗井记录删除失败");
      }
    });
  };

  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    setError("");
    setImportStatus("");
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error("Excel 文件中没有可导入的工作表");
      }
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "" });
      const parsedRows = rows
        .map((row) => ({
          unit: String(readExcelCell(row, ["单位"])).trim(),
          wellNo: String(readExcelCell(row, ["井号"])).trim(),
          washDate: formatExcelDate(readExcelCell(row, ["洗井日期", "日期"])),
          daysSinceLastWash: String(readExcelCell(row, ["距上次洗井时间(d)", "距上次洗井时间", "距上次洗井时间（d）"])).trim(),
          method: String(readExcelCell(row, ["洗井方式", "洗井方式（洗井车/泵车/来水）"])).trim(),
          equipmentPressure: String(readExcelCell(row, ["洗井设备泵压/来水压力(Mpa)", "洗井设备泵压/来水压力（Mpa）", "设备泵压/来水压力"])).trim(),
          duration: String(readExcelCell(row, ["洗井时间(h)", "洗井时间（h）", "洗井时间"])).trim(),
          totalWater: String(readExcelCell(row, ["总水量(m³)", "总水量（m³）", "总水量"])).trim(),
          firstLevel: [
            readExcelCell(row, ["一级洗前(m³)", "一级洗前（m³）"]),
            readExcelCell(row, ["一级洗后(m³)", "一级洗后（m³）"]),
            readExcelCell(row, ["一级差值(m³)", "一级差值（m³）"]),
            readExcelCell(row, ["一级时间(h)", "一级时间（h）"]),
            readExcelCell(row, ["一级平均排量(m³/h)", "一级平均排量（m³/h）"]),
          ].map((value) => String(value).trim()),
          secondLevel: [
            readExcelCell(row, ["二级洗前(m³)", "二级洗前（m³）"]),
            readExcelCell(row, ["二级洗后(m³)", "二级洗后（m³）"]),
            readExcelCell(row, ["二级差值(m³)", "二级差值（m³）"]),
            readExcelCell(row, ["二级时间(h)", "二级时间（h）"]),
            readExcelCell(row, ["二级平均排量(m³/h)", "二级平均排量（m³/h）"]),
          ].map((value) => String(value).trim()),
          suspendedMatter: [
            readExcelCell(row, ["固体悬浮物洗前(mg/L)", "洗前(mg/L)"]),
            readExcelCell(row, ["固体悬浮物洗后(mg/L)", "洗后(mg/L)"]),
            readExcelCell(row, ["固体悬浮物差值(mg/L)", "差值(mg/L)"]),
          ].map((value) => String(value).trim()),
          remark: String(readExcelCell(row, ["备注"])).trim(),
        }))
        .filter((row) => row.unit || row.wellNo || row.washDate || row.method);

      if (!parsedRows.length) {
        throw new Error("未读取到可导入的数据，请确认表头包含单位、井号、洗井日期和洗井方式");
      }

      const { data } = await axios.post<{ imported: number }>("/api/well-flushing-records/import", { rows: parsedRows });
      setImportStatus(`已导入 ${data.imported} 条`);
      setSelectedId(null);
      await loadRecords(1);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Excel 导入失败");
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const worksheet = XLSX.utils.json_to_sheet([
      {
        "单位": "高采采油作业一区",
        "井号": "GS-101",
        "洗井日期": "2026-05-01",
        "距上次洗井时间(d)": 45,
        "洗井方式": "洗井车",
        "洗井设备泵压/来水压力(Mpa)": 12.5,
        "洗井时间(h)": 3.5,
        "总水量(m³)": 80,
        "一级洗前(m³)": 120,
        "一级洗后(m³)": 150,
        "一级差值(m³)": 30,
        "一级时间(h)": 1.5,
        "一级平均排量(m³/h)": 20,
        "二级洗前(m³)": 210,
        "二级洗后(m³)": 245,
        "二级差值(m³)": 35,
        "二级时间(h)": 2,
        "二级平均排量(m³/h)": 17.5,
        "固体悬浮物洗前(mg/L)": 36,
        "固体悬浮物洗后(mg/L)": 18,
        "固体悬浮物差值(mg/L)": 18,
        "备注": "正常洗井",
      },
      {
        "单位": "高采采油作业二区",
        "井号": "GS-102",
        "洗井日期": "2026-05-03",
        "距上次洗井时间(d)": 52,
        "洗井方式": "泵车",
        "洗井设备泵压/来水压力(Mpa)": 13.2,
        "洗井时间(h)": 4,
        "总水量(m³)": 92,
        "一级洗前(m³)": 98,
        "一级洗后(m³)": 132,
        "一级差值(m³)": 34,
        "一级时间(h)": 1.8,
        "一级平均排量(m³/h)": 18.9,
        "二级洗前(m³)": 188,
        "二级洗后(m³)": 224,
        "二级差值(m³)": 36,
        "二级时间(h)": 2.2,
        "二级平均排量(m³/h)": 16.4,
        "固体悬浮物洗前(mg/L)": 42,
        "固体悬浮物洗后(mg/L)": 21,
        "固体悬浮物差值(mg/L)": 21,
        "备注": "复测合格",
      },
    ]);
    worksheet["!cols"] = [
      { wch: 16 },
      { wch: 12 },
      { wch: 14 },
      { wch: 18 },
      { wch: 12 },
      { wch: 26 },
      { wch: 12 },
      { wch: 12 },
      ...Array.from({ length: 13 }, () => ({ wch: 16 })),
      { wch: 18 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "水井洗井导入模板");
    XLSX.writeFile(workbook, "水井洗井导入模板.xlsx");
  };

  return (
    <div className="rounded-sm border border-[#8dbcf0] bg-white shadow-[0_1px_3px_rgba(64,128,191,0.25)]">
      {confirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-2 py-2 text-[12px] text-[#001a33]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="flex items-center gap-1">
            <span>作业区</span>
            <select className={`${filterClass} w-32`} value={filters.unit} onChange={(event) => setFilters((current) => ({ ...current, unit: event.target.value, block: "" }))}>
              <option value="">全部作业区</option>
              {FILTER_UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span>{"\u533a\u5757"}</span>
            <select className={`${filterClass} w-28`} value={filters.block} onChange={(event) => updateFilter("block", event.target.value)}>
              <option value="">请选择</option>
              {getFilterBlockOptions(filters.unit).map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span>井号</span>
            <input className={`${filterClass} w-28`} value={filters.wellNo} onChange={(event) => updateFilter("wellNo", event.target.value)} />
          </label>
          <label className="flex items-center gap-1">
            <span>洗井日期</span>
            <input type="date" className={`${filterClass} w-32`} value={filters.fromDate} onChange={(event) => updateFilter("fromDate", event.target.value)} />
            <span>至</span>
            <input type="date" className={`${filterClass} w-32`} value={filters.toDate} onChange={(event) => updateFilter("toDate", event.target.value)} />
          </label>
          <button type="button" onClick={applyFilters} className="h-6 rounded border border-[#8aaed3] bg-[#d8e7f5] px-4 text-[12px] font-bold text-[#001a33] hover:bg-[#cfe1f2]">
            确定
          </button>
          <button type="button" onClick={openCreateForm} className="h-6 rounded border border-[#8aaed3] bg-[#e4f0fa] px-3 text-[12px] font-bold text-[#001a33] hover:bg-[#d6e8f8]">
            新增
          </button>
          <button type="button" disabled={!selectedId} onClick={handleDelete} className="h-6 rounded border border-[#8aaed3] bg-[#e4f0fa] px-3 text-[12px] font-bold text-[#001a33] hover:bg-[#d6e8f8] disabled:cursor-not-allowed disabled:opacity-50">
            删除
          </button>
          <input ref={excelInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelImport} />
          <button
            type="button"
            disabled={importing}
            onClick={() => excelInputRef.current?.click()}
            className="inline-flex h-6 items-center gap-1 rounded border border-[#8aaed3] bg-[#e4f0fa] px-3 text-[12px] font-bold text-[#001a33] hover:bg-[#d6e8f8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {importing ? "导入中" : "Excel导入"}
          </button>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex h-6 items-center gap-1 rounded border border-[#8aaed3] bg-[#e4f0fa] px-3 text-[12px] font-bold text-[#001a33] hover:bg-[#d6e8f8]"
          >
            <Download className="h-3.5 w-3.5" />
            模板下载
          </button>
          {importStatus && <span className="text-[#007a3d]">{importStatus}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2 whitespace-nowrap text-[12px] text-[#001a33]">
          <span>第 {displayPage} 页 共 {totalPages} 页 共 {totalRows} 条</span>
          <button type="button" className={pageButtonClass} disabled={displayPage === 1} onClick={() => goToPage(1)}>首页</button>
          <button type="button" className={pageButtonClass} disabled={displayPage === 1} onClick={() => goToPage(displayPage - 1)}>上一页</button>
          <button type="button" className={pageButtonClass} disabled={displayPage === totalPages} onClick={() => goToPage(displayPage + 1)}>下一页</button>
          <button type="button" className={pageButtonClass} disabled={displayPage === totalPages} onClick={() => goToPage(totalPages)}>尾页</button>
          <span>跳转</span>
          <input
            className="h-6 w-8 rounded border border-[#9bbfe5] bg-white px-1 text-center text-[12px] outline-none"
            value={jumpPage}
            onChange={(event) => setJumpPage(event.target.value.replace(/\D/g, ""))}
          />
          <span>页</span>
          <button type="button" className="h-6 rounded border border-[#8aaed3] bg-[#d8e7f5] px-1 text-[11px] font-bold text-[#001a33]" onClick={() => goToPage(Number(jumpPage) || 1)}>
            GO
          </button>
        </div>
      </div>
      <h1 className="border-b border-[#8dbcf0] py-1 text-center text-[22px] font-bold leading-none text-[#a40000]">
        水井洗井统计列表
      </h1>
      {error && <div className="border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      <div className="overflow-x-auto bg-white">
        <table className="w-full min-w-[1320px] table-fixed border-collapse bg-white">
          <thead>
            <tr>
              <th rowSpan={3} className={`${headClass} w-16`}>{"\u4e95\u53f7"}</th>
              <th rowSpan={3} className={`${headClass} w-28`}>{"\u5355\u4f4d"}</th>
              <th rowSpan={3} className={`${headClass} w-16`}>{"\u533a\u5757"}</th>
              <th rowSpan={3} className={`${headClass} w-24`}>{"\u6d17\u4e95\u65e5\u671f"}</th>
              <th rowSpan={3} className={`${headClass} w-14`}>{"\u8ddd\u4e0a\u6b21\u6d17\u4e95\u65f6\u95f4(d)"}</th>
              <th rowSpan={3} className={`${headClass} w-16`}>{"\u6d17\u4e95\u65b9\u5f0f\uff08\u6d17\u4e95\u8f66/\u6cf5\u8f66/\u6765\u6c34\uff09"}</th>
              <th rowSpan={3} className={`${headClass} w-16`}>{"\u6d17\u4e95\u8bbe\u5907\u6cf5\u538b/\u6765\u6c34\u538b\u529b\uff08Mpa\uff09"}</th>
              <th rowSpan={3} className={`${headClass} w-12`}>{"\u6d17\u4e95\u65f6\u95f4(h)"}</th>
              <th colSpan={11} className={headClass}>{"\u6d17\u4e95\u5206\u6bb5\u7edf\u8ba1"}</th>
              <th colSpan={3} className={headClass}>{"\u56fa\u4f53\u60ac\u6d6e\u7269\u76d1\u6d4b"}</th>
              <th rowSpan={3} className={`${headClass} w-24`}>{"\u5907\u6ce8"}</th>
            </tr>
            <tr>
              <th rowSpan={2} className={compactNumberHeadClass}>{"\u603b\u6c34\u91cf\uff08m\u00b3\uff09"}</th>
              <th colSpan={5} className={narrowHeadClass}>{"\u4e00\u7ea7\u5faa\u73af\u603b\u6d41\u91cf\u8868\u6570\u503c"}</th>
              <th colSpan={5} className={narrowHeadClass}>{"\u4e8c\u7ea7\u5faa\u73af\u603b\u6d41\u91cf\u8868\u6570\u503c"}</th>
              <th rowSpan={2} className={compactNumberHeadClass}>{"\u6d17\u524d(mg/L)"}</th>
              <th rowSpan={2} className={compactNumberHeadClass}>{"\u6d17\u540e(mg/L)"}</th>
              <th rowSpan={2} className={compactNumberHeadClass}>{"\u5dee\u503c(mg/L)"}</th>
            </tr>
            <tr>
              {[
                "\u6d17\u524d\uff08m\u00b3\uff09",
                "\u6d17\u540e\uff08m\u00b3\uff09",
                "\u5dee\u503c\uff08m\u00b3\uff09",
                "\u65f6\u95f4\uff08h\uff09",
                "\u5e73\u5747\u6392\u91cf\uff08m\u00b3/h\uff09",
                "\u6d17\u524d\uff08m\u00b3\uff09",
                "\u6d17\u540e\uff08m\u00b3\uff09",
                "\u5dee\u503c\uff08m\u00b3\uff09",
                "\u65f6\u95f4\uff08h\uff09",
                "\u5e73\u5747\u6392\u91cf\uff08m\u00b3/h\uff09",
              ].map((header, index) => (
                <th key={`${header}-${index}`} className={compactNumberHeadClass}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={23} className={cellClass}>正在加载...</td></tr>
            ) : records.map((row) => (
              <tr key={row.id} onClick={() => setSelectedId(row.id)} className="group cursor-pointer">
                <td className={selectableCellClass(cellClass, row.id === selectedId)}>{row.wellNo}</td>
                <td className={selectableCellClass(nowrapCellClass, row.id === selectedId)}>{row.unit}</td>
                <td className={selectableCellClass(cellClass, row.id === selectedId)}>{formatCell(row.block)}</td>
                <td className={selectableCellClass(nowrapCellClass, row.id === selectedId)}>{formatCell(row.washDate).slice(0, 10)}</td>
                <td className={selectableCellClass(cellClass, row.id === selectedId)}>{row.daysSinceLastWash}</td>
                <td className={selectableCellClass(cellClass, row.id === selectedId)}>{row.method}</td>
                <td className={selectableCellClass(cellClass, row.id === selectedId)}>{formatCell(row.equipmentPressure)}</td>
                <td className={selectableCellClass(cellClass, row.id === selectedId)}>{formatCell(row.duration)}</td>
                <td className={selectableCellClass(cellClass, row.id === selectedId)}>{formatCell(row.totalWater)}</td>
                {[...row.firstLevel, ...row.secondLevel, ...row.suspendedMatter].map((value, valueIndex) => (
                  <td key={valueIndex} className={selectableCellClass(cellClass, row.id === selectedId)}>{value}</td>
                ))}
                <td className={selectableCellClass(nowrapCellClass, row.id === selectedId)}>{row.remark}</td>
              </tr>
            ))}
            {!loading && !records.length && (
              <tr><td colSpan={23} className={cellClass}>暂无符合条件的数据</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto border border-shell-border bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">新增水井洗井</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm font-bold text-gray-500 hover:text-gray-900">关闭</button>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <select className={filterClass} value={form.unit} onChange={(event) => { updateForm("unit", event.target.value); updateForm("block", ""); }}>
                {FILTER_UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <select className={filterClass} value={form.block} onChange={(event) => updateForm("block", event.target.value)}>
                <option value="">请选择区块</option>
                {getFilterBlockOptions(form.unit).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
              <input className={filterClass} placeholder="井号" value={form.wellNo} onChange={(event) => updateForm("wellNo", event.target.value)} />
              <input type="date" className={filterClass} value={form.washDate} onChange={(event) => updateForm("washDate", event.target.value)} />
              <input type="number" className={filterClass} placeholder="距上次洗井时间(d)" value={form.daysSinceLastWash} onChange={(event) => updateForm("daysSinceLastWash", event.target.value)} />
              <input className={filterClass} placeholder="洗井方式" value={form.method} onChange={(event) => updateForm("method", event.target.value)} />
              <input type="number" step="0.01" className={filterClass} placeholder="设备泵压/来水压力" value={form.equipmentPressure} onChange={(event) => updateForm("equipmentPressure", event.target.value)} />
              <input type="number" step="0.01" className={filterClass} placeholder="洗井时间(h)" value={form.duration} onChange={(event) => updateForm("duration", event.target.value)} />
              <input type="number" step="0.01" className={filterClass} placeholder="总水量" value={form.totalWater} onChange={(event) => updateForm("totalWater", event.target.value)} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="rounded border border-[#d7e5f3] p-3">
                <div className="mb-2 text-sm font-bold text-[#001a33]">一级循环总流量表数值</div>
                <div className="grid gap-2 sm:grid-cols-5">
                  {["洗前", "洗后", "差值", "时间", "平均排量"].map((label, index) => (
                    <input key={label} className={filterClass} placeholder={label} value={form.firstLevel[index]} onChange={(event) => updateArrayForm("firstLevel", index, event.target.value)} />
                  ))}
                </div>
              </div>
              <div className="rounded border border-[#d7e5f3] p-3">
                <div className="mb-2 text-sm font-bold text-[#001a33]">二级循环总流量表数值</div>
                <div className="grid gap-2 sm:grid-cols-5">
                  {["洗前", "洗后", "差值", "时间", "平均排量"].map((label, index) => (
                    <input key={label} className={filterClass} placeholder={label} value={form.secondLevel[index]} onChange={(event) => updateArrayForm("secondLevel", index, event.target.value)} />
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded border border-[#d7e5f3] p-3">
              <div className="mb-2 text-sm font-bold text-[#001a33]">固体悬浮物监测</div>
              <div className="grid gap-2 sm:grid-cols-3">
                {["洗前(mg/L)", "洗后(mg/L)", "差值(mg/L)"].map((label, index) => (
                  <input key={label} className={filterClass} placeholder={label} value={form.suspendedMatter[index]} onChange={(event) => updateArrayForm("suspendedMatter", index, event.target.value)} />
                ))}
              </div>
            </div>
            <textarea className="mt-3 min-h-20 w-full rounded border border-[#b8c8d8] px-3 py-2 text-sm outline-none focus:border-cnpc-blue" placeholder="备注" value={form.remark} onChange={(event) => updateForm("remark", event.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">取消</button>
              <button type="button" onClick={handleSave} disabled={saving} className="rounded bg-cnpc-red px-4 py-2 text-sm font-bold text-white hover:bg-cnpc-red-dark disabled:opacity-60">{saving ? "保存中..." : "保存"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const INJECTION_TECH_PAGE_SIZE = 15;
const WATER_CUT_PAGE_SIZE = 30;

const todayDateInput = () => new Date().toISOString().slice(0, 10);

const apiDateOnly = (value?: string | null) => (value ? String(value).slice(0, 10) : "");

const selectedTableCellClass = (baseClass: string, selected: boolean) => cn(baseClass, selected && "bg-red-50");

const compactQueryParams = (input: Record<string, string>) =>
  Object.fromEntries(Object.entries(input).filter(([, value]) => value.trim()));

const createEmptyInjectionTechForm = () => ({
  wellNo: "",
  block: "",
  workArea: "高采采油作业一区",
  process: "",
  packerCount: "1",
  packerModels: "",
  bottomStructure: "",
  washable: "是",
  doublePacker: "否",
  washReminder: "",
  lastWorkDate: todayDateInput(),
  runningDate: todayDateInput(),
});

const injectionRunningMonthsFromLastWorkDate = (lastWorkDate?: string | null) => {
  if (!lastWorkDate) return "";
  const start = new Date(String(lastWorkDate).slice(0, 10));
  if (Number.isNaN(start.getTime())) return "";
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const diffDays = Math.max(0, Math.floor((todayStart.getTime() - startDay.getTime()) / 86400000));
  return (diffDays / 30).toFixed(1);
};

function InjectionTechPage() {
  const [records, setRecords] = useState<InjectionTechRecord[]>([]);
  const [filters, setFilters] = useState({
    workArea: "",
    block: "",
    process: "",
    washable: "",
    runningMonths: "",
    wellNo: "",
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPage, setJumpPage] = useState("1");
  const [totalRows, setTotalRows] = useState(0);
  const [pinnedRecord, setPinnedRecord] = useState<InjectionTechRecord | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(() => createEmptyInjectionTechForm());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { confirmDialog, requestConfirm } = useStyledConfirmDialog();
  const filterClass = "h-6 rounded border border-[#9bbfe5] bg-white px-2 text-[12px] text-[#001a33] outline-none";
  const headerClass = "border border-[#99c7f3] bg-[#dceefc] px-2 py-2 text-center text-[13px] font-bold leading-tight text-[#001a33]";
  const cellClass = "h-10 border border-[#99c7f3] bg-white px-2 py-1 text-center text-[13px] leading-tight text-black";

  const totalPages = Math.max(1, Math.ceil(totalRows / INJECTION_TECH_PAGE_SIZE));
  const recordMatchesFilters = (record: InjectionTechRecord, nextFilters = appliedFilters) => {
    if (nextFilters.workArea && record.workArea !== nextFilters.workArea) return false;
    if (nextFilters.block && !record.block.includes(nextFilters.block)) return false;
    if (nextFilters.process && !record.process.includes(nextFilters.process)) return false;
    if (nextFilters.washable && record.washable !== nextFilters.washable) return false;
    if (nextFilters.runningMonths && injectionRunningMonthsFromLastWorkDate(record.lastWorkDate) !== Number(nextFilters.runningMonths).toFixed(1)) return false;
    if (nextFilters.wellNo && !record.wellNo.includes(nextFilters.wellNo)) return false;
    return true;
  };
  const visibleRecords =
    currentPage === 1 && pinnedRecord && recordMatchesFilters(pinnedRecord)
      ? [pinnedRecord, ...records.filter((row) => row.id !== pinnedRecord.id)].slice(0, INJECTION_TECH_PAGE_SIZE)
      : records;

  const loadRecords = async (page = currentPage, nextFilters = appliedFilters) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get<PaginatedApiResponse<InjectionTechRecord>>("/api/injection-tech-records", {
        params: {
          ...compactQueryParams(nextFilters),
          page,
          pageSize: INJECTION_TECH_PAGE_SIZE,
        },
      });
      setRecords(data.rows);
      setTotalRows(data.total);
      setJumpPage(String(data.page));
    } catch (err: any) {
      setError(err?.response?.data?.error || "注水工艺记录加载失败");
      setRecords([]);
      setTotalRows(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords(currentPage, appliedFilters);
  }, [currentPage, appliedFilters]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const goToPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(nextPage);
    setJumpPage(String(nextPage));
  };
  const applyCurrentFilters = () => {
    setAppliedFilters(filters);
    setPinnedRecord(null);
    setCurrentPage(1);
    setJumpPage("1");
  };
  const updateForm = (key: keyof ReturnType<typeof createEmptyInjectionTechForm>, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const packerModelFormValues = Array.from({ length: 6 }, (_, index) => form.packerModels.split(",")[index] ?? "");
  const updatePackerModelForm = (index: number, value: string) => {
    const nextModels = [...packerModelFormValues];
    nextModels[index] = value.trim();
    updateForm("packerModels", nextModels.join(",").replace(/,+$/, ""));
  };
  const handleCreate = async () => {
    if (!form.wellNo.trim() || !form.block.trim() || !form.workArea.trim() || !form.process.trim() || !form.bottomStructure.trim()) {
      setError("请填写井号、区块、作业区、注水工艺和管柱底部结构");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { data: createdRecord } = await axios.post<InjectionTechRecord>("/api/injection-tech-records", {
        ...form,
        runningDate: form.runningDate || form.lastWorkDate,
        packerModels: form.packerModels.split(",").map((item) => item.trim()).filter(Boolean),
      });
      setForm(createEmptyInjectionTechForm());
      setShowCreate(false);
      setCurrentPage(1);
      setJumpPage("1");
      setPinnedRecord(createdRecord);
      setRecords((current) => [createdRecord, ...current.filter((row) => row.id !== createdRecord.id)].slice(0, INJECTION_TECH_PAGE_SIZE));
      setTotalRows((current) => current + 1);
    } catch (err: any) {
      setError(err?.response?.data?.error || "注水工艺记录新增失败");
    } finally {
      setSaving(false);
    }
  };
  const handleDelete = async (record: InjectionTechRecord) => {
    requestConfirm(`确认删除 ${record.wellNo} 的注水工艺记录？`, async () => {
      setError("");
      try {
        await axios.delete(`/api/injection-tech-records/${record.id}`);
        setPinnedRecord((current) => (current?.id === record.id ? null : current));
        setRecords((current) => current.filter((row) => row.id !== record.id));
        setTotalRows((current) => Math.max(0, current - 1));
        const nextPage = records.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
        setCurrentPage(nextPage);
        await loadRecords(nextPage, appliedFilters);
      } catch (err: any) {
        setError(err?.response?.data?.error || "注水工艺记录删除失败");
      }
    });
  };
  const modelCells = (value: unknown) => {
    const models = Array.isArray(value) ? value.map((item) => String(item)) : [];
    return Array.from({ length: 6 }, (_, index) => models[index] || "");
  };

  return (
    <div className="rounded border border-[#9fc3e7] bg-[#f8fbff] shadow-[0_1px_3px_rgba(64,128,191,0.25)]">
      {confirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-2 py-2 text-[12px] text-[#001a33]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <label className="flex items-center gap-1">
            <span>作业区</span>
            <select className={`${filterClass} w-36`} value={filters.workArea} onChange={(event) => setFilters((current) => ({ ...current, workArea: event.target.value, block: "" }))}>
              <option value="">请选择</option>
              {FILTER_UNIT_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span>区块</span>
            <select className={`${filterClass} w-28`} value={filters.block} onChange={(event) => updateFilter("block", event.target.value)}>
              <option value="">请选择</option>
              {getFilterBlockOptions(filters.workArea).map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span>注水工艺</span>
            <input className={`${filterClass} w-28`} value={filters.process} onChange={(event) => updateFilter("process", event.target.value)} />
          </label>
          <label className="flex items-center gap-1">
            <span>{"\u662f\u5426\u53ef\u6d17\u4e95"}</span>
            <select className={`${filterClass} w-20`} value={filters.washable} onChange={(event) => updateFilter("washable", event.target.value)}>
              <option value="">{"\u8bf7\u9009\u62e9"}</option>
              <option value={"\u662f"}>{"\u662f"}</option>
              <option value={"\u5426"}>{"\u5426"}</option>
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span>{"\u7ba1\u67f1\u5165\u4e95\u65f6\u95f4"}</span>
            <input type="number" min="0" step="0.1" className={`${filterClass} w-24`} value={filters.runningMonths} onChange={(event) => updateFilter("runningMonths", event.target.value)} />
            <span>{"\u6708"}</span>
          </label>
          <label className="flex items-center gap-1">
            <span>井号</span>
            <input className={`${filterClass} w-24`} value={filters.wellNo} onChange={(event) => updateFilter("wellNo", event.target.value)} />
          </label>
          <button
            type="button"
            onClick={applyCurrentFilters}
            className="h-6 rounded border border-[#8aaed3] bg-[#e4f0fa] px-4 text-[12px] font-bold text-[#001a33] hover:bg-[#d6e8f8]"
          >
            确定
          </button>
          <button
            type="button"
            onClick={() => setShowCreate((current) => !current)}
            className="h-6 rounded border border-[#8aaed3] bg-[#e4f0fa] px-3 text-[12px] font-bold text-[#001a33] hover:bg-[#d6e8f8]"
          >
            新增
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 whitespace-nowrap text-[12px] text-[#001a33]">
          <span>第{currentPage}页 共{totalPages}页 共{totalRows}条</span>
          <button type="button" onClick={() => goToPage(1)} className="font-bold text-[#0000ee] hover:underline">首页</button>
          <button type="button" onClick={() => goToPage(currentPage - 1)} className="font-bold text-[#0000ee] hover:underline">上一页</button>
          <button type="button" onClick={() => goToPage(currentPage + 1)} className="font-bold text-[#0000ee] hover:underline">下一页</button>
          <button type="button" onClick={() => goToPage(totalPages)} className="font-bold text-[#0000ee] hover:underline">尾页</button>
          <span>跳转</span>
          <input
            className="h-5 w-8 rounded border border-[#9bbfe5] bg-white px-1 text-center text-[12px] outline-none"
            value={jumpPage}
            onChange={(event) => setJumpPage(event.target.value.replace(/\D/g, ""))}
          />
          <span>页</span>
          <button
            type="button"
            onClick={() => goToPage(Number(jumpPage) || 1)}
            className="h-5 rounded border border-[#8aaed3] bg-[#d8e7f5] px-1 text-[11px] font-bold text-[#001a33]"
          >
            GO
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="border-t border-[#99c7f3] bg-[#f2f8fe] px-3 py-3 text-[12px] text-[#001a33]">
          <div className="mb-2 font-bold text-[#001a33]">{"\u65b0\u589e\u6ce8\u6c34\u5de5\u827a\u8bb0\u5f55"}</div>
          <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-6">
            <label className="flex flex-col gap-1">
              <span>{"\u4e95\u53f7"}</span>
              <input className={filterClass} value={form.wellNo} onChange={(event) => updateForm("wellNo", event.target.value)} />
            </label>
            <label className="flex flex-col gap-1 md:col-span-2">
              <span>{"\u4f5c\u4e1a\u533a"}</span>
              <select className={filterClass} value={form.workArea} onChange={(event) => { updateForm("workArea", event.target.value); updateForm("block", ""); }}>
                {FILTER_UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span>{"\u533a\u5757"}</span>
              <select className={filterClass} value={form.block} onChange={(event) => updateForm("block", event.target.value)}>
                <option value="">请选择区块</option>
                {getFilterBlockOptions(form.workArea).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span>{"\u6ce8\u6c34\u5de5\u827a"}</span>
              <input className={filterClass} value={form.process} onChange={(event) => updateForm("process", event.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span>{"\u5c01\u9694\u5668\u4e2a\u6570"}</span>
              <input className={filterClass} value={form.packerCount} onChange={(event) => updateForm("packerCount", event.target.value.replace(/\D/g, ""))} />
            </label>
          </div>
          <div className="mt-3 rounded border border-[#b7d7f4] bg-white/70 p-2">
            <div className="mb-2 font-bold">{"\u5355\u4e2a\u5c01\u9694\u5668\u578b\u53f7\uff08\u81ea\u4e0a\u800c\u4e0b\uff09"}</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
              {packerModelFormValues.map((model, index) => (
                <label key={`packer-model-${index}`} className="flex flex-col gap-1">
                  <span>{index + 1}</span>
                  <input className={filterClass} value={model} onChange={(event) => updatePackerModelForm(index, event.target.value)} />
                </label>
              ))}
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-4 xl:grid-cols-6">
            <label className="flex flex-col gap-1">
              <span>{"\u7ba1\u67f1\u5e95\u90e8\u7ed3\u6784"}</span>
              <input className={filterClass} value={form.bottomStructure} onChange={(event) => updateForm("bottomStructure", event.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span>{"\u662f\u5426\u53ef\u6d17\u4e95"}</span>
              <select className={filterClass} value={form.washable} onChange={(event) => updateForm("washable", event.target.value)}>
                <option value={"\u662f"}>{"\u662f"}</option>
                <option value={"\u5426"}>{"\u5426"}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span>{"\u662f\u5426\u5b58\u5728\u5c42\u6bb5\u95f4\u53cc\u5c01\u9694\u5668"}</span>
              <select className={filterClass} value={form.doublePacker} onChange={(event) => updateForm("doublePacker", event.target.value)}>
                <option value={"\u5426"}>{"\u5426"}</option>
                <option value={"\u662f"}>{"\u662f"}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span>{"\u6d17\u4e95\u7279\u6b8a\u63d0\u9192"}</span>
              <input className={filterClass} value={form.washReminder} onChange={(event) => updateForm("washReminder", event.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span>{"\u6700\u540e\u4e00\u6b21\u4f5c\u4e1a\u65e5\u671f"}</span>
              <input className={filterClass} type="date" value={form.lastWorkDate} onChange={(event) => updateForm("lastWorkDate", event.target.value)} />
            </label>
            <label className="flex flex-col gap-1">
              <span>{"\u7ba1\u67f1\u5165\u4e95\u65f6\u95f4\uff08\u6708\uff09"}</span>
              <input className={`${filterClass} bg-slate-100`} value={injectionRunningMonthsFromLastWorkDate(form.lastWorkDate)} readOnly />
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={() => setShowCreate(false)} className="h-6 rounded border border-[#8aaed3] bg-white px-3 text-[12px] font-bold text-[#001a33] hover:bg-[#eef6ff]">
              {"\u53d6\u6d88"}
            </button>
            <button type="button" disabled={saving} onClick={handleCreate} className="h-6 rounded border border-[#8aaed3] bg-[#e4f0fa] px-4 text-[12px] font-bold text-[#001a33] hover:bg-[#d6e8f8] disabled:opacity-50">
              {"\u4fdd\u5b58"}
            </button>
          </div>
        </div>
      )}

      {error && <div className="border-t border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      <h1 className="pb-2 text-center text-[22px] font-bold leading-none text-[#cc0000]">注水工艺状态概览列表</h1>

      <div className="overflow-x-auto border-t border-[#99c7f3] bg-white">
        <table className="w-full min-w-[1560px] border-collapse bg-white">
          <thead>
            <tr>
              <th rowSpan={2} className={`${headerClass} w-16`}>序号</th>
              <th rowSpan={2} className={`${headerClass} w-28`}>井号</th>
              <th rowSpan={2} className={`${headerClass} w-36`}>作业区</th>
              <th rowSpan={2} className={`${headerClass} w-24`}>区块</th>
              <th rowSpan={2} className={`${headerClass} w-28`}>注水工艺</th>
              <th rowSpan={2} className={`${headerClass} w-24`}>封隔器个数</th>
              <th colSpan={6} className={`${headerClass} w-72`}>单个封隔器型号（自上而下）</th>
              <th rowSpan={2} className={`${headerClass} w-28`}>管柱底<br />部结构</th>
              <th rowSpan={2} className={`${headerClass} w-20`}>是否<br />可洗井</th>
              <th rowSpan={2} className={`${headerClass} w-32`}>是否存在层<br />段间双封隔器</th>
              <th rowSpan={2} className={`${headerClass} w-28`}>洗井<br />特殊提醒</th>
              <th rowSpan={2} className={`${headerClass} w-28`}>最后一次<br />作业日期</th>
              <th rowSpan={2} className={`${headerClass} w-24`}>{"\u7ba1\u67f1\u5165\u4e95"}<br />{"\u65f6\u95f4(\u6708)"}</th>
              <th rowSpan={2} className={`${headerClass} w-20`}>操作</th>
            </tr>
            <tr>
              {[1, 2, 3, 4, 5, 6].map((column) => (
                <th key={column} className={`${headerClass} w-12`}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRecords.map((row, index) => (
              <tr key={row.id}>
                <td className={cellClass}>{(currentPage - 1) * INJECTION_TECH_PAGE_SIZE + index + 1}</td>
                <td className={cellClass}>{row.wellNo}</td>
                <td className={cellClass}>{row.workArea}</td>
                <td className={cellClass}>{row.block}</td>
                <td className={cellClass}>{row.process}</td>
                <td className={cellClass}>{row.packerCount}</td>
                {modelCells(row.packerModels).map((model, modelIndex) => (
                  <td key={`${row.wellNo}-${modelIndex}`} className={cellClass}>{model || "-"}</td>
                ))}
                <td className={cellClass}>{row.bottomStructure}</td>
                <td className={cellClass}>{row.washable}</td>
                <td className={cellClass}>{row.doublePacker}</td>
                <td className={cellClass}>{row.washReminder || "-"}</td>
                <td className={cellClass}>{apiDateOnly(row.lastWorkDate)}</td>
                <td className={cellClass}>{injectionRunningMonthsFromLastWorkDate(row.lastWorkDate)}</td>
                <td className={cellClass}>
                  <button type="button" onClick={() => handleDelete(row)} className="font-bold text-[#ff0000] hover:underline">删除</button>
                </td>
              </tr>
            ))}
            {!visibleRecords.length && (
              <tr>
                <td className={cellClass} colSpan={19}>{loading ? "加载中..." : "暂无符合条件的数据"}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const createEmptyWaterCutForm = () => ({
  unit: FILTER_UNIT_OPTIONS[0],
  block: "",
  wellNo: "",
  sampleDate: todayDateInput(),
  waterCut: "",
  tester: "",
});

const createEmptyWaterCutFilters = () => ({
  unit: "",
  block: "",
  wellNo: "",
  waterCutRange: "",
});

const parseWaterCutOpinions = (remark?: string | null): WaterCutOpinion[] => {
  if (!remark) return [];
  try {
    const parsed = JSON.parse(remark);
    const rows = Array.isArray(parsed?.opinions) ? parsed.opinions : [];
    return rows
      .map((row: any) => ({
        time: String(row?.time || ""),
        content: String(row?.content || ""),
        author: String(row?.author || ""),
      }))
      .filter((row) => row.time || row.content || row.author);
  } catch {
    return [];
  }
};

const stringifyWaterCutOpinions = (opinions: WaterCutOpinion[]) => JSON.stringify({ opinions });

const encodeUtf8 = (value: string) => new TextEncoder().encode(value);
const zipCrcTable = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();
const crc32 = (data: Uint8Array) => {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) {
    crc = zipCrcTable[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
const writeUint16 = (target: number[], value: number) => {
  target.push(value & 0xff, (value >>> 8) & 0xff);
};
const writeUint32 = (target: number[], value: number) => {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
};
const createStoredZip = (files: Array<{ path: string; data: string | Uint8Array }>) => {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  files.forEach((file) => {
    const nameBytes = encodeUtf8(file.path);
    const dataBytes = typeof file.data === "string" ? encodeUtf8(file.data) : file.data;
    const crc = crc32(dataBytes);
    const localHeader: number[] = [];
    writeUint32(localHeader, 0x04034b50);
    writeUint16(localHeader, 20);
    writeUint16(localHeader, 0x0800);
    writeUint16(localHeader, 0);
    writeUint16(localHeader, 0);
    writeUint16(localHeader, 0);
    writeUint32(localHeader, crc);
    writeUint32(localHeader, dataBytes.length);
    writeUint32(localHeader, dataBytes.length);
    writeUint16(localHeader, nameBytes.length);
    writeUint16(localHeader, 0);
    localParts.push(new Uint8Array(localHeader), nameBytes, dataBytes);

    const centralHeader: number[] = [];
    writeUint32(centralHeader, 0x02014b50);
    writeUint16(centralHeader, 20);
    writeUint16(centralHeader, 20);
    writeUint16(centralHeader, 0x0800);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint32(centralHeader, crc);
    writeUint32(centralHeader, dataBytes.length);
    writeUint32(centralHeader, dataBytes.length);
    writeUint16(centralHeader, nameBytes.length);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint16(centralHeader, 0);
    writeUint32(centralHeader, 0);
    writeUint32(centralHeader, offset);
    centralParts.push(new Uint8Array(centralHeader), nameBytes);
    offset += localHeader.length + nameBytes.length + dataBytes.length;
  });
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const centralOffset = offset;
  const endHeader: number[] = [];
  writeUint32(endHeader, 0x06054b50);
  writeUint16(endHeader, 0);
  writeUint16(endHeader, 0);
  writeUint16(endHeader, files.length);
  writeUint16(endHeader, files.length);
  writeUint32(endHeader, centralSize);
  writeUint32(endHeader, centralOffset);
  writeUint16(endHeader, 0);
  const parts = [...localParts, ...centralParts, new Uint8Array(endHeader)];
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  parts.forEach((part) => {
    output.set(part, cursor);
    cursor += part.length;
  });
  return output;
};
const xmlEscape = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const columnName = (index: number) => {
  let name = "";
  let value = index;
  while (value >= 0) {
    name = String.fromCharCode((value % 26) + 65) + name;
    value = Math.floor(value / 26) - 1;
  }
  return name;
};
const sheetXml = (rows: string[][], extraXml = "") => {
  const rowXml = rows.map((row, rowIndex) => (
    `<row r="${rowIndex + 1}">${row.map((cell, columnIndex) => {
      const ref = `${columnName(columnIndex)}${rowIndex + 1}`;
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(cell)}</t></is></c>`;
    }).join("")}</row>`
  )).join("");
  const ref = `A1:${columnName(Math.max(0, rows[0]?.length ?? 1) - 1)}${Math.max(1, rows.length)}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="${ref}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><sheetData>${rowXml}</sheetData>${extraXml}</worksheet>`;
};
const downloadWaterCutTemplateWorkbook = () => {
  const unitOptions = FILTER_UNIT_OPTIONS;
  const blockOptions = getOilProductionBlocks();
  const templateRows = [
    ["单位", "区块", "井号", "日期", "含水 (%)", "化验员"],
    [unitOptions[0], blockOptions[0] || "", "GS-201", "2024-04-10", "92.5", "张三"],
    [unitOptions[1], blockOptions[3] || blockOptions[0] || "", "GS-254", "2024-04-27", "90.3", "周八"],
  ];
  const optionsRows = Array.from({ length: Math.max(unitOptions.length, blockOptions.length) + 1 }, (_, index) => [
    index === 0 ? "单位选项" : unitOptions[index - 1] || "",
    index === 0 ? "区块选项" : blockOptions[index - 1] || "",
  ]);
  const validationXml = `<dataValidations count="2"><dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="A2:A200"><formula1>&apos;选项&apos;!$A$2:$A$${unitOptions.length + 1}</formula1></dataValidation><dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="B2:B200"><formula1>&apos;选项&apos;!$B$2:$B$${blockOptions.length + 1}</formula1></dataValidation></dataValidations>`;
  const workbookBytes = createStoredZip([
    { path: "[Content_Types].xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { path: "_rels/.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { path: "xl/_rels/workbook.xml.rels", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { path: "xl/workbook.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="含水化验导入模板" sheetId="1" r:id="rId1"/><sheet name="选项" sheetId="2" state="hidden" r:id="rId2"/></sheets></workbook>` },
    { path: "xl/styles.xml", data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>` },
    { path: "xl/worksheets/sheet1.xml", data: sheetXml(templateRows, validationXml) },
    { path: "xl/worksheets/sheet2.xml", data: sheetXml(optionsRows) },
  ]);
  const blob = new Blob([workbookBytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "含水化验导入模板.xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const readExcelCell = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
};

const formatExcelDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
  }
  return String(value ?? "").trim().slice(0, 10);
};

const formatExcelWaterCut = (value: unknown) => String(value ?? "").trim().replace(/%$/, "");

function WaterCutPage({ currentUser }: { currentUser: AuthUser | null }) {
  const filterClass = "h-6 rounded border border-[#b8c8d8] bg-white px-2 text-[12px] text-[#001a33] outline-none";
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const [records, setRecords] = useState<WaterCutRecord[]>([]);
  const [filters, setFilters] = useState(() => createEmptyWaterCutFilters());
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpPage, setJumpPage] = useState("1");
  const [totalRows, setTotalRows] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(() => createEmptyWaterCutForm());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [curveWellNo, setCurveWellNo] = useState("");
  const [curveRecords, setCurveRecords] = useState<WaterCutRecord[]>([]);
  const [curveLoading, setCurveLoading] = useState(false);
  const [curveError, setCurveError] = useState("");
  const [curvePosition, setCurvePosition] = useState({ left: 260, top: 96 });
  const curveDragRef = useRef<{ startX: number; startY: number; left: number; top: number } | null>(null);
  const curveRequestIdRef = useRef(0);
  const [opinionRecord, setOpinionRecord] = useState<WaterCutRecord | null>(null);
  const [opinionContent, setOpinionContent] = useState("");
  const [opinionAuthor, setOpinionAuthor] = useState("");
  const [opinionSaving, setOpinionSaving] = useState(false);
  const [opinionError, setOpinionError] = useState("");
  const [error, setError] = useState("");
  const { confirmDialog, requestConfirm } = useStyledConfirmDialog();
  const totalPages = Math.max(1, Math.ceil(totalRows / WATER_CUT_PAGE_SIZE));
  const loadRecords = async (page = currentPage, nextFilters = appliedFilters) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get<PaginatedApiResponse<WaterCutRecord>>("/api/water-cuts", {
        params: {
          ...compactQueryParams(nextFilters),
          page,
          pageSize: WATER_CUT_PAGE_SIZE,
        },
      });
      setRecords(data.rows);
      setTotalRows(data.total);
      setJumpPage(String(data.page));
    } catch (err: any) {
      setError(err?.response?.data?.error || "含水化验记录加载失败");
      setRecords([]);
      setTotalRows(0);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void loadRecords(currentPage, appliedFilters);
  }, [currentPage, appliedFilters]);
  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };
  const goToPage = (page: number) => {
    const nextPage = Math.min(totalPages, Math.max(1, page));
    setCurrentPage(nextPage);
    setJumpPage(String(nextPage));
  };
  const applyCurrentFilters = () => {
    setAppliedFilters(filters);
    setCurrentPage(1);
    setJumpPage("1");
  };
  const updateForm = (key: keyof ReturnType<typeof createEmptyWaterCutForm>, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const handleCreate = async () => {
    if (!form.unit.trim() || !form.block.trim() || !form.wellNo.trim() || !form.sampleDate || !form.waterCut.trim() || !form.tester.trim()) {
      setError("请填写单位、区块、井号、日期、含水和化验员");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await axios.post("/api/water-cuts", form);
      setForm(createEmptyWaterCutForm());
      setShowCreate(false);
      const clearedFilters = createEmptyWaterCutFilters();
      setFilters(clearedFilters);
      setAppliedFilters(clearedFilters);
      setCurrentPage(1);
      await loadRecords(1, clearedFilters);
    } catch (err: any) {
      setError(err?.response?.data?.error || "含水化验记录新增失败");
    } finally {
      setSaving(false);
    }
  };
  const handleDelete = async (record: WaterCutRecord) => {
    requestConfirm(`确认删除 ${record.wellNo} ${apiDateOnly(record.sampleDate)} 的含水化验记录？`, async () => {
      setError("");
      try {
        await axios.delete(`/api/water-cuts/${record.id}`);
        const nextPage = records.length === 1 && currentPage > 1 ? currentPage - 1 : currentPage;
        setCurrentPage(nextPage);
        await loadRecords(nextPage, appliedFilters);
      } catch (err: any) {
        setError(err?.response?.data?.error || "含水化验记录删除失败");
      }
    });
  };
  const openOpinionDialog = (record: WaterCutRecord) => {
    setOpinionRecord(record);
    setOpinionContent("");
    setOpinionAuthor(currentUser?.name || "");
    setOpinionError("");
  };
  const saveOpinion = async () => {
    if (!opinionRecord) return;
    const content = opinionContent.trim();
    const author = opinionAuthor.trim();
    if (!content || !author) {
      setOpinionError("请填写意见内容和意见人");
      return;
    }
    const opinions = [
      ...parseWaterCutOpinions(opinionRecord.remark),
      {
        time: new Date().toLocaleString("zh-CN", { hour12: false }),
        content,
        author,
      },
    ];
    setOpinionSaving(true);
    setOpinionError("");
    try {
      const { data } = await axios.patch<WaterCutRecord>(`/api/water-cuts/${opinionRecord.id}/opinions`, {
        opinions,
      });
      setRecords((current) => current.map((row) => (row.id === data.id ? data : row)));
      setOpinionRecord(data);
      setOpinionContent("");
    } catch (err: any) {
      setOpinionError(err?.response?.data?.error || "意见保存失败");
    } finally {
      setOpinionSaving(false);
    }
  };
  const handleShowCurve = async (record: WaterCutRecord) => {
    const requestId = curveRequestIdRef.current + 1;
    curveRequestIdRef.current = requestId;
    setCurveWellNo(record.wellNo);
    setCurveRecords([]);
    setCurveError("");
    setCurveLoading(true);
    try {
      const { data } = await axios.get<PaginatedApiResponse<WaterCutRecord>>("/api/water-cuts", {
        params: {
          wellNo: record.wellNo,
          page: 1,
          pageSize: 50,
        },
      });
      const rows = (data.rows || [])
        .filter((item) => item.wellNo === record.wellNo)
        .sort((left, right) => apiDateOnly(left.sampleDate).localeCompare(apiDateOnly(right.sampleDate)))
        .slice(-20);
      if (curveRequestIdRef.current !== requestId) return;
      setCurveRecords(rows);
      if (!rows.length) setCurveError("未找到该井号的含水化验记录");
    } catch (err: any) {
      if (curveRequestIdRef.current !== requestId) return;
      setCurveError(err?.response?.data?.error || "含水曲线数据加载失败");
    } finally {
      if (curveRequestIdRef.current === requestId) setCurveLoading(false);
    }
  };
  const startCurveDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    curveDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      left: curvePosition.left,
      top: curvePosition.top,
    };
    event.preventDefault();
  };
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const drag = curveDragRef.current;
      if (!drag) return;
      setCurvePosition({
        left: Math.max(0, Math.min(window.innerWidth - 120, drag.left + event.clientX - drag.startX)),
        top: Math.max(0, Math.min(window.innerHeight - 60, drag.top + event.clientY - drag.startY)),
      });
    };
    const handleMouseUp = () => {
      curveDragRef.current = null;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);
  const curvePoints = curveRecords
    .map((row) => ({
      date: apiDateOnly(row.sampleDate),
      value: Number(row.waterCut),
    }))
    .filter((row) => Number.isFinite(row.value));
  const curveMin = curvePoints.length ? Math.min(...curvePoints.map((point) => point.value)) : 0;
  const curveMax = curvePoints.length ? Math.max(...curvePoints.map((point) => point.value)) : 100;
  const yMin = Math.max(0, Math.floor(curveMin - 2));
  const yMax = Math.min(100, Math.ceil(curveMax + 2));
  const chartWidth = 760;
  const chartHeight = 320;
  const chartPadding = { left: 58, right: 28, top: 28, bottom: 54 };
  const plotWidth = chartWidth - chartPadding.left - chartPadding.right;
  const plotHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  const pointToX = (index: number) => chartPadding.left + (curvePoints.length <= 1 ? plotWidth / 2 : (index / (curvePoints.length - 1)) * plotWidth);
  const pointToY = (value: number) => chartPadding.top + ((yMax - value) / Math.max(1, yMax - yMin)) * plotHeight;
  const curvePolyline = curvePoints.map((point, index) => `${pointToX(index)},${pointToY(point.value)}`).join(" ");
  const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImporting(true);
    setError("");
    setImportStatus("");
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error("Excel 文件中没有可导入的工作表");
      }
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], { defval: "" });
      const parsedRows = rows
        .map((row) => ({
          unit: String(readExcelCell(row, ["单位"])).trim(),
          block: String(readExcelCell(row, ["区块"])).trim(),
          wellNo: String(readExcelCell(row, ["井号"])).trim(),
          sampleDate: formatExcelDate(readExcelCell(row, ["日期"])),
          waterCut: formatExcelWaterCut(readExcelCell(row, ["含水 (%)", "含水(%)", "含水"])),
          tester: String(readExcelCell(row, ["化验员"])).trim(),
        }))
        .filter((row) => row.unit || row.block || row.wellNo || row.sampleDate || row.waterCut || row.tester);

      if (!parsedRows.length) {
        throw new Error("未读取到可导入的数据，请确认表头包含单位、区块、井号、日期、含水 (%)、化验员");
      }

      const { data } = await axios.post<{ imported: number }>("/api/water-cuts/import", { rows: parsedRows });
      setImportStatus(`已导入 ${data.imported} 条`);
      setCurrentPage(1);
      await loadRecords(1, appliedFilters);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || "Excel 导入失败");
    } finally {
      setImporting(false);
    }
  };
  const handleDownloadTemplate = () => {
    downloadWaterCutTemplateWorkbook();
  };

  return (
    <div className="rounded-md border border-[#9fc3e7] bg-white shadow-[0_0_0_1px_rgba(159,195,231,0.25)]">
      {confirmDialog}
      {curveWellNo && (
        <div className="fixed z-[80] w-[820px] border border-[#8fb7df] bg-white shadow-2xl" style={{ left: curvePosition.left, top: curvePosition.top }}>
          <div onMouseDown={startCurveDrag} className="flex cursor-move select-none items-center justify-between border-b border-[#9fc3e7] bg-[#f4f8fc] px-4 py-2">
            <div className="text-lg font-bold text-[#cc0000]">{curveWellNo} 含水曲线</div>
            <button type="button" onClick={() => { setCurveWellNo(""); setCurveRecords([]); setCurveError(""); }} className="h-7 rounded border border-[#8fb7df] bg-[#e8f0f8] px-3 text-xs font-bold text-[#001a33] hover:bg-[#dce9f5]">
              关闭
            </button>
          </div>
          <div className="p-4">
            {curveLoading ? (
              <div className="py-24 text-center text-sm text-gray-500">曲线加载中...</div>
            ) : curveError ? (
              <div className="py-24 text-center text-sm text-red-600">{curveError}</div>
            ) : (
              <svg width={chartWidth} height={chartHeight} className="mx-auto block bg-white">
                <line x1={chartPadding.left} y1={chartPadding.top} x2={chartPadding.left} y2={chartPadding.top + plotHeight} stroke="#6b7280" />
                <line x1={chartPadding.left} y1={chartPadding.top + plotHeight} x2={chartPadding.left + plotWidth} y2={chartPadding.top + plotHeight} stroke="#6b7280" />
                {[0, 1, 2, 3, 4].map((tick) => {
                  const value = yMin + ((yMax - yMin) * tick) / 4;
                  const y = pointToY(value);
                  return (
                    <g key={tick}>
                      <line x1={chartPadding.left} y1={y} x2={chartPadding.left + plotWidth} y2={y} stroke="#dbeafe" />
                      <text x={chartPadding.left - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#001a33">{value.toFixed(1)}</text>
                    </g>
                  );
                })}
                <text x={18} y={chartPadding.top + plotHeight / 2} fontSize="12" fill="#001a33" transform={`rotate(-90 18 ${chartPadding.top + plotHeight / 2})`}>含水(%)</text>
                <text x={chartPadding.left + plotWidth / 2} y={chartHeight - 10} textAnchor="middle" fontSize="12" fill="#001a33">化验日期</text>
                {curvePolyline && <polyline points={curvePolyline} fill="none" stroke="#cc0000" strokeWidth="2.5" />}
                {curvePoints.map((point, index) => {
                  const x = pointToX(index);
                  const y = pointToY(point.value);
                  const showDate = index === 0 || index === curvePoints.length - 1 || index % Math.ceil(Math.max(1, curvePoints.length / 5)) === 0;
                  return (
                    <g key={`${point.date}-${index}`}>
                      <circle cx={x} cy={y} r="4" fill="#cc0000" />
                      <text x={x} y={y - 8} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#cc0000">{point.value.toFixed(1)}</text>
                      {showDate && <text x={x} y={chartPadding.top + plotHeight + 18} textAnchor="middle" fontSize="10" fill="#001a33">{point.date.slice(5)}</text>}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>
      )}
      {opinionRecord && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-3xl border border-[#8fb7df] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#9fc3e7] bg-[#f4f8fc] px-4 py-2">
              <div className="text-lg font-bold text-[#cc0000]">{opinionRecord.wellNo} 意见记录</div>
              <button type="button" onClick={() => setOpinionRecord(null)} className="h-7 rounded border border-[#8fb7df] bg-[#e8f0f8] px-3 text-xs font-bold text-[#001a33] hover:bg-[#dce9f5]">
                关闭
              </button>
            </div>
            <div className="space-y-3 p-4 text-[13px] text-[#001a33]">
              <div className="grid grid-cols-4 gap-2 rounded border border-[#c7d9ec] bg-[#f8fbff] p-2">
                <div><span className="font-bold">单位：</span>{opinionRecord.unit}</div>
                <div><span className="font-bold">区块：</span>{opinionRecord.block}</div>
                <div><span className="font-bold">日期：</span>{apiDateOnly(opinionRecord.sampleDate)}</div>
                <div><span className="font-bold">含水：</span>{Number(opinionRecord.waterCut).toFixed(1)}%</div>
              </div>
              <table className="w-full border-collapse border border-[#9fc3e7] text-center">
                <thead className="bg-[#dcebf8]">
                  <tr>
                    <th className="border border-[#9fc3e7] px-2 py-2">时间</th>
                    <th className="border border-[#9fc3e7] px-2 py-2">意见内容</th>
                    <th className="border border-[#9fc3e7] px-2 py-2">意见人</th>
                  </tr>
                </thead>
                <tbody>
                  {parseWaterCutOpinions(opinionRecord.remark).map((opinion, index) => (
                    <tr key={`${opinion.time}-${index}`}>
                      <td className="border border-[#9fc3e7] px-2 py-2">{opinion.time}</td>
                      <td className="border border-[#9fc3e7] px-2 py-2 text-left">{opinion.content}</td>
                      <td className="border border-[#9fc3e7] px-2 py-2">{opinion.author}</td>
                    </tr>
                  ))}
                  {!parseWaterCutOpinions(opinionRecord.remark).length && (
                    <tr>
                      <td className="border border-[#9fc3e7] px-2 py-8 text-gray-500" colSpan={3}>暂无意见记录</td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="grid grid-cols-[1fr_160px_auto] gap-2">
                <textarea className="min-h-20 rounded border border-[#b8c8d8] px-3 py-2 outline-none focus:border-cnpc-blue" placeholder="请输入意见内容" value={opinionContent} onChange={(event) => setOpinionContent(event.target.value)} />
                <input className="h-8 rounded border border-[#b8c8d8] px-3 outline-none focus:border-cnpc-blue" placeholder="意见人" value={opinionAuthor} onChange={(event) => setOpinionAuthor(event.target.value)} />
                <button type="button" disabled={opinionSaving} onClick={() => void saveOpinion()} className="h-8 rounded border border-[#a8bed5] bg-[#e8f0f8] px-4 font-bold text-[#001a33] hover:bg-[#dce9f5] disabled:opacity-50">
                  {opinionSaving ? "保存中" : "保存"}
                </button>
              </div>
              {opinionError && <div className="text-sm font-bold text-red-600">{opinionError}</div>}
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-2 py-2 text-[12px] text-[#001a33]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <label className="flex items-center gap-1">
            <span>作业区</span>
            <select className={filterClass} value={filters.unit} onChange={(event) => setFilters((current) => ({ ...current, unit: event.target.value, block: "" }))}>
              <option value="">请选择</option>
              {FILTER_UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span>区块</span>
            <select className={`${filterClass} w-28`} value={filters.block} onChange={(event) => updateFilter("block", event.target.value)}>
              <option value="">请选择</option>
              {getFilterBlockOptions(filters.unit).map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span>井号</span>
            <input className={`${filterClass} w-24`} value={filters.wellNo} onChange={(event) => updateFilter("wellNo", event.target.value)} />
          </label>
          <label className="flex items-center gap-1">
            <span>含水</span>
            <select className={filterClass} value={filters.waterCutRange} onChange={(event) => updateFilter("waterCutRange", event.target.value)}>
              <option value="">请选择</option>
              <option value="90-">90%以下</option>
              <option value="90-92">90%-92%</option>
              <option value="92-94">92%-94%</option>
              <option value="94+">94%以上</option>
            </select>
          </label>
          <button type="button" onClick={applyCurrentFilters} className="h-6 rounded border border-[#a8bed5] bg-[#e8f0f8] px-4 text-[12px] text-[#001a33] hover:bg-[#dce9f5]">
            确定
          </button>
          <button type="button" onClick={() => setShowCreate((current) => !current)} className="h-6 rounded border border-[#a8bed5] bg-[#e8f0f8] px-3 text-[12px] text-[#001a33] hover:bg-[#dce9f5]">
            新增
          </button>
          <input ref={excelInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelImport} />
          <button
            type="button"
            disabled={importing}
            onClick={() => excelInputRef.current?.click()}
            className="inline-flex h-6 items-center gap-1 rounded border border-[#a8bed5] bg-[#e8f0f8] px-3 text-[12px] text-[#001a33] hover:bg-[#dce9f5] disabled:opacity-50"
          >
            <Upload className="h-3.5 w-3.5" />
            {importing ? "导入中" : "Excel导入"}
          </button>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex h-6 items-center gap-1 rounded border border-[#a8bed5] bg-[#e8f0f8] px-3 text-[12px] text-[#001a33] hover:bg-[#dce9f5]"
          >
            <Download className="h-3.5 w-3.5" />
            模板下载
          </button>
          {importStatus && <span className="text-[#007a3d]">{importStatus}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2 whitespace-nowrap text-[12px] text-[#001a33]">
          <span>{`第 ${currentPage} 页 共 ${totalPages} 页 共 ${totalRows} 条`}</span>
          <button type="button" onClick={() => goToPage(1)} className="font-bold text-[#0000ee] hover:underline">首页</button>
          <button type="button" onClick={() => goToPage(currentPage - 1)} className="font-bold text-[#0000ee] hover:underline">上一页</button>
          <button type="button" onClick={() => goToPage(currentPage + 1)} className="font-bold text-[#0000ee] hover:underline">下一页</button>
          <button type="button" onClick={() => goToPage(totalPages)} className="font-bold text-[#0000ee] hover:underline">尾页</button>
          <label className="flex items-center gap-1">
            <span>跳转</span>
            <input
              className="h-6 w-8 rounded border border-[#b8c8d8] px-1 text-center text-[12px] outline-none"
              value={jumpPage}
              onChange={(event) => setJumpPage(event.target.value)}
            />
            <span>页</span>
          </label>
          <button type="button" onClick={() => goToPage(Number(jumpPage) || 1)} className="h-5 rounded border border-[#8aa5c0] bg-[#d8e7f5] px-1 text-[11px] font-bold text-[#344b63]">GO</button>
        </div>
      </div>

      {showCreate && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[#9fc3e7] bg-[#f7fbff] px-2 py-2 text-[12px] text-[#001a33]">
          <select className={`${filterClass} w-36`} value={form.unit} onChange={(event) => { updateForm("unit", event.target.value); updateForm("block", ""); }}>
            {FILTER_UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select className={`${filterClass} w-24`} value={form.block} onChange={(event) => updateForm("block", event.target.value)}>
            <option value="">请选择区块</option>
            {getFilterBlockOptions(form.unit).map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <input className={`${filterClass} w-24`} placeholder="井号" value={form.wellNo} onChange={(event) => updateForm("wellNo", event.target.value)} />
          <input className={`${filterClass} w-32`} type="date" value={form.sampleDate} onChange={(event) => updateForm("sampleDate", event.target.value)} />
          <input className={`${filterClass} w-20`} placeholder="含水" value={form.waterCut} onChange={(event) => updateForm("waterCut", event.target.value)} />
          <input className={`${filterClass} w-24`} placeholder="化验员" value={form.tester} onChange={(event) => updateForm("tester", event.target.value)} />
          <button type="button" disabled={saving} onClick={handleCreate} className="h-6 rounded border border-[#a8bed5] bg-[#e8f0f8] px-3 text-[12px] text-[#001a33] hover:bg-[#dce9f5] disabled:opacity-50">
            保存
          </button>
        </div>
      )}

      {error && <div className="border-t border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

      <h1 className="pb-2 text-center text-[22px] font-bold leading-none text-[#cc0000]">单井含水化验监测列表</h1>

      <div className="overflow-x-auto">
        <table className="cnpc-table cnpc-table-water-cut">
          <thead>
            <tr>
              {["序号", "单位", "区块", "井号", "日期", "含水 (%)", "化验员", "操作"].map((header) => (
                <th key={header}>{header !== "序号" && header !== "操作" ? `${header} ↓` : header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((row, index) => (
              <tr key={row.id}>
                <td>{(currentPage - 1) * WATER_CUT_PAGE_SIZE + index + 1}</td>
                <td>{row.unit}</td>
                <td>{row.block}</td>
                <td className="font-bold text-[#213047]">{row.wellNo}</td>
                <td className="font-mono text-[13px]">{apiDateOnly(row.sampleDate)}</td>
                <td className="font-bold text-[#cc0000]">{Number(row.waterCut).toFixed(1)}</td>
                <td>{row.tester}</td>
                <td>
                  <button type="button" onClick={() => void handleShowCurve(row)} className="font-bold text-[#ff0000] hover:underline">曲线</button>
                  <span className="px-1 text-[#ff0000]">|</span>
                  <button type="button" onClick={() => openOpinionDialog(row)} className="font-bold text-[#ff0000] hover:underline">意见</button>
                  <span className="px-1 text-[#ff0000]">|</span>
                  <button type="button" onClick={() => handleDelete(row)} className="font-bold text-[#ff0000] hover:underline">删除</button>
                </td>
              </tr>
            ))}
            {!records.length && (
              <tr>
                <td colSpan={8}>{loading ? "加载中..." : "暂无符合条件的数据"}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DynamicAnalysisPage() {
  const [activeSubMenu, setActiveSubMenu] = useState<"overall" | "single-oil" | "single-water">("overall");
  const [records, setRecords] = useState<DynamicAnalysisRecord[]>([]);
  const [overallOilRecords, setOverallOilRecords] = useState<DynamicAnalysisRecord[]>([]);
  const [overallWaterRecords, setOverallWaterRecords] = useState<DynamicAnalysisRecord[]>([]);
  const [singleOilMonthRecords, setSingleOilMonthRecords] = useState<DynamicAnalysisRecord[]>([]);
  const [singleOilYearRecords, setSingleOilYearRecords] = useState<DynamicAnalysisRecord[]>([]);
  const [singleWaterMonthRecords, setSingleWaterMonthRecords] = useState<DynamicAnalysisRecord[]>([]);
  const [singleWaterYearRecords, setSingleWaterYearRecords] = useState<DynamicAnalysisRecord[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [filters, setFilters] = useState({ unit: "", block: "", wellNo: "" });
  const [overallOilFilters, setOverallOilFilters] = useState({ unit: "", block: "" });
  const [singleOilFilters, setSingleOilFilters] = useState({ unit: "", block: "", wellNo: "" });
  const [singleWaterFilters, setSingleWaterFilters] = useState({ unit: "", block: "", wellNo: "" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [emptyQueryMessage, setEmptyQueryMessage] = useState("");
  const [deleteConfirmRecord, setDeleteConfirmRecord] = useState<DynamicAnalysisRecord | null>(null);
  const defaultOilSingleThresholds = {
    liquid: "2",
    oil: "0.5",
    water: "3",
  };
  const [oilSingleMonthThresholds, setOilSingleMonthThresholds] = useState(defaultOilSingleThresholds);
  const [oilSingleYearThresholds, setOilSingleYearThresholds] = useState(defaultOilSingleThresholds);
  const defaultWaterSingleThresholds = {
    injection: "2",
  };
  const [waterSingleMonthThresholds, setWaterSingleMonthThresholds] = useState(defaultWaterSingleThresholds);
  const [waterSingleYearThresholds, setWaterSingleYearThresholds] = useState(defaultWaterSingleThresholds);
  const subMenus = [
    { id: "overall" as const, label: "总体对比" },
    { id: "single-oil" as const, label: "油井单井对比" },
    { id: "single-water" as const, label: "水井单井对比" },
  ];

  const BLOCK_UNIT_MAP = OIL_PRODUCTION_BLOCK_UNIT_MAP;
  const ALL_BLOCKS = Object.keys(BLOCK_UNIT_MAP);
  const getFilteredBlocks = (unit: string) => {
    return getOilProductionBlocks(unit || undefined);
  };

const groupHeaders = ["旬度末", "上月平均", "上年12月份", "对比上月", "对比上年12月份"];
  const oilColumns = ["总井数", "开井数", "日产液", "日产油", "含水"];
  const waterColumns = ["总井数", "开井数", "日注水"];
  const singleOilColumns = ["日产液", "日产油", "含水"];
  const singleWaterColumns = ["日注水", "油压", "套压"];
  const opinionColumns = ["采油区", "地质所"];
  const blankRows = Array.from({ length: 4 });

  const loadRecords = async (nextFilters = filters) => {
    try {
      setError("");
      const params = Object.fromEntries(Object.entries({ ...nextFilters, page: 1, pageSize: 100 }).filter(([, value]) => String(value).trim()));
      const { data } = await axios.get<PaginatedApiResponse<DynamicAnalysisRecord>>("/api/dynamic-analysis-records", { params });
      setRecords(data.rows);
      setTotalItems(data.total);
      setSelectedId((current) => (data.rows.some((row) => row.id === current) ? current : null));
    } catch (err: any) {
      setError(err?.response?.data?.error || "动态分析对比数据加载失败");
    }
  };

  const loadOverallOilRecords = async (nextFilters = overallOilFilters) => {
    try {
      setError("");
      const params = Object.fromEntries(Object.entries({ ...nextFilters, kind: "overall-oil", page: 1, pageSize: 100 }).filter(([, value]) => String(value).trim()));
      const { data } = await axios.get<PaginatedApiResponse<DynamicAnalysisRecord>>("/api/dynamic-analysis-records", { params });
      setOverallOilRecords(data.rows);
      setSelectedId((current) => (data.rows.some((row) => row.id === current) ? current : null));
    } catch (err: any) {
      setError(err?.response?.data?.error || "油井对比数据加载失败");
    }
  };

  const loadOverallWaterRecords = async (nextFilters = overallOilFilters) => { // shares oil filters
    try {
      setError("");
      const params = Object.fromEntries(Object.entries({ ...nextFilters, kind: "overall-water", page: 1, pageSize: 100 }).filter(([, value]) => String(value).trim()));
      const { data } = await axios.get<PaginatedApiResponse<DynamicAnalysisRecord>>("/api/dynamic-analysis-records", { params });
      setOverallWaterRecords(data.rows);
      setSelectedId((current) => (data.rows.some((row) => row.id === current) ? current : null));
    } catch (err: any) {
      setError(err?.response?.data?.error || "水井对比数据加载失败");
    }
  };

  const loadSingleOilMonthRecords = async (
    nextFilters = singleOilFilters,
    thresholds: { liquid: string; oil: string; water: string } = oilSingleMonthThresholds,
    showEmptyAlert = false,
  ) => {
    try {
      setError("");
      const params = Object.fromEntries(Object.entries({
        ...nextFilters,
        kind: "single-oil",
        diffPeriod: "month",
        ...(thresholds
          ? {
              liquidDiffMin: thresholds.liquid,
              oilDiffMin: thresholds.oil,
              waterDiffMin: thresholds.water,
            }
          : {}),
        page: 1,
        pageSize: 100,
      }).filter(([, value]) => String(value).trim()));
      const { data } = await axios.get<PaginatedApiResponse<DynamicAnalysisRecord>>("/api/dynamic-analysis-records", { params });
      setSingleOilMonthRecords(data.rows);
      setSelectedId((current) => (data.rows.some((row) => row.id === current) ? current : null));
      const emptyMessage = getDynamicAnalysisEmptyQueryMessage(data.rows.length, showEmptyAlert);
      setEmptyQueryMessage(emptyMessage ?? "");
    } catch (err: any) {
      setError(err?.response?.data?.error || "油井单井对比上月数据加载失败");
    }
  };

  const loadSingleOilYearRecords = async (
    nextFilters = singleOilFilters,
    thresholds: { liquid: string; oil: string; water: string } = oilSingleYearThresholds,
    showEmptyAlert = false,
  ) => {
    try {
      setError("");
      const params = Object.fromEntries(Object.entries({
        ...nextFilters,
        kind: "single-oil",
        diffPeriod: "year",
        ...(thresholds
          ? {
              liquidDiffMin: thresholds.liquid,
              oilDiffMin: thresholds.oil,
              waterDiffMin: thresholds.water,
            }
          : {}),
        page: 1,
        pageSize: 100,
      }).filter(([, value]) => String(value).trim()));
      const { data } = await axios.get<PaginatedApiResponse<DynamicAnalysisRecord>>("/api/dynamic-analysis-records", { params });
      setSingleOilYearRecords(data.rows);
      setSelectedId((current) => (data.rows.some((row) => row.id === current) ? current : null));
      const emptyMessage = getDynamicAnalysisEmptyQueryMessage(data.rows.length, showEmptyAlert);
      setEmptyQueryMessage(emptyMessage ?? "");
    } catch (err: any) {
      setError(err?.response?.data?.error || "油井单井对比上年数据加载失败");
    }
  };

  const loadSingleWaterMonthRecords = async (
    nextFilters = singleWaterFilters,
    thresholds: { injection: string } = waterSingleMonthThresholds,
    showEmptyAlert = false,
  ) => {
    try {
      setError("");
      const params = Object.fromEntries(Object.entries({
        ...nextFilters,
        kind: "single-water",
        diffPeriod: "month",
        ...(thresholds ? { injectionDiffMin: thresholds.injection } : {}),
        page: 1,
        pageSize: 100,
      }).filter(([, value]) => String(value).trim()));
      const { data } = await axios.get<PaginatedApiResponse<DynamicAnalysisRecord>>("/api/dynamic-analysis-records", { params });
      setSingleWaterMonthRecords(data.rows);
      setSelectedId((current) => (data.rows.some((row) => row.id === current) ? current : null));
      const emptyMessage = getDynamicAnalysisEmptyQueryMessage(data.rows.length, showEmptyAlert);
      setEmptyQueryMessage(emptyMessage ?? "");
    } catch (err: any) {
      setError(err?.response?.data?.error || "水井单井对比上月数据加载失败");
    }
  };

  const loadSingleWaterYearRecords = async (
    nextFilters = singleWaterFilters,
    thresholds: { injection: string } = waterSingleYearThresholds,
    showEmptyAlert = false,
  ) => {
    try {
      setError("");
      const params = Object.fromEntries(Object.entries({
        ...nextFilters,
        kind: "single-water",
        diffPeriod: "year",
        ...(thresholds ? { injectionDiffMin: thresholds.injection } : {}),
        page: 1,
        pageSize: 100,
      }).filter(([, value]) => String(value).trim()));
      const { data } = await axios.get<PaginatedApiResponse<DynamicAnalysisRecord>>("/api/dynamic-analysis-records", { params });
      setSingleWaterYearRecords(data.rows);
      setSelectedId((current) => (data.rows.some((row) => row.id === current) ? current : null));
      const emptyMessage = getDynamicAnalysisEmptyQueryMessage(data.rows.length, showEmptyAlert);
      setEmptyQueryMessage(emptyMessage ?? "");
    } catch (err: any) {
      setError(err?.response?.data?.error || "水井单井对比上年数据加载失败");
    }
  };

  const loadOilSingleThresholds = async () => {
    try {
      const { data } = await axios.get<Record<string, string>>("/api/config");
      const month = {
        liquid: data.dynamicOilSingleMonthLiquidDiffMin || data.dynamicOilSingleLiquidDiffMin || defaultOilSingleThresholds.liquid,
        oil: data.dynamicOilSingleMonthOilDiffMin || data.dynamicOilSingleOilDiffMin || defaultOilSingleThresholds.oil,
        water: data.dynamicOilSingleMonthWaterDiffMin || data.dynamicOilSingleWaterDiffMin || defaultOilSingleThresholds.water,
      };
      const year = {
        liquid: data.dynamicOilSingleYearLiquidDiffMin || data.dynamicOilSingleLiquidDiffMin || defaultOilSingleThresholds.liquid,
        oil: data.dynamicOilSingleYearOilDiffMin || data.dynamicOilSingleOilDiffMin || defaultOilSingleThresholds.oil,
        water: data.dynamicOilSingleYearWaterDiffMin || data.dynamicOilSingleWaterDiffMin || defaultOilSingleThresholds.water,
      };
      setOilSingleMonthThresholds(month);
      setOilSingleYearThresholds(year);
      return { month, year };
    } catch {
      setOilSingleMonthThresholds(defaultOilSingleThresholds);
      setOilSingleYearThresholds(defaultOilSingleThresholds);
      return { month: defaultOilSingleThresholds, year: defaultOilSingleThresholds };
    }
  };

  const loadWaterSingleThresholds = async () => {
    try {
      const { data } = await axios.get<Record<string, string>>("/api/config");
      const month = {
        injection: data.dynamicWaterSingleMonthInjectionDiffMin || defaultWaterSingleThresholds.injection,
      };
      const year = {
        injection: data.dynamicWaterSingleYearInjectionDiffMin || defaultWaterSingleThresholds.injection,
      };
      setWaterSingleMonthThresholds(month);
      setWaterSingleYearThresholds(year);
      return { month, year };
    } catch {
      setWaterSingleMonthThresholds(defaultWaterSingleThresholds);
      setWaterSingleYearThresholds(defaultWaterSingleThresholds);
      return { month: defaultWaterSingleThresholds, year: defaultWaterSingleThresholds };
    }
  };

  useEffect(() => {
    void (async () => {
      const thresholds = await loadOilSingleThresholds();
      void loadRecords();
      void loadOverallOilRecords();
      void loadOverallWaterRecords();
      void loadSingleOilMonthRecords(singleOilFilters, thresholds.month);
      void loadSingleOilYearRecords(singleOilFilters, thresholds.year);
    })();
    void (async () => {
      const thresholds = await loadWaterSingleThresholds();
      void loadSingleWaterMonthRecords(singleWaterFilters, thresholds.month);
      void loadSingleWaterYearRecords(singleWaterFilters, thresholds.year);
    })();
  }, []);

  useEffect(() => {
    if (activeSubMenu !== "single-oil") return;
    void (async () => {
      const thresholds = await loadOilSingleThresholds();
      void loadSingleOilMonthRecords(singleOilFilters, thresholds.month);
      void loadSingleOilYearRecords(singleOilFilters, thresholds.year);
    })();
  }, [activeSubMenu]);

  useEffect(() => {
    if (activeSubMenu !== "single-water") return;
    void (async () => {
      const thresholds = await loadWaterSingleThresholds();
      void loadSingleWaterMonthRecords(singleWaterFilters, thresholds.month);
      void loadSingleWaterYearRecords(singleWaterFilters, thresholds.year);
    })();
  }, [activeSubMenu]);

  const handleCreate = async () => {
    const kind = window.prompt("类型：overall-oil / overall-water / single-oil / single-water", activeSubMenu === "overall" ? "overall-oil" : activeSubMenu)?.trim();
    if (!kind) return;
    const isWater = kind.includes("water");
    const payload = {
      kind,
      unit: window.prompt("单位", filters.unit || overallOilFilters.unit || "高采采油作业一区")?.trim() || "",
      block: window.prompt("区块", filters.block || overallOilFilters.block || "区块1")?.trim() || "",
      wellNo: kind.startsWith("single") ? window.prompt("井号", filters.wellNo || "GS-NEW")?.trim() || "" : null,
      endValues: isWater ? ["180", "8.5", "12.1"] : ["120", "115", "450", "35", "92%"],
      averageValues: isWater ? ["176", "8.2", "11.8"] : ["120", "112", "445", "34", "91.8%"],
      lastYearValues: isWater ? ["165", "7.9", "11.5"] : ["118", "110", "430", "32", "91.5%"],
      diffMonth: isWater ? ["+4", "+0.3", "+0.3"] : ["0", "+3", "+5", "+1", "0.2%"],
      diffYear: isWater ? ["+15", "+0.6", "+0.6"] : ["+2", "+5", "+20", "+3", "0.5%"],
      advice: ["复核", "跟踪"],
      status: "正常",
      process: "分注",
    };
    try {
      await axios.post("/api/dynamic-analysis-records", payload);
      await loadRecords();
      await loadOverallOilRecords();
      await loadOverallWaterRecords();
      await loadSingleOilMonthRecords();
      await loadSingleOilYearRecords();
      await loadSingleWaterMonthRecords();
      await loadSingleWaterYearRecords();
    } catch (err: any) {
      setError(err?.response?.data?.error || "动态分析对比新增失败");
    }
  };

  const handleDelete = async () => {
    const record = [
      ...records,
      ...overallOilRecords,
      ...overallWaterRecords,
      ...singleOilMonthRecords,
      ...singleOilYearRecords,
      ...singleWaterMonthRecords,
      ...singleWaterYearRecords,
    ].find((row) => row.id === selectedId);
    if (!record) return;
    setDeleteConfirmRecord(record);
  };

  const confirmDelete = async () => {
    const record = deleteConfirmRecord;
    if (!record) return;
    try {
      await axios.delete(`/api/dynamic-analysis-records/${record.id}`);
      setDeleteConfirmRecord(null);
      setSelectedId(null);
      await loadRecords();
      await loadOverallOilRecords();
      await loadOverallWaterRecords();
      await loadSingleOilMonthRecords();
      await loadSingleOilYearRecords();
      await loadSingleWaterMonthRecords();
      await loadSingleWaterYearRecords();
    } catch (err: any) {
      setError(err?.response?.data?.error || "动态分析对比删除失败");
    }
  };

  const renderOverallTable = (columns: string[]) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse bg-white text-center text-base text-black">
        <thead>
          <tr>
            <th rowSpan={2} className="border border-gray-500 px-2 py-2 font-normal">
              鍗曚綅
            </th>
            <th rowSpan={2} className="border border-gray-500 px-2 py-2 font-normal">
              区块
            </th>
            {groupHeaders.map((header) => (
              <th key={header} colSpan={columns.length} className="border border-gray-500 px-2 py-1 font-normal">
                {header}
              </th>
            ))}
          </tr>
          <tr>
            {groupHeaders.flatMap((header) =>
              columns.map((column) => (
                <th key={`${header}-${column}`} className="border border-gray-500 px-2 py-1 font-normal">
                  {column}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {blankRows.map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: 2 + groupHeaders.length * columns.length }).map((__, cellIndex) => (
                <td key={cellIndex} className="h-7 border border-gray-500 px-2 py-1">
                  &nbsp;
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderSingleTable = (compareHeader: "上月平均" | "上年12月份", columns: string[]) => (
    <div className="overflow-x-auto">
      <table className="mx-auto w-auto min-w-max border-collapse bg-white text-center text-base text-black">
        <thead>
          <tr>
            <th rowSpan={2} className="border border-gray-500 px-2 py-1 font-normal">
              鍗曚綅
            </th>
            <th rowSpan={2} className="border border-gray-500 px-2 py-1 font-normal">
              区块
            </th>
            <th rowSpan={2} className="border border-gray-500 px-2 py-1 font-normal">
              井号
            </th>
            <th colSpan={columns.length} className="border border-gray-500 px-2 py-1 font-normal">
              旬度末
            </th>
            <th colSpan={columns.length} className="border border-gray-500 px-2 py-1 font-normal">
              {compareHeader}
            </th>
            <th colSpan={columns.length} className="border border-gray-500 px-2 py-1 font-normal">
              差值
            </th>
            <th colSpan={opinionColumns.length} className="border border-gray-500 px-2 py-1 font-normal">
              处理意见
            </th>
          </tr>
          <tr>
            {["旬度末", compareHeader, "差值"].flatMap((header) =>
              columns.map((column) => (
                <th key={`${header}-${column}`} className="border border-gray-500 px-1 py-1 font-normal">
                  {column}
                </th>
              )),
            )}
            {opinionColumns.map((column) => (
              <th key={column} className="border border-gray-500 px-1 py-1 font-normal">
                {column}
              </th>
            ))}
          </tr>
        </thead>
      </table>
    </div>
  );

  const filterSelectClass = "h-6 rounded border border-[#a8bfd8] bg-white px-2 text-xs text-gray-900 outline-none";
  const tableHeadClass = "border border-[#9fc4e8] bg-[#e3f0fb] px-3 py-2 text-center text-sm font-bold text-slate-900";
  const tableCellClass = "border border-[#9fc4e8] bg-white px-3 py-2 text-center text-sm text-slate-900";
  const selectedAnalysisCellClass = "bg-red-50";
  const getTenDayPeriod = (date: Date) => {
    const day = date.getDate();
    if (day <= 10) return { label: "上旬", start: 1, end: 10 };
    if (day <= 20) return { label: "中旬", start: 11, end: 20 };
    return { label: "下旬", start: 21, end: 31 };
  };
  const today = new Date();
  const currentDay = today.getDate();
  let currentPeriodLabel: string;
  let currentPeriodDate: Date;
  if (currentDay <= 10) {
    currentPeriodLabel = `${today.getFullYear()}年${String(today.getMonth() + 1).padStart(2, "0")}月上旬`;
    currentPeriodDate = today;
  } else if (currentDay <= 20) {
    currentPeriodLabel = `${today.getFullYear()}年${String(today.getMonth() + 1).padStart(2, "0")}月上旬`;
    currentPeriodDate = new Date(today.getFullYear(), today.getMonth(), 10);
  } else {
    currentPeriodLabel = `${today.getFullYear()}年${String(today.getMonth() + 1).padStart(2, "0")}月中旬`;
    currentPeriodDate = new Date(today.getFullYear(), today.getMonth(), 20);
  }
  const prevPeriodDate = new Date(currentPeriodDate.getFullYear(), currentPeriodDate.getMonth(), currentPeriodDate.getDate() - 10);
  const prevPeriod = getTenDayPeriod(prevPeriodDate);
  const previousMonthLabel = `${prevPeriodDate.getFullYear()}年${String(prevPeriodDate.getMonth() + 1).padStart(2, "0")}月${prevPeriod.label}`;
  const currentMonth = currentPeriodDate;
  const previousMonth = prevPeriodDate;
  const formatMonth = (d: Date) => {
    const p = getTenDayPeriod(d);
    return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, "0")}月${p.label}`;
  };
  const statusRows = [
    { no: 1, well: "GS-101", block: "区块1", unit: "", status: "正常", craft: "分注", oil: "3.2", water: "92.1%" },
    { no: 2, well: "GS-102", block: "区块1", unit: "", status: "异常", craft: "分注", oil: "1.5", water: "95.2%" },
    { no: 3, well: "GS-103", block: "区块2", unit: "", status: "维护", craft: "分注", oil: "0", water: "0%" },
    { no: 4, well: "GS-104", block: "区块2", unit: "", status: "正常", craft: "分注", oil: "2.8", water: "91.5%" },
    { no: 5, well: "GS-105", block: "区块3", unit: "", status: "停产", craft: "分注", oil: "0", water: "0%" },
  ];
  const overallOilRows = [
    { unit: "", block: "区块1", end: ["120", "115", "450", "35", "92%"], avg: ["120", "112", "445", "34", "91.8%"], lastYear: ["118", "110", "430", "32", "91.5%"], diffMonth: ["0", "+3", "+5", "+1", "0.2%"], diffYear: ["+2", "+5", "+20", "+3", "0.5%"] },
    { unit: "", block: "区块2", end: ["85", "80", "320", "25", "93%"], avg: ["85", "82", "330", "26", "92.5%"], lastYear: ["82", "78", "300", "23", "92.1%"], diffMonth: ["0", "-2", "-10", "-1", "0.5%"], diffYear: ["+3", "+2", "+20", "+2", "0.9%"] },
    { unit: "", block: "区块3", end: ["150", "140", "600", "45", "91%"], avg: ["150", "138", "590", "44", "90.5%"], lastYear: ["148", "136", "580", "42", "90.2%"], diffMonth: ["0", "+2", "+10", "+1", "0.5%"], diffYear: ["+2", "+4", "+20", "+3", "0.8%"] },
    { unit: "", block: "区块4", end: ["95", "90", "380", "30", "92.5%"], avg: ["95", "88", "375", "29", "92.2%"], lastYear: ["92", "86", "360", "28", "92%"], diffMonth: ["0", "+2", "+5", "+1", "0.3%"], diffYear: ["+3", "+4", "+20", "+2", "0.5%"] },
    { unit: "", block: "区块5", end: ["110", "105", "420", "32", "93.5%"], avg: ["110", "102", "415", "31", "93.1%"], lastYear: ["108", "100", "400", "30", "92.8%"], diffMonth: ["0", "+3", "+5", "+1", "0.4%"], diffYear: ["+2", "+5", "+20", "+2", "0.7%"] },
  ];
  const overallWaterRows = [
    { unit: "", block: "区块1", end: ["48", "46", "180"], avg: ["48", "45", "176"], lastYear: ["47", "44", "165"], diffMonth: ["0", "+1", "+4"], diffYear: ["+1", "+2", "+15"] },
    { unit: "", block: "区块2", end: ["42", "40", "150"], avg: ["42", "41", "158"], lastYear: ["40", "38", "142"], diffMonth: ["0", "-1", "-8"], diffYear: ["+2", "+2", "+8"] },
    { unit: "", block: "区块3", end: ["56", "53", "210"], avg: ["56", "52", "205"], lastYear: ["54", "51", "198"], diffMonth: ["0", "+1", "+5"], diffYear: ["+2", "+2", "+12"] },
    { unit: "", block: "区块4", end: ["30", "28", "120"], avg: ["30", "29", "122"], lastYear: ["28", "27", "115"], diffMonth: ["0", "-1", "-2"], diffYear: ["+2", "+1", "+5"] },
    { unit: "", block: "区块5", end: ["38", "36", "165"], avg: ["38", "35", "160"], lastYear: ["36", "34", "152"], diffMonth: ["0", "+1", "+5"], diffYear: ["+2", "+2", "+13"] },
  ];
  const singleOilSeedRows = [
    { no: 1, unit: "", block: "区块1", well: "GS-101", end: ["450", "35", "92%"], avg: ["445", "34", "91.8%"], lastYear: ["430", "32", "91.5%"], diffMonth: ["+5", "+1", "0.2%"], diffYear: ["+20", "+3", "0.5%"], advice: ["复核配注", "持续观察"] },
    { no: 2, unit: "", block: "区块1", well: "GS-102", end: ["320", "25", "93%"], avg: ["330", "26", "92.5%"], lastYear: ["300", "23", "92.1%"], diffMonth: ["-10", "-1", "0.5%"], diffYear: ["+20", "+2", "0.9%"], advice: ["调整制度", "重点跟踪"] },
    { no: 3, unit: "", block: "区块2", well: "GS-103", end: ["0", "0", "0%"], avg: ["0", "0", "0%"], lastYear: ["280", "18", "94%"], diffMonth: ["0", "0", "0%"], diffYear: ["-280", "-18", "-94%"], advice: ["现场核实", "停产分析"] },
    { no: 4, unit: "", block: "区块2", well: "GS-104", end: ["380", "30", "92.5%"], avg: ["375", "29", "92.2%"], lastYear: ["360", "28", "92%"], diffMonth: ["+5", "+1", "0.3%"], diffYear: ["+20", "+2", "0.5%"], advice: ["正常管理", "维持方案"] },
    { no: 5, unit: "", block: "区块3", well: "GS-105", end: ["420", "32", "93.5%"], avg: ["415", "31", "93.1%"], lastYear: ["400", "30", "92.8%"], diffMonth: ["+5", "+1", "0.4%"], diffYear: ["+20", "+2", "0.7%"], advice: ["优化参数", "跟踪含水"] },
  ];
  const singleOilRows = Array.from({ length: 30 }, (_, index) => {
    const seed = singleOilSeedRows[index % singleOilSeedRows.length];
    const group = Math.floor(index / singleOilSeedRows.length);
    const liquid = Number(seed.end[0]) + group * 8;
    const oil = Number(seed.end[1]) + group;
    const water = Number(seed.end[2].replace("%", "")) + group * 0.1;
    const avgLiquid = liquid - (index % 2 === 0 ? 5 : -10);
    const avgOil = oil - (index % 2 === 0 ? 1 : -1);
    const avgWater = water - 0.2;
    const lastYearLiquid = Math.max(0, liquid - 20);
    const lastYearOil = Math.max(0, oil - 2);
    const lastYearWater = Math.max(0, water - 0.5);
    const diffLiquid = liquid - avgLiquid;
    const diffOil = oil - avgOil;
    const diffWater = Number((water - avgWater).toFixed(1));

    return {
      ...seed,
      no: index + 1,
      block: `区块${(index % 5) + 1}`,
      well: `GS-${String(101 + index).padStart(3, "0")}`,
      end: [String(liquid), String(oil), `${water.toFixed(1)}%`],
      avg: [String(avgLiquid), String(avgOil), `${avgWater.toFixed(1)}%`],
      lastYear: [String(lastYearLiquid), String(lastYearOil), `${lastYearWater.toFixed(1)}%`],
      diffMonth: [`${diffLiquid >= 0 ? "+" : ""}${diffLiquid}`, `${diffOil >= 0 ? "+" : ""}${diffOil}`, `${diffWater >= 0 ? "" : "-"}${Math.abs(diffWater).toFixed(1)}%`],
      diffYear: [`+${liquid - lastYearLiquid}`, `+${oil - lastYearOil}`, `${(water - lastYearWater).toFixed(1)}%`],
    };
  });
  const singleWaterSeedRows = [
    { no: 1, unit: "", block: "区块1", well: "GS-W01", end: ["180", "8.5", "12.1"], avg: ["176", "8.2", "11.8"], lastYear: ["165", "7.9", "11.5"], diffMonth: ["+4", "+0.3", "+0.3"], diffYear: ["+15", "+0.6", "+0.6"], advice: ["稳注", "正常"] },
    { no: 2, unit: "", block: "区块1", well: "GS-W02", end: ["150", "7.8", "10.6"], avg: ["158", "7.9", "10.8"], lastYear: ["142", "7.4", "10.2"], diffMonth: ["-8", "-0.1", "-0.2"], diffYear: ["+8", "+0.4", "+0.4"], advice: ["核查水量", "跟踪压力"] },
    { no: 3, unit: "", block: "区块2", well: "GS-W03", end: ["210", "9.2", "13.4"], avg: ["205", "9.0", "13.1"], lastYear: ["198", "8.8", "12.7"], diffMonth: ["+5", "+0.2", "+0.3"], diffYear: ["+12", "+0.4", "+0.7"], advice: ["适度上调", "加强监测"] },
    { no: 4, unit: "", block: "区块2", well: "GS-W04", end: ["0", "0", "0"], avg: ["0", "0", "0"], lastYear: ["120", "6.5", "9.8"], diffMonth: ["0", "0", "0"], diffYear: ["-120", "-6.5", "-9.8"], advice: ["现场处理", "查明原因"] },
    { no: 5, unit: "", block: "区块3", well: "GS-W05", end: ["165", "8.0", "11.2"], avg: ["160", "7.8", "11.0"], lastYear: ["152", "7.5", "10.7"], diffMonth: ["+5", "+0.2", "+0.2"], diffYear: ["+13", "+0.5", "+0.5"], advice: ["维持注水", "月度复核"] },
  ];
  const singleWaterRows = Array.from({ length: 35 }, (_, index) => {
    const seed = singleWaterSeedRows[index % singleWaterSeedRows.length];
    const group = Math.floor(index / singleWaterSeedRows.length);
    const injection = Number(seed.end[0]) + group * 6;
    const oilPressure = Number(seed.end[1]) + group * 0.2;
    const casingPressure = Number(seed.end[2]) + group * 0.3;
    const avgInjection = injection - (index % 2 === 0 ? 4 : -8);
    const avgOilPressure = oilPressure - (index % 2 === 0 ? 0.2 : -0.1);
    const avgCasingPressure = casingPressure - (index % 2 === 0 ? 0.3 : -0.2);
    const lastYearInjection = Math.max(0, injection - 12);
    const lastYearOilPressure = Math.max(0, oilPressure - 0.4);
    const lastYearCasingPressure = Math.max(0, casingPressure - 0.6);
    const diffInjection = injection - avgInjection;
    const diffOilPressure = Number((oilPressure - avgOilPressure).toFixed(1));
    const diffCasingPressure = Number((casingPressure - avgCasingPressure).toFixed(1));

    return {
      ...seed,
      no: index + 1,
      block: `区块${(index % 5) + 1}`,
      well: `GS-W${String(index + 1).padStart(2, "0")}`,
      end: [String(injection), oilPressure.toFixed(1), casingPressure.toFixed(1)],
      avg: [String(avgInjection), avgOilPressure.toFixed(1), avgCasingPressure.toFixed(1)],
      lastYear: [String(lastYearInjection), lastYearOilPressure.toFixed(1), lastYearCasingPressure.toFixed(1)],
      diffMonth: [
        `${diffInjection >= 0 ? "+" : ""}${diffInjection}`,
        `${diffOilPressure >= 0 ? "+" : ""}${diffOilPressure.toFixed(1)}`,
        `${diffCasingPressure >= 0 ? "+" : ""}${diffCasingPressure.toFixed(1)}`,
      ],
      diffYear: [
        `${injection - lastYearInjection >= 0 ? "+" : ""}${injection - lastYearInjection}`,
        `${(oilPressure - lastYearOilPressure).toFixed(1)}`,
        `${(casingPressure - lastYearCasingPressure).toFixed(1)}`,
      ],
    };
  });

  const toOverallRow = (row: DynamicAnalysisRecord) => ({
    id: row.id,
    unit: row.unit,
    block: row.block,
    end: row.endValues,
    avg: row.averageValues,
    lastYear: row.lastYearValues,
    diffMonth: row.diffMonth,
    diffYear: row.diffYear,
  });
  const toSingleRow = (row: DynamicAnalysisRecord, index: number) => ({
    id: row.id,
    no: index + 1,
    unit: row.unit,
    block: row.block,
    well: row.wellNo || "",
    end: row.endValues,
    avg: row.averageValues,
    lastYear: row.lastYearValues,
    diffMonth: row.diffMonth,
    diffYear: row.diffYear,
    advice: row.advice,
  });
  const apiOverallOilRows = overallOilRecords.map(toOverallRow);
  const apiOverallWaterRows = overallWaterRecords.map(toOverallRow);
  const overallRowOrder = new Map<string, number>(apiOverallOilRows.map((row, index) => [`${row.unit}::${row.block}`, index]));
  const alignedOverallWaterRows = [...apiOverallWaterRows].sort((a, b) => {
    const aOrder = overallRowOrder.get(`${a.unit}::${a.block}`) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = overallRowOrder.get(`${b.unit}::${b.block}`) ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder;
  });
  const apiSingleOilRows = records.filter((row) => row.kind === "single-oil").map(toSingleRow);
  const apiSingleWaterRows = records.filter((row) => row.kind === "single-water").map(toSingleRow);
  const apiSingleOilMonthRows = singleOilMonthRecords.map(toSingleRow).sort((a, b) => parseFloat(a.diffMonth[0]) - parseFloat(b.diffMonth[0]));
  const apiSingleOilYearRows = singleOilYearRecords.map(toSingleRow).sort((a, b) => parseFloat(a.diffYear[0]) - parseFloat(b.diffYear[0]));
  const apiSingleWaterMonthRows = singleWaterMonthRecords.map(toSingleRow).sort((a, b) => parseFloat(a.diffMonth[0]) - parseFloat(b.diffMonth[0]));
  const apiSingleWaterYearRows = singleWaterYearRecords.map(toSingleRow).sort((a, b) => parseFloat(a.diffYear[0]) - parseFloat(b.diffYear[0]));

  const renderOverallFilterBar = (
    values: { unit: string; block: string },
    onChange: (values: { unit: string; block: string }) => void,
    onApply: () => void,
  ) => (
    <div className="flex flex-wrap items-center gap-4 px-2 py-2 text-xs text-slate-900">
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-1">
          作业区
          <select className={filterSelectClass} value={values.unit} onChange={(event) => onChange({ ...values, unit: event.target.value, block: "" })}>
            <option value="">全部单位</option>
            <option>高采采油作业一区</option>
            <option>高采采油作业二区</option>
            <option>高采采油作业三区</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-1">
          区块
          <select className={filterSelectClass} value={values.block} onChange={(event) => onChange({ ...values, block: event.target.value })}>
            <option value="">全部区块</option>
            {getFilteredBlocks(values.unit).map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </label>
        <button className="h-6 rounded border border-[#9eb8d4] bg-[#e4f0fa] px-3 text-xs font-bold text-slate-900" onClick={onApply}>确定</button>
        <button className="h-6 rounded border border-[#9eb8d4] bg-[#e4f0fa] px-3 text-xs font-bold text-slate-900 disabled:opacity-50" disabled={!selectedId} onClick={handleDelete}>删除</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded border border-[#9fc4e8] bg-[#eaf4ff] px-3 py-1 font-bold text-slate-800">本月：{formatMonth(currentMonth)}</span>
        <span className="rounded border border-[#9fc4e8] bg-white px-3 py-1 font-bold text-slate-800">上月：{formatMonth(previousMonth)}</span>
      </div>
    </div>
  );

  const renderOilSingleFilterBar = (
    values: { unit: string; block: string; wellNo: string },
    onChange: (values: { unit: string; block: string; wellNo: string }) => void,
    onApply: (
      values: { unit: string; block: string; wellNo: string },
    ) => void,
    totalCount?: number,
  ) => {
    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const nextValues = {
        unit: String(formData.get("unit") ?? ""),
        block: String(formData.get("block") ?? ""),
        wellNo: String(formData.get("wellNo") ?? ""),
      };
      onChange(nextValues);
      onApply(nextValues);
    };

    return (
      <form className="flex flex-wrap items-center gap-4 px-2 py-2 text-xs text-slate-900" onSubmit={handleSubmit}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1">
            作业区
            <select name="unit" className={filterSelectClass} value={values.unit} onChange={(event) => onChange({ ...values, unit: event.target.value, block: "" })}><option value="">全部单位</option><option>高采采油作业一区</option><option>高采采油作业二区</option><option>高采采油作业三区</option></select>
          </label>
          <label className="inline-flex items-center gap-1">
            区块
            <select name="block" className={filterSelectClass} value={values.block} onChange={(event) => onChange({ ...values, block: event.target.value })}>
              <option value="">全部区块</option>
            {getFilteredBlocks(values.unit).map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          </label>
          <label className="inline-flex items-center gap-1">
            井号
            <input name="wellNo" className="h-6 w-24 rounded border border-[#a8bfd8] bg-white px-2 text-xs outline-none" value={values.wellNo} onChange={(event) => onChange({ ...values, wellNo: event.target.value })} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-[#9fc4e8] bg-[#eaf4ff] px-3 py-1 font-bold text-slate-800">
            上月阈值：日产液≥{oilSingleMonthThresholds.liquid}，日产油≥{oilSingleMonthThresholds.oil}，含水≥{oilSingleMonthThresholds.water}
          </span>
          <span className="rounded border border-[#9fc4e8] bg-white px-3 py-1 font-bold text-slate-800">
            上年12月阈值：日产液≥{oilSingleYearThresholds.liquid}，日产油≥{oilSingleYearThresholds.oil}，含水≥{oilSingleYearThresholds.water}
          </span>
          <button type="submit" className="h-6 rounded border border-[#9eb8d4] bg-[#e4f0fa] px-3 text-xs font-bold text-slate-900">确定</button>
          <button type="button" className="h-6 rounded border border-[#9eb8d4] bg-[#e4f0fa] px-3 text-xs font-bold text-slate-900 disabled:opacity-50" disabled={!selectedId} onClick={handleDelete}>删除</button>
          {typeof totalCount === "number" && (
            <span className="rounded border border-[#9fc4e8] bg-white px-3 py-1 font-bold text-slate-800">
              自动筛选总条数：<span className="text-cnpc-red">{totalCount}</span> 条
            </span>
          )}
        </div>
      </form>
    );
  };

  const renderWaterSingleFilterBar = (
    values: { unit: string; block: string; wellNo: string },
    onChange: (values: { unit: string; block: string; wellNo: string }) => void,
    onApply: (
      values: { unit: string; block: string; wellNo: string },
    ) => void,
    totalCount?: number,
  ) => {
    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      const nextValues = {
        unit: String(formData.get("unit") ?? ""),
        block: String(formData.get("block") ?? ""),
        wellNo: String(formData.get("wellNo") ?? ""),
      };
      onChange(nextValues);
      onApply(nextValues);
    };

    return (
      <form className="flex flex-wrap items-center gap-4 px-2 py-2 text-xs text-slate-900" onSubmit={handleSubmit}>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1">
            作业区
            <select name="unit" className={filterSelectClass} value={values.unit} onChange={(event) => onChange({ ...values, unit: event.target.value, block: "" })}><option value="">全部单位</option><option>高采采油作业一区</option><option>高采采油作业二区</option><option>高采采油作业三区</option></select>
          </label>
          <label className="inline-flex items-center gap-1">
            区块
            <select name="block" className={filterSelectClass} value={values.block} onChange={(event) => onChange({ ...values, block: event.target.value })}>
              <option value="">全部区块</option>
              {getFilteredBlocks(values.unit).map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </label>
          <label className="inline-flex items-center gap-1">
            井号
            <input name="wellNo" className="h-6 w-24 rounded border border-[#a8bfd8] bg-white px-2 text-xs outline-none" value={values.wellNo} onChange={(event) => onChange({ ...values, wellNo: event.target.value })} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded border border-[#9fc4e8] bg-[#eaf4ff] px-3 py-1 font-bold text-slate-800">
            上月阈值：日注水≥{waterSingleMonthThresholds.injection}
          </span>
          <span className="rounded border border-[#9fc4e8] bg-white px-3 py-1 font-bold text-slate-800">
            上年12月阈值：日注水≥{waterSingleYearThresholds.injection}
          </span>
          <button type="submit" className="h-6 rounded border border-[#9eb8d4] bg-[#e4f0fa] px-3 text-xs font-bold text-slate-900">确定</button>
          <button type="button" className="h-6 rounded border border-[#9eb8d4] bg-[#e4f0fa] px-3 text-xs font-bold text-slate-900 disabled:opacity-50" disabled={!selectedId} onClick={handleDelete}>删除</button>
          {typeof totalCount === "number" && (
            <span className="rounded border border-[#9fc4e8] bg-white px-3 py-1 font-bold text-slate-800">
              自动筛选总条数：<span className="text-cnpc-red">{totalCount}</span> 条
            </span>
          )}
        </div>
      </form>
    );
  };
  const renderAnalysisPanel = (title: string, children: React.ReactNode, filterBar?: React.ReactNode) => (
    <section className="space-y-2">
      {filterBar}
      <div className="overflow-hidden rounded border border-[#9fc4e8] bg-[#f8fbff] shadow-sm">
        <h2 className="pb-2 text-center text-xl font-black text-cnpc-red">{title}</h2>
        {children}
      </div>
    </section>
  );

  const renderStatusBadge = (status: string) => {
    const styleMap: Record<string, string> = {
      正常: "bg-emerald-50 text-emerald-600 ring-emerald-300",
      异常: "bg-red-50 text-red-600 ring-red-300",
      维护: "bg-blue-50 text-blue-600 ring-blue-300",
      停产: "bg-slate-50 text-slate-500 ring-slate-300",
    };
    return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1", styleMap[status])}>⊙ {status}</span>;
  };
  const analysisCellClass = (rowId?: string, extra?: string) => cn(tableCellClass, rowId && rowId === selectedId && selectedAnalysisCellClass, extra);
  const formatAnalysisTableValue = (value: string) => {
    const raw = String(value ?? "").trim();
    const match = raw.match(/^([+-]?)(\d+(?:\.\d+)?)(%)?$/);
    if (!match) return raw;
    const [, sign, numericText, percent] = match;
    const rounded = Number(numericText).toFixed(1).replace(/\.0$/, "");
    return `${sign}${rounded}${percent ?? ""}`;
  };

  const renderStatusTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] border-collapse">
        <thead>
          <tr>
            {["序号", "井号 ↕", "区块 ↕", "单位 ↕", "当前状态 ↕", "注水工艺 ↕", "日产油 (t) ↕", "含水率 (%) ↕", "操作"].map((header) => (
              <th key={header} className={tableHeadClass}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {statusRows.map((row) => (
            <tr key={row.well}>
              <td className={tableCellClass}>{row.no}</td>
              <td className={cn(tableCellClass, "font-bold")}>{row.well}</td>
              <td className={tableCellClass}>{row.block}</td>
              <td className={tableCellClass}>{row.unit}</td>
              <td className={tableCellClass}>{renderStatusBadge(row.status)}</td>
              <td className={tableCellClass}>{row.craft}</td>
              <td className={tableCellClass}>{row.oil}</td>
              <td className={tableCellClass}>{row.water}</td>
              <td className={cn(tableCellClass, "font-bold text-red-600")}>浏览&nbsp;|&nbsp;意见&nbsp;|&nbsp;流程</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderOverallCompareTable = (
    rows: Array<{
      id?: string;
      unit: string;
      block: string;
      end: string[];
      avg: string[];
      lastYear: string[];
      diffMonth: string[];
      diffYear: string[];
    }>,
    columns: string[],
  ) => {
    const periodHeaders = ["\u65ec\u5ea6\u672b", "\u4e0a\u6708\u5e73\u5747", "\u4e0a\u5e7412\u6708\u4efd", "\u5bf9\u6bd4\u4e0a\u6708", "\u5bf9\u6bd4\u4e0a\u5e7412\u6708\u4efd"];
    const groupWidth = 305;
    const columnWidth = groupWidth / columns.length;

    return (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1840px] table-fixed border-collapse">
          <colgroup>
            <col className="w-[205px]" />
            <col className="w-[110px]" />
            {periodHeaders.flatMap((header) =>
              columns.map((_, index) => <col key={`${header}-col-${index}`} style={{ width: `${columnWidth}px` }} />),
            )}
          </colgroup>
          <thead>
            <tr>
              <th rowSpan={2} className={tableHeadClass}>{"\u5355\u4f4d"}</th>
              <th rowSpan={2} className={tableHeadClass}>{"\u533a\u5757"}</th>
              {periodHeaders.map((header) => (
                <th key={header} colSpan={columns.length} className={tableHeadClass}>{header}</th>
              ))}
            </tr>
            <tr>
              {periodHeaders.flatMap((header) =>
                columns.map((column, index) => (
                  <th key={`${header}-${index}`} className={tableHeadClass}>{column}</th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id || row.block} className="cursor-pointer" onClick={() => row.id && setSelectedId(row.id)}>
                <td className={analysisCellClass(row.id)}>{row.unit}</td>
                <td className={analysisCellClass(row.id, "font-bold")}>{row.block}</td>
                {[...row.end, ...row.avg, ...row.lastYear].map((value, index) => (
                  <td key={`base-${index}`} className={analysisCellClass(row.id)}>
                    {formatAnalysisTableValue(value)}
                  </td>
                ))}
                {[...row.diffMonth, ...row.diffYear].map((value, index) => (
                  <td key={`diff-${index}`} className={analysisCellClass(row.id, getDiffClass(value))}>
                    {formatAnalysisTableValue(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const getDiffClass = (value: string) => {
    if (value.startsWith("-")) return "font-bold text-red-600";
    if (value.startsWith("+")) return "font-bold text-emerald-600";
    return "font-bold text-emerald-600";
  };

  const renderSingleCompareTable = (
    rows: Array<{
      id?: string;
      no: number;
      unit: string;
      block: string;
      well: string;
      end: string[];
      avg: string[];
      lastYear: string[];
      diffMonth: string[];
      diffYear: string[];
      advice: string[];
    }>,
    columns: string[],
  ) => (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1300px] border-collapse">
        <thead>
          <tr>
            <th rowSpan={2} className={tableHeadClass}>序号</th>
            <th rowSpan={2} className={tableHeadClass}>单位 ↕</th>
            <th rowSpan={2} className={tableHeadClass}>区块 ↕</th>
            <th rowSpan={2} className={tableHeadClass}>井号 ↕</th>
            {["旬度末", "上月平均", "上年12月份", "对比上月", "对比上年12月份"].map((header) => (
              <th key={header} colSpan={columns.length} className={tableHeadClass}>{header}</th>
            ))}
            <th colSpan={2} className={tableHeadClass}>处理意见</th>
            <th rowSpan={2} className={tableHeadClass}>操作</th>
          </tr>
          <tr>
            {["旬度末", "上月平均", "上年12月份", "对比上月", "对比上年12月份"].flatMap((header) =>
              columns.map((column) => (
                <th key={`${header}-${column}`} className={tableHeadClass}>{column}</th>
              )),
            )}
            <th className={tableHeadClass}>采油区</th>
            <th className={tableHeadClass}>地质所</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id || row.well} className="cursor-pointer" onClick={() => row.id && setSelectedId(row.id)}>
              <td className={analysisCellClass(row.id)}>{row.no}</td>
              <td className={analysisCellClass(row.id)}>{row.unit}</td>
              <td className={analysisCellClass(row.id, "font-bold")}>{row.block}</td>
              <td className={analysisCellClass(row.id, "font-bold")}>{row.well}</td>
              {[...row.end, ...row.avg, ...row.lastYear].map((value, index) => (
                <td key={`base-${index}`} className={analysisCellClass(row.id)}>{value}</td>
              ))}
              {[...row.diffMonth, ...row.diffYear].map((value, index) => (
                <td key={`diff-${index}`} className={analysisCellClass(row.id, getDiffClass(value))}>{value}</td>
              ))}
              {row.advice.map((value) => (
                <td key={value} className={analysisCellClass(row.id)}>{value}</td>
              ))}
              <td className={analysisCellClass(row.id, "font-bold text-red-600")}>查看&nbsp;|&nbsp;明细</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderSinglePeriodCompareTable = (
    compareHeader: "上月平均" | "上年12月份",
    rows: Array<(typeof singleOilRows)[number] & { id?: string }>,
    columns = singleOilColumns,
    options: { showTotal?: boolean; maxRows?: number } = {},
  ) => {
    const compareKey = compareHeader === "上月平均" ? "avg" : "lastYear";
    const diffKey = compareHeader === "上月平均" ? "diffMonth" : "diffYear";
    const table = (
      <div className={cn("overflow-x-auto", options.maxRows && "max-h-[430px] overflow-y-auto custom-scrollbar")}>
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr>
              <th rowSpan={2} className={cn(tableHeadClass, options.maxRows && "sticky top-0 z-10")}>单位</th>
              <th rowSpan={2} className={cn(tableHeadClass, options.maxRows && "sticky top-0 z-10")}>区块</th>
              <th rowSpan={2} className={cn(tableHeadClass, options.maxRows && "sticky top-0 z-10")}>井号</th>
              <th colSpan={columns.length} className={cn(tableHeadClass, options.maxRows && "sticky top-0 z-10")}>旬度末</th>
              <th colSpan={columns.length} className={cn(tableHeadClass, options.maxRows && "sticky top-0 z-10")}>{compareHeader}</th>
              <th colSpan={columns.length} className={cn(tableHeadClass, options.maxRows && "sticky top-0 z-10")}>差值</th>
              <th colSpan={2} className={cn(tableHeadClass, options.maxRows && "sticky top-0 z-10")}>处理意见</th>
            </tr>
            <tr>
              {["旬度末", compareHeader, "差值"].flatMap((header) =>
                columns.map((column) => (
                  <th key={`${header}-${column}`} className={cn(tableHeadClass, options.maxRows && "sticky top-[37px] z-10")}>{column}</th>
                )),
              )}
              <th className={cn(tableHeadClass, options.maxRows && "sticky top-[37px] z-10")}>采油区</th>
              <th className={cn(tableHeadClass, options.maxRows && "sticky top-[37px] z-10")}>地质所</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.id || row.well}-${compareHeader}`} className="cursor-pointer" onClick={() => row.id && setSelectedId(row.id)}>
                <td className={analysisCellClass(row.id)}>{row.unit}</td>
                <td className={analysisCellClass(row.id, "font-bold")}>{row.block}</td>
                <td className={analysisCellClass(row.id, "font-bold")}>{row.well}</td>
                {[...row.end, ...row[compareKey]].map((value, index) => (
                  <td key={`base-${index}`} className={analysisCellClass(row.id)}>{value}</td>
                ))}
                {row[diffKey].map((value, index) => (
                  <td key={`diff-${index}`} className={analysisCellClass(row.id, getDiffClass(value))}>{value}</td>
                ))}
                {row.advice.map((value) => (
                  <td key={value} className={analysisCellClass(row.id)}>{value}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

    return (
      <div>
        {table}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {emptyQueryMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded border border-[#8fb7df] bg-white shadow-xl">
            <div className="border-b border-[#9fc4e8] bg-[#eaf4ff] px-4 py-2 text-center text-base font-bold text-[#cc0000]">
              提示
            </div>
            <div className="px-6 py-8 text-center text-sm font-bold text-slate-800">{emptyQueryMessage}</div>
            <div className="flex justify-center border-t border-[#d6e8f8] bg-[#f7fbff] px-4 py-3">
              <button
                type="button"
                onClick={() => setEmptyQueryMessage("")}
                className="h-7 min-w-20 rounded border border-[#2f80ed] bg-[#2f80ed] px-5 text-xs font-bold text-white shadow-sm hover:bg-[#1f6ed4]"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteConfirmRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4">
          <div className="w-full max-w-sm overflow-hidden rounded border border-[#8fb7df] bg-white shadow-xl">
            <div className="border-b border-[#9fc4e8] bg-[#eaf4ff] px-4 py-2 text-center text-base font-bold text-[#cc0000]">
              提示
            </div>
            <div className="px-6 py-8 text-center text-sm font-bold text-slate-800">
              {getDynamicAnalysisDeleteMessage(deleteConfirmRecord)}
            </div>
            <div className="flex justify-center gap-3 border-t border-[#d6e8f8] bg-[#f7fbff] px-4 py-3">
              <button
                type="button"
                onClick={confirmDelete}
                className="h-7 min-w-20 rounded border border-[#2f80ed] bg-[#2f80ed] px-5 text-xs font-bold text-white shadow-sm hover:bg-[#1f6ed4]"
              >
                确定
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmRecord(null)}
                className="h-7 min-w-20 rounded border border-[#9eb8d4] bg-white px-5 text-xs font-bold text-slate-800 shadow-sm hover:bg-[#eaf4ff]"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
      {error && <div className="rounded border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      <div className="text-xs font-bold text-slate-700">共{totalItems}条，当前选中：{selectedId ? "1条" : "无"}</div>
      <div className="inline-flex rounded-xl bg-gray-100 p-1 shadow-sm">
        {subMenus.map((item) => {
          const isActive = activeSubMenu === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSubMenu(item.id)}
              className={cn(
                "min-w-28 rounded-lg px-6 py-2.5 text-sm font-bold transition-all",
                isActive ? "bg-white text-cnpc-red shadow" : "text-slate-600 hover:bg-white/60 hover:text-cnpc-red",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {activeSubMenu === "overall" && (
        <div className="space-y-8">
          {renderAnalysisPanel(
            "油井对比",
            renderOverallCompareTable(apiOverallOilRows, ["总井数", "开井数", "日产液", "日产油", "含水"]),
            renderOverallFilterBar(overallOilFilters, (v) => { setOverallOilFilters(v); }, () => { loadOverallOilRecords(); loadOverallWaterRecords(); }),
          )}
          {renderAnalysisPanel(
            "水井对比",
            renderOverallCompareTable(alignedOverallWaterRows, ["总井数", "开井数", "日注水"]),
            /* filter bar removed - shares oil comparison filter above */ null,
          )}
        </div>
      )}
      {activeSubMenu === "single-oil" && (
        <div className="space-y-8">
          {renderAnalysisPanel(
            "油井单井对比 - 对比上月",
            renderSinglePeriodCompareTable("上月平均", apiSingleOilMonthRows, singleOilColumns, { maxRows: 10 }),
            renderOilSingleFilterBar(
              singleOilFilters,
              setSingleOilFilters,
              async (values) => {
                const thresholds = await loadOilSingleThresholds();
                void loadSingleOilMonthRecords(values, thresholds.month, true);
                void loadSingleOilYearRecords(values, thresholds.year, true);
              },
              apiSingleOilMonthRows.length,
            ),
          )}
          {renderAnalysisPanel(
            "油井单井对比 - 对比上年12月份",
            renderSinglePeriodCompareTable("上年12月份", apiSingleOilYearRows, singleOilColumns, { maxRows: 10 }),
            null,
          )}
        </div>
      )}
      {activeSubMenu === "single-water" && (
        <div className="space-y-8">
          {renderAnalysisPanel(
            "水井单井对比 - 对比上月",
            renderSinglePeriodCompareTable("上月平均", apiSingleWaterMonthRows, singleWaterColumns, { maxRows: 10 }),
            renderWaterSingleFilterBar(
              singleWaterFilters,
              setSingleWaterFilters,
              async (values) => {
                const thresholds = await loadWaterSingleThresholds();
                void loadSingleWaterMonthRecords(values, thresholds.month, true);
                void loadSingleWaterYearRecords(values, thresholds.year, true);
              },
              apiSingleWaterMonthRows.length,
            ),
          )}
          {renderAnalysisPanel(
            "水井单井对比 - 对比上年12月份",
            renderSinglePeriodCompareTable("上年12月份", apiSingleWaterYearRows, singleWaterColumns, { maxRows: 10 }),
            null,
          )}
        </div>
      )}
    </div>
  );
}

function PdfJsPreview({ wellNo, fileUrl, pdfId }: { wellNo: string; fileUrl?: string; pdfId?: string; key?: React.Key }) {
  const [pageNumbers, setPageNumbers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [containerWidth, setContainerWidth] = useState(0);
  const pdfRef = useRef<any | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef(new Map<number, HTMLCanvasElement>());

  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      setLoading(true);
      setError("");
      setPageNumbers([]);
      pdfRef.current = null;

      try {
        const response = await fetch(`/api/well-history-archives/${encodeURIComponent(wellNo)}/pdf-content`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "PDF 加载失败");
        }
        if (!data?.base64) {
          throw new Error("当前井没有可预览的 PDF 内容");
        }

        const bytes = decodeBase64ToUint8Array(data.base64);
        const task = getDocument({ data: bytes.slice() });
        const pdf = await task.promise;
        if (cancelled) {
          pdf.destroy();
          return;
        }

        pdfRef.current = pdf;
        setPageNumbers(Array.from({ length: pdf.numPages }, (_, index) => index + 1));
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || "PDF 渲染失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadPdf();

    return () => {
      cancelled = true;
      const current = pdfRef.current;
      pdfRef.current = null;
      if (current?.destroy) void current.destroy();
      canvasRefs.current.clear();
    };
  }, [wellNo]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const updateWidth = () => setContainerWidth(element.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    window.addEventListener("resize", updateWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const renderPages = async () => {
      if (loading || !pageNumbers.length || !pdfRef.current) return;
      const pdf = pdfRef.current;
      const deviceScale = Math.max(window.devicePixelRatio || 1, 1);

      try {
        for (const pageNumber of pageNumbers) {
          if (cancelled) return;
          const canvas = canvasRefs.current.get(pageNumber);
          if (!canvas) continue;

          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const scale = Math.max(1.15, (containerWidth - 56) / baseViewport.width);
          const viewport = page.getViewport({ scale });
          const scaledViewport = page.getViewport({ scale: scale * deviceScale });
          const context = canvas.getContext("2d");
          if (!context) continue;

          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.clearRect(0, 0, canvas.width, canvas.height);

          await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "PDF 页面渲染失败");
      }
    };

    void renderPages();
    return () => {
      cancelled = true;
    };
  }, [containerWidth, loading, pageNumbers]);

  if (loading) {
    return <div className="border border-gray-200 bg-gray-50 p-10 text-center text-sm text-gray-500">正在加载 PDF 页面...</div>;
  }

  if (error) {
    return (
      <div className="border border-red-100 bg-red-50 p-6 text-sm text-red-600">
        <p>{error}</p>
        {fileUrl && (
          <a href={fileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex font-bold text-cnpc-red hover:underline">
            新窗口打开原始 PDF
          </a>
        )}
      </div>
    );
  }

  if (!pageNumbers.length) {
    return <div className="border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">当前井暂无 PDF 原件。</div>;
  }

  return (
    <div className="overflow-hidden border border-gray-200 bg-slate-50">
      <div className="border-b border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-700">
        共 {pageNumbers.length} 页
      </div>
      <div ref={scrollRef} className="max-h-[78vh] space-y-5 overflow-auto p-4 custom-scrollbar">
        {pageNumbers.map((pageNumber) => (
          <div key={pageNumber} className="w-fit min-w-full border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Page {pageNumber}</div>
            <canvas
              ref={(node) => {
                if (node) canvasRefs.current.set(pageNumber, node);
                else canvasRefs.current.delete(pageNumber);
              }}
              className="mx-auto block border border-gray-100 bg-white"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

type PdfTextNote = {
  id: string;
  type: "text" | "image" | "table";
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  lineHeight?: number;
  editing: boolean;
  imageDataUrl?: string;
  tableRows?: number;
  tableCols?: number;
  tableCells?: string[];
};

type PdfSaveHandler = () => Promise<boolean>;
type PdfDownloadHandler = () => Promise<void>;

type PdfOverlayResponse = {
  pdfId: string;
  elementsJson?: {
    version?: number;
    extraPageCount?: number;
    elements?: Array<Record<string, unknown>>;
  };
  updatedAt?: string | null;
};

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function wrapTextToWidth(text: string, maxWidth: number, measure: (value: string) => number) {
  const lines: string[] = [];
  text.split("\n").forEach((paragraph) => {
    if (!paragraph.trim()) {
      lines.push("");
      return;
    }

    let current = "";
    for (const char of paragraph) {
      const candidate = current + char;
      if (current && measure(candidate) > maxWidth) {
        lines.push(current);
        current = char;
      } else {
        current = candidate;
      }
    }
    lines.push(current);
  });
  return lines;
}

function renderTextNoteToPng(text: string, width: number, height: number, fontSize = 12, lineHeight = Math.max(12, fontSize + 4)) {
  const scale = 3;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建文本渲染画布");

  context.scale(scale, scale);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#000000";
  context.font = `${fontSize}px sans-serif`;
  context.textBaseline = "top";

  const lines = wrapTextToWidth(text, Math.max(1, width - 4), (value) => context.measureText(value).width);
  lines.forEach((line, index) => {
    const y = 2 + index * lineHeight;
    if (y + lineHeight <= height) {
      context.fillText(line, 2, y);
    }
  });

  return canvas.toDataURL("image/png");
}

function renderTableNoteToPng(note: PdfTextNote, width: number, height: number) {
  const scale = 3;
  const rows = Math.max(1, note.tableRows || 3);
  const cols = Math.max(1, note.tableCols || 3);
  const cells = note.tableCells || [];
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建表格渲染画布");

  context.scale(scale, scale);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.strokeStyle = "#1f2937";
  context.lineWidth = 1;
  context.fillStyle = "#000000";
  context.font = `${note.fontSize || 12}px sans-serif`;
  context.textBaseline = "top";

  const cellWidth = width / cols;
  const cellHeight = height / rows;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = col * cellWidth;
      const y = row * cellHeight;
      context.strokeRect(x, y, cellWidth, cellHeight);
      const text = String(cells[row * cols + col] ?? "");
      const lines = wrapTextToWidth(text, Math.max(1, cellWidth - 8), (value) => context.measureText(value).width);
      lines.slice(0, Math.max(1, Math.floor(cellHeight / Math.max(12, (note.fontSize || 12) + 4)))).forEach((line, index) => {
        context.fillText(line, x + 4, y + 4 + index * Math.max(12, (note.fontSize || 12) + 4));
      });
    }
  }

  return canvas.toDataURL("image/png");
}

function PdfReaderEditor({
  wellNo,
  fileUrl,
  pdfId,
  onDirtyChange,
  onSaveHandlerChange,
  onDownloadHandlerChange,
}: {
  wellNo: string;
  fileUrl?: string;
  pdfId?: string;
  key?: React.Key;
  onDirtyChange?: (dirty: boolean) => void;
  onSaveHandlerChange?: (handler: PdfSaveHandler | null) => void;
  onDownloadHandlerChange?: (handler: PdfDownloadHandler | null) => void;
}) {
  const [pageNumbers, setPageNumbers] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [originalPageCount, setOriginalPageCount] = useState(0);
  const [extraPageCount, setExtraPageCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [fitWidth, setFitWidth] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [notes, setNotes] = useState<PdfTextNote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [activeNoteId, setActiveNoteId] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const pdfRef = useRef<any | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const canvasRefs = useRef(new Map<number, HTMLCanvasElement>());
  const pageRefs = useRef(new Map<number, HTMLDivElement>());
  const noteLayerRefs = useRef(new Map<number, HTMLDivElement>());
  const dragRef = useRef<{ id: string; pageNumber: number; offsetX: number; offsetY: number } | null>(null);
  const resizeRef = useRef<{ id: string; pageNumber: number; startWidth: number; startHeight: number; startClientX: number; startClientY: number } | null>(null);
  const copiedNoteRef = useRef<PdfTextNote | null>(null);
  const saveHandlerRef = useRef<PdfSaveHandler | null>(null);
  const downloadHandlerRef = useRef<PdfDownloadHandler | null>(null);
  const { confirmDialog, requestConfirm } = useStyledConfirmDialog();

  const serializeNotes = (source: PdfTextNote[]) => ({
    version: 1,
    extraPageCount,
    elements: source.map((note) => ({
      type: note.type,
      id: note.id,
      pageNumber: note.pageNumber,
      x: note.x,
      y: note.y,
      width: note.width,
      height: note.height,
      text: note.text,
      fontSize: note.fontSize,
      lineHeight: note.lineHeight,
      imageDataUrl: note.imageDataUrl,
      tableRows: note.tableRows,
      tableCols: note.tableCols,
      tableCells: note.tableCells,
    })),
  });

  const markDirty = () => {
    setDirty(true);
    onDirtyChange?.(true);
  };

  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      setLoading(true);
      setError("");
      setPageNumbers([]);
      setCurrentPage(1);
      setOriginalPageCount(0);
      setExtraPageCount(0);
      setNotes([]);
      setSelectedNoteId("");
      setActiveNoteId("");
      setSaveStatus("");
      setDirty(false);
      onDirtyChange?.(false);
      setPdfBytes(null);
      pdfRef.current = null;

      try {
        const response = await fetch(`/api/well-history-archives/${encodeURIComponent(wellNo)}/pdf-content`);
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "PDF 加载失败");
        if (!data?.base64) throw new Error("当前井没有可预览的 PDF 内容");

        const bytes = decodeBase64ToUint8Array(data.base64);
        setPdfBytes(bytes);
        const task = getDocument({ data: bytes.slice() });
        const pdf = await task.promise;
        if (cancelled) {
          pdf.destroy();
          return;
        }

        pdfRef.current = pdf;
        const basePageCount = pdf.numPages;
        let restoredExtraPageCount = 0;
        setOriginalPageCount(basePageCount);

        if (pdfId) {
          const overlayResponse = await axios.get<PdfOverlayResponse>(`/api/well-history-archives/${encodeURIComponent(wellNo)}/pdf-overlay`);
          if (!cancelled) {
            restoredExtraPageCount = Math.max(0, Number(overlayResponse.data?.elementsJson?.extraPageCount ?? 0));
            const restored = (overlayResponse.data?.elementsJson?.elements ?? [])
              .filter((element) => ["text", "image", "table"].includes(String(element?.type ?? "text")))
              .map((element) => ({
                id: String(element.id ?? crypto.randomUUID()),
                type: ["image", "table"].includes(String(element.type)) ? String(element.type) as PdfTextNote["type"] : "text",
                pageNumber: Number(element.pageNumber ?? 1),
                x: Number(element.x ?? 0.06),
                y: Number(element.y ?? 0.06),
                width: Number(element.width ?? 0.24),
                height: Number(element.height ?? 0.08),
                text: String(element.text ?? ""),
                fontSize: Number(element.fontSize ?? 12),
                lineHeight: Number(element.lineHeight ?? 0) || undefined,
                imageDataUrl: typeof element.imageDataUrl === "string" ? element.imageDataUrl : undefined,
                tableRows: Number(element.tableRows ?? 3),
                tableCols: Number(element.tableCols ?? 3),
                tableCells: Array.isArray(element.tableCells) ? element.tableCells.map((cell) => String(cell ?? "")) : undefined,
                editing: false,
              }));
            setNotes(restored);
            setExtraPageCount(restoredExtraPageCount);
            setDirty(false);
            onDirtyChange?.(false);
            if (overlayResponse.data?.updatedAt) {
              setSaveStatus(`已加载 ${formatTime(overlayResponse.data.updatedAt)} 的编辑结果`);
            }
          }
        }
        if (!cancelled) {
          setPageNumbers(Array.from({ length: basePageCount + restoredExtraPageCount }, (_, index) => index + 1));
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "PDF 渲染失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadPdf();

    return () => {
      cancelled = true;
      const current = pdfRef.current;
      pdfRef.current = null;
      if (current?.destroy) void current.destroy();
      canvasRefs.current.clear();
      pageRefs.current.clear();
      noteLayerRefs.current.clear();
    };
  }, [pdfId, wellNo]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const updateWidth = () => setContainerWidth(element.clientWidth);
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    window.addEventListener("resize", updateWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateWidth);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const renderPages = async () => {
      if (loading || !pageNumbers.length || !pdfRef.current) return;
      const pdf = pdfRef.current;
      const deviceScale = Math.max(window.devicePixelRatio || 1, 1);

      try {
        for (const pageNumber of pageNumbers) {
          if (cancelled) return;
          const canvas = canvasRefs.current.get(pageNumber);
          if (!canvas) continue;

          const page = await pdf.getPage(Math.min(pageNumber, originalPageCount));
          const baseViewport = page.getViewport({ scale: 1 });
          const fitWidthScale = containerWidth ? (containerWidth - 56) / baseViewport.width : 1;
          const scale = fitWidth ? Math.max(0.35, fitWidthScale) : zoom;
          const viewport = page.getViewport({ scale });
          const scaledViewport = page.getViewport({ scale: scale * deviceScale });
          const context = canvas.getContext("2d");
          if (!context) continue;

          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.clearRect(0, 0, canvas.width, canvas.height);
          if (pageNumber <= originalPageCount) {
            await page.render({ canvasContext: context, viewport: scaledViewport }).promise;
          } else {
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, canvas.width, canvas.height);
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "PDF 页面渲染失败");
      }
    };

    void renderPages();
    return () => {
      cancelled = true;
    };
  }, [containerWidth, fitWidth, loading, originalPageCount, pageNumbers, zoom]);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement || !pageNumbers.length) return;

    const handleScroll = () => {
      const containerRect = scrollElement.getBoundingClientRect();
      let nearestPage = pageNumbers[0];
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const pageNumber of pageNumbers) {
        const pageElement = pageRefs.current.get(pageNumber);
        if (!pageElement) continue;
        const rect = pageElement.getBoundingClientRect();
        const distance = Math.abs(rect.top - containerRect.top - 16);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestPage = pageNumber;
        }
      }

      setCurrentPage(nearestPage);
    };

    handleScroll();
    scrollElement.addEventListener("scroll", handleScroll);
    return () => scrollElement.removeEventListener("scroll", handleScroll);
  }, [pageNumbers]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (drag) {
        const layerElement = noteLayerRefs.current.get(drag.pageNumber);
        if (!layerElement) return;
        const rect = layerElement.getBoundingClientRect();
        const nextX = (event.clientX - rect.left - drag.offsetX) / rect.width;
        const nextY = (event.clientY - rect.top - drag.offsetY) / rect.height;
        setNotes((current) =>
          current.map((note) =>
            note.id === drag.id
              ? { ...note, x: Math.min(0.96 - note.width, Math.max(0, nextX)), y: Math.min(0.98 - note.height, Math.max(0, nextY)) }
              : note,
          ),
        );
        markDirty();
        return;
      }

      const resize = resizeRef.current;
      if (!resize) return;
      const layerElement = noteLayerRefs.current.get(resize.pageNumber);
      if (!layerElement) return;
      const rect = layerElement.getBoundingClientRect();
      const deltaX = (event.clientX - resize.startClientX) / rect.width;
      const deltaY = (event.clientY - resize.startClientY) / rect.height;
      setNotes((current) =>
        current.map((note) =>
          note.id === resize.id
            ? { ...note, width: Math.min(0.9, Math.max(0.05, resize.startWidth + deltaX)), height: Math.min(0.7, Math.max(0.035, resize.startHeight + deltaY)) }
            : note,
        ),
      );
      markDirty();
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
      setActiveNoteId("");
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      const element = target instanceof HTMLElement ? target : null;
      if (!element) return false;
      return Boolean(element.closest("input, textarea, select, [contenteditable='true']"));
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || !selectedNoteId) return;
      const selectedNote = notes.find((note) => note.id === selectedNoteId);
      if (!selectedNote) return;

      const moveStep = event.shiftKey ? 0.02 : 0.005;
      const copyToCurrentPage = () => {
        const source = copiedNoteRef.current || selectedNote;
        const noteId = `${currentPage}-${Date.now()}`;
        setNotes((current) => [
          ...current.map((note) => ({ ...note, editing: false })),
          {
            ...source,
            id: noteId,
            pageNumber: currentPage,
            x: Math.min(0.92 - source.width, Math.max(0, source.pageNumber === currentPage ? source.x + 0.03 : source.x)),
            y: Math.min(0.95 - source.height, Math.max(0, source.pageNumber === currentPage ? source.y + 0.03 : source.y)),
            editing: false,
          },
        ]);
        setSelectedNoteId(noteId);
        setActiveNoteId(noteId);
        markDirty();
      };
      const moveToPage = (pageDelta: number) => {
        const nextPage = Math.min(pageNumbers.length, Math.max(1, selectedNote.pageNumber + pageDelta));
        if (nextPage === selectedNote.pageNumber) return;
        setNotes((current) => current.map((note) => (note.id === selectedNote.id ? { ...note, pageNumber: nextPage, editing: false } : note)));
        setCurrentPage(nextPage);
        setActiveNoteId(selectedNote.id);
        markDirty();
        window.setTimeout(() => scrollToPage(nextPage), 0);
      };

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelectedNote();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copiedNoteRef.current = { ...selectedNote, editing: false };
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        event.preventDefault();
        copyToCurrentPage();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        event.preventDefault();
        copiedNoteRef.current = { ...selectedNote, editing: false };
        copyToCurrentPage();
        return;
      }
      if ((event.altKey || event.ctrlKey || event.metaKey) && event.key === "PageUp") {
        event.preventDefault();
        moveToPage(-1);
        return;
      }
      if ((event.altKey || event.ctrlKey || event.metaKey) && event.key === "PageDown") {
        event.preventDefault();
        moveToPage(1);
        return;
      }
      const moveByKey: Record<string, [number, number]> = {
        ArrowLeft: [-moveStep, 0],
        ArrowRight: [moveStep, 0],
        ArrowUp: [0, -moveStep],
        ArrowDown: [0, moveStep],
      };
      const delta = moveByKey[event.key];
      if (!delta) return;
      event.preventDefault();
      setNotes((current) =>
        current.map((note) =>
          note.id === selectedNote.id
            ? {
                ...note,
                x: Math.min(0.98 - note.width, Math.max(0, note.x + delta[0])),
                y: Math.min(0.98 - note.height, Math.max(0, note.y + delta[1])),
                editing: false,
              }
            : note,
        ),
      );
      setActiveNoteId(selectedNote.id);
      markDirty();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, notes, pageNumbers.length, selectedNoteId]);

  const scrollToPage = (pageNumber: number) => {
    const pageElement = pageRefs.current.get(pageNumber);
    const scrollElement = scrollRef.current;
    if (!pageElement || !scrollElement) return;
    scrollElement.scrollTo({
      top: pageElement.offsetTop - scrollElement.offsetTop,
      behavior: "smooth",
    });
  };

  const startNoteDrag = (note: PdfTextNote, event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    const layerElement = noteLayerRefs.current.get(note.pageNumber);
    if (!layerElement) return;
    const rect = layerElement.getBoundingClientRect();
    setSelectedNoteId(note.id);
    setActiveNoteId(note.id);
    dragRef.current = {
      id: note.id,
      pageNumber: note.pageNumber,
      offsetX: Math.max(0, event.clientX - (rect.left + rect.width * note.x)),
      offsetY: Math.max(0, event.clientY - (rect.top + rect.height * note.y)),
    };
  };

  const createTextNote = () => {
    const pageNumber = currentPage || pageNumbers[0];
    if (!pageNumber) return;
    const noteId = `${pageNumber}-${Date.now()}`;
    setNotes((current) => [
      ...current.map((note) => ({ ...note, editing: false })),
      {
        id: noteId,
        pageNumber,
        type: "text",
        x: 0.08,
        y: 0.12,
        width: 0.24,
        height: 0.075,
        text: "",
        fontSize: 12,
        lineHeight: 16,
        editing: true,
      },
    ]);
    setSelectedNoteId(noteId);
    setActiveNoteId(noteId);
    markDirty();
  };

  const createImageNote = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const pageNumber = currentPage || pageNumbers[0];
      const imageDataUrl = String(reader.result || "");
      if (!pageNumber || !imageDataUrl) return;
      const noteId = `${pageNumber}-image-${Date.now()}`;
      setNotes((current) => [
        ...current.map((note) => ({ ...note, editing: false })),
        {
          id: noteId,
          type: "image",
          pageNumber,
          x: 0.08,
          y: 0.12,
          width: 0.35,
          height: 0.22,
          text: "",
          fontSize: 12,
          editing: false,
          imageDataUrl,
        },
      ]);
      setSelectedNoteId(noteId);
      setActiveNoteId(noteId);
      markDirty();
    };
    reader.readAsDataURL(file);
  };

  const createTableNote = () => {
    const pageNumber = currentPage || pageNumbers[0];
    if (!pageNumber) return;
    const rows = 3;
    const cols = 3;
    const noteId = `${pageNumber}-table-${Date.now()}`;
    setNotes((current) => [
      ...current.map((note) => ({ ...note, editing: false })),
      {
        id: noteId,
        type: "table",
        pageNumber,
        x: 0.08,
        y: 0.12,
        width: 0.42,
        height: 0.2,
        text: "",
        fontSize: 12,
        editing: false,
        tableRows: rows,
        tableCols: cols,
        tableCells: Array.from({ length: rows * cols }, () => ""),
      },
    ]);
    setSelectedNoteId(noteId);
    setActiveNoteId(noteId);
    markDirty();
  };

  const addBlankPage = () => {
    if (!originalPageCount) return;
    const nextPageNumber = pageNumbers.length + 1;
    setExtraPageCount((current) => current + 1);
    setPageNumbers((current) => [...current, nextPageNumber]);
    setCurrentPage(nextPageNumber);
    markDirty();
    window.setTimeout(() => scrollToPage(nextPageNumber), 0);
  };

  const deleteLastBlankPage = () => {
    if (!extraPageCount) return;
    const lastExtraPageNumber = originalPageCount + extraPageCount;
    const notesOnLastPage = notes.filter((note) => note.pageNumber === lastExtraPageNumber && note.text.trim());
    const removePage = () => {
      setNotes((current) => current.filter((note) => note.pageNumber !== lastExtraPageNumber));
      setPageNumbers((current) => current.filter((pageNumber) => pageNumber !== lastExtraPageNumber));
      setExtraPageCount((current) => Math.max(0, current - 1));
      setSelectedNoteId("");
      setActiveNoteId("");
      setCurrentPage(Math.min(lastExtraPageNumber - 1, Math.max(1, pageNumbers.length - 1)));
      markDirty();
    };

    if (notesOnLastPage.length) {
      requestConfirm("最后一页新增页上有文本内容，删除后这些内容也会删除。是否继续？", removePage);
      return;
    }

    removePage();
  };

  const beginNoteEditing = (noteId: string) => {
    setSelectedNoteId(noteId);
    setActiveNoteId(noteId);
    setNotes((current) => current.map((note) => (note.id === noteId ? { ...note, editing: true } : { ...note, editing: false })));
  };

  const finishNoteEditing = (noteId: string) => {
    setNotes((current) =>
      current.flatMap((note) => {
        if (note.id !== noteId) return [note];
        if (note.type !== "text") return [{ ...note, editing: false }];
        const text = note.text.trim();
        if (!text) return [];
        return [{ ...note, text, editing: false }];
      }),
    );
    setSelectedNoteId("");
    setActiveNoteId("");
    markDirty();
  };

  const changeSelectedFontSize = (delta: number) => {
    const targetNoteId = selectedNoteId || activeNoteId;
    if (!targetNoteId) return;
    setNotes((current) =>
      current.map((note) =>
        note.id === targetNoteId
          ? { ...note, fontSize: Math.min(36, Math.max(8, note.fontSize + delta)) }
          : note,
      ),
    );
    setSelectedNoteId(targetNoteId);
    setActiveNoteId(targetNoteId);
    markDirty();
  };

  const changeSelectedLineHeight = (delta: number) => {
    const targetNoteId = selectedNoteId || activeNoteId;
    if (!targetNoteId) return;
    setNotes((current) =>
      current.map((note) => {
        if (note.id !== targetNoteId) return note;
        const currentLineHeight = note.lineHeight ?? Math.max(12, note.fontSize + 4);
        return { ...note, lineHeight: Math.min(64, Math.max(10, currentLineHeight + delta)) };
      }),
    );
    setSelectedNoteId(targetNoteId);
    setActiveNoteId(targetNoteId);
    markDirty();
  };

  const deleteSelectedNote = () => {
    if (!selectedNoteId) return;
    setNotes((current) => current.filter((note) => note.id !== selectedNoteId));
    setSelectedNoteId("");
    setActiveNoteId("");
    markDirty();
  };

  const handleSave = async () => {
    if (!pdfId) return false;
    setSaving(true);
    setSaveStatus("");
    try {
      await axios.post(`/api/well-history-archives/${encodeURIComponent(wellNo)}/pdf-overlay`, {
        pdfId,
        elementsJson: serializeNotes(notes),
      });
      setDirty(false);
      onDirtyChange?.(false);
      setSaveStatus("编辑结果已保存");
      return true;
    } catch (err: any) {
      setSaveStatus(err?.response?.data?.error || "保存编辑结果失败");
      return false;
    } finally {
      setSaving(false);
    }
  };

  saveHandlerRef.current = handleSave;

  useEffect(() => {
    if (!onSaveHandlerChange) return;
    onSaveHandlerChange(() => saveHandlerRef.current?.() ?? Promise.resolve(false));
    return () => onSaveHandlerChange(null);
  }, [onSaveHandlerChange]);

  const handleDownload = async () => {
    if (!pdfBytes) return;
    setDownloading(true);
    setError("");
    try {
      const pdfDoc = await PDFDocument.load(pdfBytes.slice());
      const existingPages = pdfDoc.getPages();
      const lastPage = existingPages[existingPages.length - 1];
      const { width: extraPageWidth, height: extraPageHeight } = lastPage?.getSize() ?? { width: 595, height: 842 };
      for (let index = 0; index < extraPageCount; index += 1) {
        pdfDoc.addPage([extraPageWidth, extraPageHeight]);
      }
      const pages = pdfDoc.getPages();

      for (const note of notes) {
        const page = pages[note.pageNumber - 1];
        if (!page) continue;
        const { width, height } = page.getSize();
        const boxWidth = width * note.width;
        const boxHeight = height * note.height;
        let pngImage;
        if (note.type === "image" && note.imageDataUrl) {
          pngImage = note.imageDataUrl.startsWith("data:image/jpeg") || note.imageDataUrl.startsWith("data:image/jpg")
            ? await pdfDoc.embedJpg(note.imageDataUrl)
            : await pdfDoc.embedPng(note.imageDataUrl);
        } else if (note.type === "table") {
          pngImage = await pdfDoc.embedPng(renderTableNoteToPng(note, boxWidth, boxHeight));
        } else {
          if (!note.text.trim()) continue;
          pngImage = await pdfDoc.embedPng(renderTextNoteToPng(note.text, boxWidth, boxHeight, note.fontSize, note.lineHeight));
        }
        page.drawImage(pngImage, {
          x: note.x * width,
          y: height - note.y * height - boxHeight,
          width: boxWidth,
          height: boxHeight,
        });
      }

      const result = await pdfDoc.save();
      downloadBlob(new Blob([result], { type: "application/pdf" }), `${wellNo}-edited.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "下载带编辑内容的 PDF 失败");
    } finally {
      setDownloading(false);
    }
  };

  downloadHandlerRef.current = handleDownload;

  useEffect(() => {
    if (!onDownloadHandlerChange) return;
    onDownloadHandlerChange(() => downloadHandlerRef.current?.() ?? Promise.resolve());
    return () => onDownloadHandlerChange(null);
  }, [onDownloadHandlerChange]);

  if (loading) {
    return <div className="border border-gray-200 bg-gray-50 p-10 text-center text-sm text-gray-500">正在加载 PDF 页面...</div>;
  }

  if (error && !pageNumbers.length) {
    return (
      <div className="border border-red-100 bg-red-50 p-6 text-sm text-red-600">
        <p>{error}</p>
        {fileUrl && (
          <a href={fileUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex font-bold text-cnpc-red hover:underline">
            新窗口打开原始 PDF
          </a>
        )}
      </div>
    );
  }

  if (!pageNumbers.length) {
    return <div className="border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">当前井暂无 PDF 原件。</div>;
  }

  const isSinglePage = pageNumbers.length === 1;

  return (
    <div className={cn("flex flex-col border border-gray-200 bg-slate-100", isSinglePage ? "overflow-visible" : "h-[calc(100vh-80px)] min-h-[760px] overflow-hidden")}>
      {confirmDialog}
      <div className="shrink-0 flex flex-wrap items-center gap-2 border-b border-gray-200 bg-white px-3 py-2 text-sm">
        <span className="bg-slate-100 px-3 py-2 font-bold text-gray-700">第 {currentPage} / {pageNumbers.length} 页</span>
        <button onClick={() => scrollToPage(Math.max(1, currentPage - 1))} className="border border-gray-200 px-3 py-2 font-bold text-gray-700 hover:bg-slate-50">上一页</button>
        <button onClick={() => scrollToPage(Math.min(pageNumbers.length, currentPage + 1))} className="border border-gray-200 px-3 py-2 font-bold text-gray-700 hover:bg-slate-50">下一页</button>
        <select value={currentPage} onChange={(event) => scrollToPage(Number(event.target.value))} className="border border-gray-200 px-3 py-2 outline-none focus:border-cnpc-red">
          {pageNumbers.map((pageNumber) => (
            <option key={pageNumber} value={pageNumber}>第 {pageNumber} 页</option>
          ))}
        </select>
        <span className="mx-1 h-6 w-px bg-gray-200" />
        <button onClick={() => { setFitWidth(false); setZoom((value) => Math.max(0.5, Number((value - 0.1).toFixed(2)))); }} className="border border-gray-200 px-3 py-2 font-bold text-gray-700 hover:bg-slate-50" title="缩小">
          <Minus className="h-4 w-4" />
        </button>
        <span className="bg-slate-100 px-3 py-2 font-bold text-gray-700">{fitWidth ? "自适应" : `${Math.round(zoom * 100)}%`}</span>
        <button onClick={() => { setFitWidth(false); setZoom((value) => Math.min(3, Number((value + 0.1).toFixed(2)))); }} className="border border-gray-200 px-3 py-2 font-bold text-gray-700 hover:bg-slate-50" title="放大">
          <Plus className="h-4 w-4" />
        </button>
        <button onClick={() => setFitWidth((value) => !value)} className={cn("border px-3 py-2 font-bold", fitWidth ? "border-cnpc-red bg-red-50 text-cnpc-red" : "border-gray-200 text-gray-700 hover:bg-slate-50")} title="自适应宽度">
          <Maximize2 className="h-4 w-4" />
        </button>
        <span className="mx-1 h-6 w-px bg-gray-200" />
        <button onClick={addBlankPage} className="inline-flex items-center gap-1 border border-gray-200 px-3 py-2 font-bold text-gray-700 hover:bg-slate-50">
          <FileText className="h-4 w-4" />新增页面
        </button>
        <button onClick={deleteLastBlankPage} disabled={!extraPageCount} className="inline-flex items-center gap-1 border border-gray-200 px-3 py-2 font-bold text-gray-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
          <Trash2 className="h-4 w-4" />删除新增页
        </button>
        <button onClick={createTextNote} className="inline-flex items-center gap-1 border border-gray-200 px-3 py-2 font-bold text-gray-700 hover:bg-slate-50">
          <Type className="h-4 w-4" />文本编辑
        </button>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={createImageNote} />
        <button onClick={() => imageInputRef.current?.click()} className="inline-flex items-center gap-1 border border-gray-200 px-3 py-2 font-bold text-gray-700 hover:bg-slate-50">
          <Upload className="h-4 w-4" />上传图片
        </button>
        <button onClick={createTableNote} className="inline-flex items-center gap-1 border border-gray-200 px-3 py-2 font-bold text-gray-700 hover:bg-slate-50">
          <Plus className="h-4 w-4" />插入表格
        </button>
        <button onClick={() => changeSelectedFontSize(-1)} disabled={!selectedNoteId} className="border border-gray-200 px-3 py-2 font-bold text-gray-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
          字号-
        </button>
        <button onClick={() => changeSelectedFontSize(1)} disabled={!selectedNoteId} className="border border-gray-200 px-3 py-2 font-bold text-gray-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
          字号+
        </button>
        <button onClick={deleteSelectedNote} disabled={!selectedNoteId} className="inline-flex items-center gap-1 border border-gray-200 px-3 py-2 font-bold text-gray-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
          <Trash2 className="h-4 w-4" />删除文本框
        </button>
        {saveStatus && <span className="text-xs text-gray-500">{saveStatus}</span>}
      </div>
      {error && <div className="shrink-0 border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>}
      <div ref={scrollRef} className={cn("space-y-5 p-4", isSinglePage ? "overflow-visible" : "min-h-0 flex-1 overflow-auto custom-scrollbar")}>
        {pageNumbers.map((pageNumber) => (
          <div
            key={pageNumber}
            ref={(node) => {
              if (node) pageRefs.current.set(pageNumber, node);
              else pageRefs.current.delete(pageNumber);
            }}
            onClick={() => setCurrentPage(pageNumber)}
            className="w-fit min-w-full border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-gray-400">Page {pageNumber}{pageNumber > originalPageCount ? " / 新增页" : ""}</div>
            <div className="relative mx-auto w-fit">
              <canvas
                ref={(node) => {
                  if (node) canvasRefs.current.set(pageNumber, node);
                  else canvasRefs.current.delete(pageNumber);
                }}
                className="block border border-gray-100 bg-white"
              />
              <div
                ref={(node) => {
                  if (node) noteLayerRefs.current.set(pageNumber, node);
                  else noteLayerRefs.current.delete(pageNumber);
                }}
                className="absolute inset-0 cursor-default"
                onClick={() => {
                  setSelectedNoteId("");
                  setActiveNoteId("");
                }}
              >
                {notes.filter((note) => note.pageNumber === pageNumber).map((note) => (
                  <div
                    key={note.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedNoteId(note.id);
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      beginNoteEditing(note.id);
                    }}
                    onMouseDown={(event) => {
                      if (note.editing) return;
                      startNoteDrag(note, event);
                    }}
                    className={cn(
                      "absolute whitespace-pre-wrap bg-transparent leading-snug text-black",
                      (note.editing || activeNoteId === note.id) && "border border-cnpc-red",
                    )}
                    style={{
                      left: `${note.x * 100}%`,
                      top: `${note.y * 100}%`,
                      width: `${note.width * 100}%`,
                      height: `${note.height * 100}%`,
                      fontSize: `${note.fontSize}px`,
                    }}
                  >
                    {(note.editing || activeNoteId === note.id) && (
                      <div
                        onMouseDown={(event) => startNoteDrag(note, event)}
                        className="absolute -top-5 left-0 z-10 cursor-move bg-cnpc-red px-2 py-0.5 text-[11px] font-bold leading-none text-white"
                      >
                        拖动
                      </div>
                    )}
                    {note.editing ? (
                      <textarea
                        autoFocus
                        value={note.text}
                        onFocus={() => {
                          setSelectedNoteId(note.id);
                          setActiveNoteId(note.id);
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedNoteId(note.id);
                          setActiveNoteId(note.id);
                        }}
                        onMouseDown={(event) => {
                          event.stopPropagation();
                          setSelectedNoteId(note.id);
                          setActiveNoteId(note.id);
                        }}
                        onKeyDown={(event) => {
                          if ((event.ctrlKey || event.metaKey) && event.altKey && event.key === "ArrowUp") {
                            event.preventDefault();
                            changeSelectedLineHeight(-1);
                            return;
                          }
                          if ((event.ctrlKey || event.metaKey) && event.altKey && event.key === "ArrowDown") {
                            event.preventDefault();
                            changeSelectedLineHeight(1);
                            return;
                          }
                          if ((event.ctrlKey || event.metaKey) && event.shiftKey && [">", "."].includes(event.key)) {
                            event.preventDefault();
                            changeSelectedFontSize(1);
                            return;
                          }
                          if ((event.ctrlKey || event.metaKey) && event.shiftKey && ["<", ","].includes(event.key)) {
                            event.preventDefault();
                            changeSelectedFontSize(-1);
                            return;
                          }
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            finishNoteEditing(note.id);
                          }
                        }}
                        onChange={(event) => {
                          setNotes((current) => current.map((item) => (item.id === note.id ? { ...item, text: event.target.value } : item)));
                          markDirty();
                        }}
                        className="h-full min-h-[42px] w-full resize-none bg-white/60 p-1 text-black outline-none"
                        style={{ fontSize: `${note.fontSize}px`, lineHeight: `${note.lineHeight ?? Math.max(12, note.fontSize + 4)}px` }}
                      />
                    ) : note.type === "image" ? (
                      <img src={note.imageDataUrl} alt="" className="h-full w-full object-contain" draggable={false} />
                    ) : note.type === "table" ? (
                      <div
                        className="grid h-full w-full border border-gray-700 bg-white text-black"
                        style={{ gridTemplateColumns: `repeat(${note.tableCols || 3}, minmax(0, 1fr))`, fontSize: `${note.fontSize}px` }}
                      >
                        {Array.from({ length: (note.tableRows || 3) * (note.tableCols || 3) }, (_, cellIndex) => (
                          <textarea
                            key={`${note.id}-cell-${cellIndex}`}
                            value={note.tableCells?.[cellIndex] ?? ""}
                            onClick={(event) => event.stopPropagation()}
                            onMouseDown={(event) => event.stopPropagation()}
                            onChange={(event) => {
                              const value = event.target.value;
                              setNotes((current) =>
                                current.map((item) =>
                                  item.id === note.id
                                    ? {
                                        ...item,
                                        tableCells: Array.from({ length: (note.tableRows || 3) * (note.tableCols || 3) }, (_, index) =>
                                          index === cellIndex ? value : item.tableCells?.[index] ?? "",
                                        ),
                                      }
                                    : item,
                                ),
                              );
                              setSelectedNoteId(note.id);
                              markDirty();
                            }}
                            className="min-h-0 resize-none border-b border-r border-gray-700 bg-transparent p-1 text-[inherit] leading-snug outline-none focus:bg-red-50"
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="h-full w-full p-1" style={{ lineHeight: `${note.lineHeight ?? Math.max(12, note.fontSize + 4)}px` }} title="双击编辑，拖动移动">{note.text}</div>
                    )}
                    {note.type === "text" && (selectedNoteId === note.id || activeNoteId === note.id || note.editing) && (
                      <div className="absolute -top-5 left-12 z-10 inline-flex overflow-hidden border border-cnpc-red bg-white text-[11px] font-bold leading-none text-cnpc-red shadow-sm">
                        <button
                          type="button"
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedNoteId(note.id);
                            changeSelectedFontSize(-1);
                          }}
                          className="px-2 py-0.5 hover:bg-red-50"
                        >
                          A-
                        </button>
                        <span className="border-x border-cnpc-red px-2 py-0.5 text-slate-700">{note.fontSize}</span>
                        <button
                          type="button"
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedNoteId(note.id);
                            changeSelectedFontSize(1);
                          }}
                          className="px-2 py-0.5 hover:bg-red-50"
                        >
                          A+
                        </button>
                        <button
                          type="button"
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedNoteId(note.id);
                            changeSelectedLineHeight(-1);
                          }}
                          className="border-l border-cnpc-red px-2 py-0.5 hover:bg-red-50"
                        >
                          行距-
                        </button>
                        <span className="border-x border-cnpc-red px-2 py-0.5 text-slate-700">{note.lineHeight ?? Math.max(12, note.fontSize + 4)}</span>
                        <button
                          type="button"
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedNoteId(note.id);
                            changeSelectedLineHeight(1);
                          }}
                          className="px-2 py-0.5 hover:bg-red-50"
                        >
                          行距+
                        </button>
                      </div>
                    )}
                    {(selectedNoteId === note.id || activeNoteId === note.id || note.editing) && (
                      <div
                        onMouseDown={(event) => {
                          event.stopPropagation();
                          setSelectedNoteId(note.id);
                          setActiveNoteId(note.id);
                          resizeRef.current = {
                            id: note.id,
                            pageNumber: note.pageNumber,
                            startWidth: note.width,
                            startHeight: note.height,
                            startClientX: event.clientX,
                            startClientY: event.clientY,
                          };
                        }}
                        className="absolute -bottom-2 -right-2 z-20 h-5 w-5 cursor-se-resize border-2 border-cnpc-red bg-white shadow-sm"
                        title="拖动调整文本框大小"
                      >
                        <span className="pointer-events-none absolute bottom-0.5 right-0.5 h-2 w-2 border-b-2 border-r-2 border-cnpc-red" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WellHistoryPage({
  onDirtyChange,
  onSaveHandlerChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
  onSaveHandlerChange?: (handler: PdfSaveHandler | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [unit, setUnit] = useState("");
  const [block, setBlock] = useState("");
  const [keyword, setKeyword] = useState("");
  const [archives, setArchives] = useState<WellHistoryArchiveSummary[]>([]);
  const [detail, setDetail] = useState<WellHistoryArchiveDetail | null>(null);
  const [selectedWellNo, setSelectedWellNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState("");
  const [pdfDirty, setPdfDirty] = useState(false);
  const [deletingWellNo, setDeletingWellNo] = useState("");
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("未开始");
  const [importProgress, setImportProgress] = useState(0);
  const [pdfSaveHandler, setPdfSaveHandler] = useState<PdfSaveHandler | null>(null);
  const [pdfDownloadHandler, setPdfDownloadHandler] = useState<PdfDownloadHandler | null>(null);
  const [richTextDocument, setRichTextDocument] = useState<WellHistoryRichTextDocument | null>(null);
  const [editingHtml, setEditingHtml] = useState("");
  const { confirmDialog, requestConfirm } = useStyledConfirmDialog();

  const handlePdfSaveHandlerChange = useCallback((handler: PdfSaveHandler | null) => {
    setPdfSaveHandler(() => handler);
    onSaveHandlerChange?.(handler);
  }, [onSaveHandlerChange]);

  const handlePdfDownloadHandlerChange = useCallback((handler: PdfDownloadHandler | null) => {
    setPdfDownloadHandler(() => handler);
  }, []);

  useEffect(() => {
    onDirtyChange?.(pdfDirty);
  }, [onDirtyChange, pdfDirty]);

  const loadArchives = async () => {
    setListLoading(true);
    try {
      const { data } = await axios.get<WellHistoryArchiveSummary[]>("/api/well-history-archives");
      setArchives(data || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || "井史目录加载失败");
    } finally {
      setListLoading(false);
    }
  };

  useEffect(() => {
    void loadArchives();
  }, []);

  useEffect(() => {
    if (!detail?.wellNo) { setRichTextDocument(null); setEditingHtml(""); return; }
    let active = true;
    axios.get<WellHistoryRichTextDocument>(`/api/well-history-archives/${encodeURIComponent(detail.wellNo)}/document`)
      .then(({ data }) => { if (active) { setRichTextDocument(data); setEditingHtml(data.html); } })
      .catch((err) => { if (active && err?.response?.status !== 404) setError(err?.response?.data?.error || "井史正文加载失败"); });
    return () => { active = false; };
  }, [detail?.wellNo]);

  const saveRichTextDocument = async () => {
    if (!detail || !richTextDocument) return false;
    try {
      const { data } = await axios.put<WellHistoryRichTextDocument>(`/api/well-history-archives/${encodeURIComponent(detail.wellNo)}/document`, { html: editingHtml, baseVersionNo: richTextDocument.versionNo });
      setRichTextDocument(data); setEditingHtml(data.html); setPdfDirty(false); return true;
    } catch (err: any) { setError(err?.response?.status === 409 ? "该井史已被其他维护者更新，请刷新后再编辑。" : err?.response?.data?.error || "井史正文保存失败"); return false; }
  };

  useEffect(() => {
    let cancelled = false;

    const loadLatest = async () => {
      try {
        const { data } = await axios.get<WellHistoryArchiveDetail>("/api/well-history-archives-latest");
        if (!data?.wellNo) return;
        if (cancelled) return;
        setDetail(data);
        setPdfDirty(false);
        setSelectedWellNo(data.wellNo);
        setKeyword(data.wellNo);
      } catch (err: any) {
        if (!cancelled && err?.response?.status !== 404) {
          setError(err?.response?.data?.error || "最近上传井史加载失败");
        }
        // Empty state is expected before the first import.
      }
    };

    void loadLatest();
    return () => {
      cancelled = true;
    };
  }, []);

  const openWell = async (wellNo: string, force = false) => {
    if (!wellNo) return false;
    if (!force && wellNo !== detail?.wellNo && pdfDirty) {
      requestConfirm("当前页面有未保存的编辑内容，切换井史后将自动保存。是否继续切换？", () => {
        void (async () => {
          const saved = richTextDocument ? await saveRichTextDocument() : await pdfSaveHandler?.();
          if (saved) void openWell(wellNo, true);
          else setError("当前页面保存失败，已取消切换井史。");
        })();
      });
      return false;
    }
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get<WellHistoryArchiveDetail>(`/api/well-history-archives/${encodeURIComponent(wellNo)}`);
      setDetail(data);
      setPdfDirty(false);
      setSelectedWellNo(data.wellNo);
      setKeyword(data.wellNo);
      return true;
    } catch (err: any) {
      setDetail(null);
      setPdfDirty(false);
      setSelectedWellNo("");
      setError(err?.response?.data?.error || "井史资料加载失败");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const queryWell = async (normalized: string, force = false) => {
    const exactMatched = await openWell(normalized, force);
    if (exactMatched) return;

    try {
      const { data } = await axios.get<WellHistoryArchiveSummary[]>("/api/well-history-archives/search", {
        params: { keyword: normalized },
      });
      if (data?.length) {
        await openWell(data[0].wellNo, force);
      } else {
        setError("未找到对应井号的井史资料");
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || "井号搜索失败");
    }
  };

  const handleQuery = async () => {
    const normalized = keyword.trim();
    if (!normalized) return;

    if (normalized !== detail?.wellNo && pdfDirty) {
      requestConfirm("当前页面有未保存的编辑内容，切换井史后将自动保存。是否继续切换？", () => {
        void (async () => {
          const saved = richTextDocument ? await saveRichTextDocument() : await pdfSaveHandler?.();
          if (saved) void queryWell(normalized, true);
          else setError("当前页面保存失败，已取消切换井史。");
        })();
      });
      return;
    }

    await queryWell(normalized);
  };

  const handleBatchImport = async (files: FileList | null) => {
    if (!files?.length) return;
    const pptFiles = Array.from(files).filter((file) => /\.(ppt|pptx)$/i.test(file.name));
    if (!pptFiles.length) {
      setError("请选择 PPT/PPTX 文件");
      return;
    }

    const candidates = pptFiles.map((file, sourceOrder) => {
      const parsed = parseWellHistoryImportFileName(file.name);
      const normalized = normalizeWellHistoryWellNo(parsed.wellNo);
      return {
        file,
        size: file.size,
        sourceOrder,
        sourceOriginalName: file.name,
        wellNo: normalized || `__invalid_${sourceOrder}`,
        resultWellNo: normalized,
      };
    });
    const { selected, superseded } = selectLatestWellHistoryImports(candidates);
    const { batches } = createWellHistoryImportBatches(selected);
    const unbatchable = selected.filter((candidate) => candidate.size > WELL_HISTORY_BATCH_MAX_BYTES);

    if (unbatchable.length) {
      const fileNames = unbatchable.map((candidate) => candidate.sourceOriginalName).join("、");
      requestConfirm(
        `以下文件超过自动分批单文件上限48MB，已阻止本次全部上传：${fileNames}`,
        () => {},
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const executeBatches = async () => {
      setError("");
      setImporting(true);
      setImportProgress(0);

      let successCount = 0;
      let supersededCount = superseded.length;
      let failureCount = 0;
      const items: WellHistoryBatchImportItem[] = superseded.map((candidate) => ({
        fileName: candidate.sourceOriginalName,
        wellNo: candidate.resultWellNo,
        status: "superseded",
        message: "已被同批次后续文件覆盖",
      }));

      try {
        for (const [batchIndex, batch] of batches.entries()) {
          setImportStatus(`正在导入第 ${batchIndex + 1}/${batches.length} 批...`);
          const formData = new FormData();
          batch.forEach((candidate) => formData.append("files", candidate.file));
          formData.append("unit", unit);
          formData.append("block", block.trim());

          try {
            const { data } = await axios.post<{ successCount: number; supersededCount: number; failureCount: number; items: WellHistoryBatchImportItem[] }>(
              "/api/uploads/well-history-ppt-batch",
              formData,
              {
                headers: { "Content-Type": "multipart/form-data" },
                onUploadProgress: (event) => {
                  if (!event.total) return;
                  const fraction = event.loaded / event.total;
                  setImportProgress(Math.round(((batchIndex + fraction) / batches.length) * 100));
                },
              },
            );
            successCount += data.successCount || 0;
            supersededCount += data.supersededCount || 0;
            failureCount += data.failureCount || 0;
            items.push(...(data.items || []));
          } catch (err: any) {
            const message = err?.response?.data?.error || "PPT 批量导入请求失败";
            failureCount += batch.length;
            items.push(...batch.map((candidate) => ({
              fileName: candidate.sourceOriginalName,
              wellNo: candidate.resultWellNo,
              status: "batch-request-failed",
              message,
            })));
          }
        }

        setImportProgress(100);
        setImportStatus(
          failureCount === pptFiles.length ? "导入失败" : failureCount ? "导入完成（部分失败）" : "导入完成",
        );
        await loadArchives();

        const firstSuccess = items.find((item) => item.status === "success" && item.wellNo);
        requestConfirm(
          `PPT 导入完成：共 ${pptFiles.length} 个文件，成功 ${successCount} 个，覆盖跳过 ${supersededCount} 个，失败 ${failureCount} 个。`,
          firstSuccess?.wellNo ? () => {
            void openWell(firstSuccess.wellNo);
          } : () => {},
        );
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    const totalBytes = pptFiles.reduce((sum, file) => sum + file.size, 0);
    if (pptFiles.length > WELL_HISTORY_BATCH_MAX_FILES || totalBytes > WELL_HISTORY_BATCH_MAX_BYTES) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      requestConfirm(
        `本次选择 ${pptFiles.length} 个文件，去重后 ${selected.length} 个，将拆分 ${batches.length} 批，是否继续？`,
        executeBatches,
      );
      return;
    }

    await executeBatches();
  };

  const previewUrl = detail?.currentPdf?.fileUrl || "";
  const currentPptx = detail?.currentPptx ?? null;
  const handleRichTextPdfDownload = async () => {
    try {
      const editor = document.querySelector<HTMLElement>("[data-well-history-editor]");
      if (!editor || !detail) throw new Error("未找到可导出的井史正文");
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(editor, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        logging: false,
        onclone: (clonedDocument) => {
          const clone = clonedDocument.querySelector<HTMLElement>("[data-well-history-editor]");
          if (!clone) return;
          clone.querySelectorAll<HTMLElement>("*").forEach((element) => element.removeAttribute("class"));
          clone.style.cssText = "min-height:0;padding:24px;background:#fff;color:#111;font:16px/1.75 Arial,sans-serif;";
          clone.querySelectorAll<HTMLElement>("h1,h2,h3").forEach((element) => { element.style.fontWeight = "700"; element.style.margin = "20px 0 12px"; });
          clone.querySelectorAll<HTMLElement>("h1").forEach((element) => element.style.fontSize = "28px");
          clone.querySelectorAll<HTMLElement>("h2").forEach((element) => element.style.fontSize = "24px");
          clone.querySelectorAll<HTMLElement>("h3").forEach((element) => element.style.fontSize = "20px");
          clone.querySelectorAll<HTMLElement>("img").forEach((element) => { element.style.display = "block"; element.style.maxWidth = "100%"; element.style.margin = "16px auto"; });
          clone.querySelectorAll<HTMLElement>("table,td,th").forEach((element) => { element.style.border = "1px solid #555"; element.style.borderCollapse = "collapse"; element.style.padding = "6px"; });
        },
      });
      const pdf = new jsPDF("p", "mm", "a4");
      const pageWidth = 210;
      const pageHeight = 297;
      const imageHeight = (canvas.height * pageWidth) / canvas.width;
      let offset = 0;
      while (offset < imageHeight) {
        if (offset) pdf.addPage();
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, -offset, pageWidth, imageHeight);
        offset += pageHeight;
      }
      const url = URL.createObjectURL(pdf.output("blob"));
      const link = document.createElement("a");
      link.href = url;
      link.download = `${detail.wellNo}-井史.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (error) {
      console.error("Well history PDF export failed", error);
      setError(error instanceof Error ? `PDF 导出失败：${error.message}` : "PDF 导出失败");
    }
  };

  const handleDeleteArchive = (item: WellHistoryArchiveSummary) => {
    requestConfirm(`确认删除 ${item.wellNo} 的井史资料？`, async () => {
      setDeletingWellNo(item.wellNo);
      try {
        await axios.delete(`/api/well-history-archives/${encodeURIComponent(item.wellNo)}`);
        if (selectedWellNo === item.wellNo) {
          setSelectedWellNo("");
          setDetail(null);
          setPdfDirty(false);
        }
        await loadArchives();
      } catch (err: any) {
        setError(err?.response?.data?.error || "删除井史失败");
      } finally {
        setDeletingWellNo("");
      }
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      {confirmDialog}
      <div data-well-history-sidebar className="space-y-3">
        <input ref={fileInputRef} type="file" accept=".ppt,.pptx" multiple className="hidden" onChange={(event) => void handleBatchImport(event.target.files)} />

        <div className="well-history-side-card border border-shell-border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">批量导入进度</h2>
            <span className={cn("px-3 py-1 text-xs font-bold", importing ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>{importStatus}</span>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="well-history-import-button mb-4 inline-flex w-full items-center justify-center gap-2 bg-orange-500 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {importing ? "正在导入 PPT..." : "批量导入 PPT/PPTX"}
          </button>
          <p className="mb-4 text-xs leading-5 text-gray-500">一个 PPT/PPTX 对应一口井，以文件名作为井号归档。可一次选择多个文件导入。</p>
          <div className="well-history-progress-track h-3 overflow-hidden bg-gray-100">
            <div className="well-history-progress-bar h-full bg-orange-500 transition-all duration-300" style={{ width: `${importProgress}%` }} />
          </div>
        </div>

        <div className="well-history-side-card border border-shell-border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-gray-900">当前井与查询</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <div><strong>当前井号：</strong>{detail?.wellNo || "--"}</div>
            <div><strong>单位：</strong>{detail?.unit || "--"}</div>
            <div><strong>区块：</strong>{detail?.block || "--"}</div>
            <div><strong>更新时间：</strong>{detail ? formatTime(detail.updatedAt) : "--"}</div>
          </div>
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-bold text-gray-700">
              作业区
              <select value={unit} onChange={(event) => { setUnit(event.target.value); setBlock(""); }} className="mt-1 h-9 w-full border border-gray-200 bg-white px-2 text-sm outline-none focus:border-cnpc-red">
                <option value="">全部单位</option>
                {FILTER_UNIT_OPTIONS.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold text-gray-700">
              区块
              <select value={block} onChange={(event) => setBlock(event.target.value)} className="mt-1 h-9 w-full border border-gray-200 bg-white px-2 text-sm outline-none focus:border-cnpc-red">
                <option value="">全部区块</option>
                {getFilterBlockOptions(unit).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold text-gray-700">
              井号
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="输入井号" className="mt-1 h-9 w-full border border-gray-200 px-2 text-sm outline-none focus:border-cnpc-red" />
            </label>
            <button onClick={() => void handleQuery()} className="well-history-primary-action inline-flex h-9 w-full items-center justify-center gap-1 bg-cnpc-red px-3 text-sm font-bold text-white hover:bg-red-700">
              <Search className="h-4 w-4" />查询
            </button>
            <button
              type="button"
              onClick={() => void (richTextDocument ? saveRichTextDocument() : pdfSaveHandler?.())}
              disabled={richTextDocument ? !pdfDirty : !pdfSaveHandler}
              className="well-history-primary-action inline-flex h-9 w-full items-center justify-center gap-1 bg-cnpc-red px-3 text-sm font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />保存编辑结果
            </button>
            <button
              type="button"
              onClick={() => void (richTextDocument ? handleRichTextPdfDownload() : pdfDownloadHandler?.())}
              disabled={richTextDocument ? false : !pdfDownloadHandler}
              className="well-history-secondary-action inline-flex h-9 w-full items-center justify-center gap-1 border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Download className="h-4 w-4" />下载 PDF
            </button>
          </div>
        </div>

        <div className="well-history-side-card border border-shell-border bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">井史目录</h2>
            {listLoading && <span className="text-xs text-gray-400">加载中...</span>}
          </div>
          <div className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1 custom-scrollbar">
            {archives.map((item) => (
              <div key={item.wellNo} className={cn("flex items-center justify-between gap-2 border px-3 py-2 transition-all", selectedWellNo === item.wellNo ? "border-cnpc-red bg-red-50/40" : "border-gray-200 bg-gray-50")}>
                <button onClick={() => void openWell(item.wellNo)} className="min-w-0 flex-1 truncate text-left text-sm font-bold text-gray-900 [&>p]:hidden">
                  {item.wellNo}
                  <p className="mt-1 text-[11px] text-gray-400">更新：{formatTime(item.updatedAt)}</p>
                </button>
                <button
                  onClick={() => handleDeleteArchive(item)}
                  className="shrink-0 text-xs font-bold text-red-600 hover:underline"
                >
                  <Trash2 className="mr-1 inline h-3.5 w-3.5" />{deletingWellNo === item.wellNo ? "删除中..." : "删除"}
                </button>
              </div>
            ))}
            {!archives.length && <div className="border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">暂无井史目录</div>}
          </div>
        </div>
      </div>

      <div data-well-history-content className="space-y-5">
        <div className="border border-shell-border bg-white p-3 shadow-sm">
          {loading ? (
            <div className="py-20 text-center text-sm text-gray-400">正在加载井史...</div>
          ) : detail ? (
            <div className="space-y-2">
              {richTextDocument ? (
                <WellHistoryRichTextEditor html={editingHtml} editable onChange={(html) => { setEditingHtml(html); setPdfDirty(html !== richTextDocument.html); }} />
              ) : currentPptx ? (
                <div className="border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">该 PPTX 尚未生成富文本井史文档，请重新上传。</div>
              ) : previewUrl ? (
                <PdfReaderEditor
                  key={`${detail.wellNo}-${detail.currentPdf?.id ?? "no-pdf"}`}
                  wellNo={detail.wellNo}
                  fileUrl={previewUrl}
                  pdfId={detail.currentPdf?.id}
                  onDirtyChange={setPdfDirty}
                  onSaveHandlerChange={handlePdfSaveHandlerChange}
                  onDownloadHandlerChange={handlePdfDownloadHandlerChange}
                />
              ) : (
                <div className="border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">该井暂无 PPTX 或 PDF 原件。</div>
              )}
            </div>
          ) : (
            <div className="border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">请选择左侧井史目录，或输入井号后查询。</div>
          )}
        </div>
      </div>
    </div>
  );
}

const formatDateOnly = (value?: string | null) => {
  if (!value) return "";
  return String(value).slice(0, 10);
};

const formatNumberCell = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "";
  return Number(value).toFixed(1);
};

const formFromDynamicAdjustmentRecord = (record: DynamicAdjustmentRecord): DynamicAdjustmentForm => ({
  adjustmentWaterWell: record.adjustmentWaterWell,
  injectionProcess: record.injectionProcess ?? "",
  adjustmentDate: formatDateOnly(record.adjustmentDate),
  beforeDailyInjection: formatNumberCell(record.beforeDailyInjection),
  afterDailyInjection: formatNumberCell(record.afterDailyInjection),
  adjustmentPurpose: DYNAMIC_ADJUSTMENT_PURPOSES.includes(record.adjustmentPurpose as any)
    ? (record.adjustmentPurpose as DynamicAdjustmentForm["adjustmentPurpose"])
    : DYNAMIC_ADJUSTMENT_PURPOSES[0],
  trackedOilWell: record.trackedOilWell,
  beforeDailyLiquid: formatNumberCell(record.beforeDailyLiquid),
  beforeDailyOil: formatNumberCell(record.beforeDailyOil),
  beforeWaterCut: formatNumberCell(record.beforeWaterCut),
  afterDailyLiquid: formatNumberCell(record.afterDailyLiquid),
  afterDailyOil: formatNumberCell(record.afterDailyOil),
  afterWaterCut: formatNumberCell(record.afterWaterCut),
  stageDays: formatNumberCell(record.stageDays),
  cumulativeOil: formatNumberCell(record.cumulativeOil),
  remark: record.remark ?? "",
});

function DynamicAdjustmentPage() {
  const [records, setRecords] = useState<DynamicAdjustmentRecord[]>([]);
  const [filters, setFilters] = useState({
    adjustmentWaterWell: "",
    trackedOilWell: "",
    adjustmentPurpose: "",
    fromDate: "",
    toDate: "",
  });
  const [form, setForm] = useState<DynamicAdjustmentForm>(() => createEmptyDynamicAdjustmentForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { confirmDialog, requestConfirm } = useStyledConfirmDialog();

  const headClass = "whitespace-nowrap border border-[#9fc4e8] bg-[#dcecf9] px-2 py-2 text-center text-sm font-bold leading-tight text-[#001a33]";
  const cellClass = "h-8 whitespace-nowrap border border-[#9fc4e8] bg-white px-2 py-1 text-center text-sm leading-tight text-[#001a33]";
  const selectableCellClass = (selected: boolean) => cn(cellClass, "group-hover:bg-red-50", selected && "bg-red-50");
  const inputClass = "h-6 rounded border border-[#8fb7df] bg-white px-2 text-[12px] text-[#001a33] outline-none";
  const toolButtonClass = "h-6 rounded border border-[#8aaed3] bg-[#e4f0fa] px-3 text-[12px] font-bold text-[#001a33] hover:bg-[#d6e8f8]";
  const selectedRecord = records.find((record) => record.id === selectedId) ?? null;
  const pageSize = 15;
  const previewDiffs = calculateDynamicAdjustmentDiffs({
    beforeDailyLiquid: form.beforeDailyLiquid === "" ? null : Number(form.beforeDailyLiquid),
    beforeDailyOil: form.beforeDailyOil === "" ? null : Number(form.beforeDailyOil),
    beforeWaterCut: form.beforeWaterCut === "" ? null : Number(form.beforeWaterCut),
    afterDailyLiquid: form.afterDailyLiquid === "" ? null : Number(form.afterDailyLiquid),
    afterDailyOil: form.afterDailyOil === "" ? null : Number(form.afterDailyOil),
    afterWaterCut: form.afterWaterCut === "" ? null : Number(form.afterWaterCut),
  });

  const loadRecords = async (nextFilters = filters) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get<DynamicAdjustmentRecord[]>("/api/dynamic-adjustments", {
        params: Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => typeof value === "string" && value.trim())),
      });
      setRecords(data);
      setCurrentPage(1);
      setSelectedId((current) => (data.some((record) => record.id === current) ? current : null));
    } catch (err: any) {
      setError(err?.response?.data?.error || "动态调配记录加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRecords();
  }, []);

  const updateForm = (key: keyof DynamicAdjustmentForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openCreateForm = (purpose = DYNAMIC_ADJUSTMENT_PURPOSES[0]) => {
    setEditingId(null);
    setForm({ ...createEmptyDynamicAdjustmentForm(), adjustmentPurpose: purpose });
    setShowForm(true);
    setError("");
  };

  const openEditForm = (record: DynamicAdjustmentRecord) => {
    setEditingId(record.id);
    setForm(formFromDynamicAdjustmentRecord(record));
    setShowForm(true);
    setError("");
  };

  const resetFilters = () => {
    const emptyFilters = { adjustmentWaterWell: "", trackedOilWell: "", adjustmentPurpose: "", fromDate: "", toDate: "" };
    setFilters(emptyFilters);
    void loadRecords(emptyFilters);
  };

  const handleSave = async () => {
    if (!form.adjustmentWaterWell.trim() || !form.adjustmentDate || !form.adjustmentPurpose || !form.trackedOilWell.trim()) {
      setError("请填写调配水井、调配日期、调配目的和井号");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const isCreate = !editingId;
      if (editingId) {
        await axios.put(`/api/dynamic-adjustments/${editingId}`, form);
      } else {
        await axios.post("/api/dynamic-adjustments", form);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(createEmptyDynamicAdjustmentForm());
      if (isCreate) {
        setCurrentPage(1);
      }
      await loadRecords();
    } catch (err: any) {
      setError(err?.response?.data?.error || "动态调配记录保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: DynamicAdjustmentRecord) => {
    requestConfirm(`确认删除 ${record.adjustmentWaterWell} / ${record.trackedOilWell} 的动态调配记录？`, async () => {
      setError("");
      try {
        await axios.delete(`/api/dynamic-adjustments/${record.id}`);
        setSelectedId(null);
        await loadRecords();
      } catch (err: any) {
        setError(err?.response?.data?.error || "动态调配记录删除失败");
      }
    });
  };

  const visibleRows = records;
  const totalItems = visibleRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const displayPage = Math.min(currentPage, totalPages);
  const pagedRows = visibleRows.slice((displayPage - 1) * pageSize, displayPage * pageSize);
  const goToPage = (page: number) => setCurrentPage(Math.min(totalPages, Math.max(1, page)));

  return (
    <>
      {confirmDialog}
      <div className="rounded-sm border border-[#9fc4e8] bg-[#f4f8fc] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#9fc4e8] bg-[#f7fbff] px-0 py-2 text-[12px] text-[#001a33]">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1">
              <span>作业区</span>
              <select className={`${inputClass} w-36`} defaultValue="高采采油作业一区">
                {FILTER_UNIT_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span>区块</span>
              <select className={`${inputClass} w-24`} defaultValue="">
                <option value="">请选择</option>
                {getFilterBlockOptions(FILTER_UNIT_OPTIONS[0]).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span>井号</span>
              <input className={`${inputClass} w-24`} value={filters.trackedOilWell} onChange={(event) => setFilters({ ...filters, trackedOilWell: event.target.value })} />
            </label>
            <label className="flex items-center gap-1">
              <span>调配目的</span>
              <select className={`${inputClass} w-28`} value={filters.adjustmentPurpose} onChange={(event) => setFilters({ ...filters, adjustmentPurpose: event.target.value })}>
                <option value="">请选择</option>
                {DYNAMIC_ADJUSTMENT_PURPOSES.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span>调配水井</span>
              <input className={`${inputClass} w-24`} value={filters.adjustmentWaterWell} onChange={(event) => setFilters({ ...filters, adjustmentWaterWell: event.target.value })} />
            </label>
            <button type="button" onClick={() => loadRecords()} className={toolButtonClass}>确定</button>
            <button type="button" onClick={resetFilters} className={toolButtonClass}>重置</button>
            <button type="button" onClick={() => openCreateForm()} className={toolButtonClass}>新增</button>
            <button type="button" disabled={!selectedRecord} onClick={() => selectedRecord && openEditForm(selectedRecord)} className={`${toolButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}>编辑</button>
            <button type="button" disabled={!selectedRecord} onClick={() => selectedRecord && handleDelete(selectedRecord)} className={`${toolButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}>删除</button>
          </div>
          <div className="flex flex-wrap items-center gap-2 whitespace-nowrap pr-2 text-[12px] text-[#001a33]">
            <span>第{displayPage}页 共{totalPages}页 共{totalItems}条</span>
            <button type="button" className="font-bold text-[#0000ee] hover:underline" onClick={() => goToPage(1)}>首页</button>
            <button type="button" className="font-bold text-[#0000ee] hover:underline" onClick={() => goToPage(displayPage - 1)}>上一页</button>
            <button type="button" className="font-bold text-[#0000ee] hover:underline" onClick={() => goToPage(displayPage + 1)}>下一页</button>
            <button type="button" className="font-bold text-[#0000ee] hover:underline" onClick={() => goToPage(totalPages)}>尾页</button>
            <span>跳转</span>
            <input className="h-6 w-9 rounded border border-[#9bbfe5] bg-white px-1 text-center text-[12px] outline-none" value={displayPage} readOnly />
            <span>页</span>
            <button type="button" className="h-6 rounded border border-[#8aaed3] bg-[#d8e7f5] px-1 text-[11px] font-bold text-[#001a33]" onClick={() => goToPage(displayPage)}>GO</button>
          </div>
        </div>

        <h1 className="py-2 text-center text-[22px] font-bold leading-none text-[#cc0000]">动态调配列表</h1>

        {error && <div className="border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        <div className="overflow-x-auto border-t border-[#99c7f3] bg-white">
          <table className="w-full min-w-[1280px] table-fixed border-collapse bg-white text-center text-[#001a33]">
            <thead>
              <tr>
                <th rowSpan={3} className={headClass}>{"\u8c03\u914d\u6c34\u4e95"}</th>
                <th rowSpan={3} className={headClass}>{"\u5206\u6ce8\u5de5\u827a"}</th>
                <th rowSpan={3} className={headClass}>{"\u8c03\u914d\u65e5\u671f"}</th>
                <th rowSpan={3} className={headClass}>{"\u8c03\u914d\u524d\u65e5\u6ce8"}</th>
                <th rowSpan={3} className={headClass}>{"\u8c03\u914d\u540e\u65e5\u6ce8"}</th>
                <th rowSpan={3} className={headClass}>{"\u8c03\u914d\u76ee\u7684"}</th>
                <th colSpan={12} className={headClass}>{"\u91cd\u70b9\u8ddf\u8e2a\u6cb9\u4e95\u4ea7\u91cf"}</th>
              </tr>
              <tr>
                <th rowSpan={2} className={headClass}>{"\u6cb9\u4e95\u4e95\u53f7"}</th>
                <th colSpan={3} className={headClass}>{"\u8c03\u914d\u524d"}</th>
                <th colSpan={3} className={headClass}>{"\u8c03\u914d\u540e"}</th>
                <th colSpan={3} className={headClass}>{"\u5dee\u503c"}</th>
                <th colSpan={2} className={headClass}>{"\u9636\u6bb5\u6548\u679c"}</th>
              </tr>
              <tr>
                {[
                  "\u65e5\u4ea7\u6db2",
                  "\u65e5\u4ea7\u6cb9",
                  "\u542b\u6c34",
                  "\u65e5\u4ea7\u6db2",
                  "\u65e5\u4ea7\u6cb9",
                  "\u542b\u6c34",
                  "\u65e5\u4ea7\u6db2",
                  "\u65e5\u4ea7\u6cb9",
                  "\u542b\u6c34",
                  "\u9636\u6bb5\u5929\u6570",
                  "\u7d2f\u589e\u6cb9",
                ].map((header, index) => (
                  <th key={`${header}-${index}`} className={headClass}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={18} className={cellClass}>正在加载...</td></tr>
              ) : pagedRows.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className="group cursor-pointer"
                >
                  <td className={selectableCellClass(row.id === selectedId)}>{row.adjustmentWaterWell}</td>
                  <td className={selectableCellClass(row.id === selectedId)}>{row.injectionProcess}</td>
                  <td className={selectableCellClass(row.id === selectedId)}>{formatDateOnly(row.adjustmentDate)}</td>
                  <td className={selectableCellClass(row.id === selectedId)}>{formatNumberCell(row.beforeDailyInjection)}</td>
                  <td className={selectableCellClass(row.id === selectedId)}>{formatNumberCell(row.afterDailyInjection)}</td>
                  <td className={selectableCellClass(row.id === selectedId)}>{row.adjustmentPurpose}</td>
                  <td className={selectableCellClass(row.id === selectedId)}>{row.trackedOilWell}</td>
                  <td className={selectableCellClass(row.id === selectedId)}>{formatNumberCell(row.beforeDailyLiquid)}</td>
                  <td className={selectableCellClass(row.id === selectedId)}>{formatNumberCell(row.beforeDailyOil)}</td>
                  <td className={selectableCellClass(row.id === selectedId)}>{formatNumberCell(row.beforeWaterCut)}</td>
                  <td className={selectableCellClass(row.id === selectedId)}>{formatNumberCell(row.afterDailyLiquid)}</td>
                  <td className={selectableCellClass(row.id === selectedId)}>{formatNumberCell(row.afterDailyOil)}</td>
                  <td className={selectableCellClass(row.id === selectedId)}>{formatNumberCell(row.afterWaterCut)}</td>
                  <td className={selectableCellClass(row.id === selectedId)}>{formatNumberCell(row.diffDailyLiquid)}</td>
                  <td className={selectableCellClass(row.id === selectedId)}>{formatNumberCell(row.diffDailyOil)}</td>
                  <td className={selectableCellClass(row.id === selectedId)}>{formatNumberCell(row.diffWaterCut)}</td>
                  <td className={selectableCellClass(row.id === selectedId)}>{formatNumberCell(row.stageDays)}</td>
                  <td className={selectableCellClass(row.id === selectedId)}>{formatNumberCell(row.cumulativeOil)}</td>
                </tr>
              ))}
              {!loading && !pagedRows.length && (
                <tr><td colSpan={18} className={cellClass}>暂无符合条件的数据</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto border border-shell-border bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{editingId ? "编辑动态调配" : "新增动态调配"}</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm font-bold text-gray-500 hover:text-gray-900">关闭</button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <input className={inputClass} placeholder="调配水井" value={form.adjustmentWaterWell} onChange={(event) => updateForm("adjustmentWaterWell", event.target.value)} />
              <input className={inputClass} placeholder="分注工艺" value={form.injectionProcess} onChange={(event) => updateForm("injectionProcess", event.target.value)} />
              <input type="date" className={inputClass} value={form.adjustmentDate} onChange={(event) => updateForm("adjustmentDate", event.target.value)} />
              <input type="number" step="0.01" className={inputClass} placeholder="调配前日注" value={form.beforeDailyInjection} onChange={(event) => updateForm("beforeDailyInjection", event.target.value)} />
              <input type="number" step="0.01" className={inputClass} placeholder="调配后日注" value={form.afterDailyInjection} onChange={(event) => updateForm("afterDailyInjection", event.target.value)} />
              <select className={inputClass} value={form.adjustmentPurpose} onChange={(event) => updateForm("adjustmentPurpose", event.target.value)}>
                {DYNAMIC_ADJUSTMENT_PURPOSES.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}
              </select>
              <input className={inputClass} placeholder="井号" value={form.trackedOilWell} onChange={(event) => updateForm("trackedOilWell", event.target.value)} />
              <input type="number" step="0.01" className={inputClass} placeholder="调配前 日产液" value={form.beforeDailyLiquid} onChange={(event) => updateForm("beforeDailyLiquid", event.target.value)} />
              <input type="number" step="0.01" className={inputClass} placeholder="调配前 日产油" value={form.beforeDailyOil} onChange={(event) => updateForm("beforeDailyOil", event.target.value)} />
              <input type="number" step="0.01" className={inputClass} placeholder="调配前 含水" value={form.beforeWaterCut} onChange={(event) => updateForm("beforeWaterCut", event.target.value)} />
              <input type="number" step="0.01" className={inputClass} placeholder="调配后 日产液" value={form.afterDailyLiquid} onChange={(event) => updateForm("afterDailyLiquid", event.target.value)} />
              <input type="number" step="0.01" className={inputClass} placeholder="调配后 日产油" value={form.afterDailyOil} onChange={(event) => updateForm("afterDailyOil", event.target.value)} />
              <input type="number" step="0.01" className={inputClass} placeholder="调配后 含水" value={form.afterWaterCut} onChange={(event) => updateForm("afterWaterCut", event.target.value)} />
              <input className={inputClass} readOnly value={formatNumberCell(previewDiffs.diffDailyLiquid)} placeholder="差值 日产液" />
              <input className={inputClass} readOnly value={formatNumberCell(previewDiffs.diffDailyOil)} placeholder="差值 日产油" />
              <input className={inputClass} readOnly value={formatNumberCell(previewDiffs.diffWaterCut)} placeholder="差值 含水" />
              <input type="number" className={inputClass} placeholder="阶段天数" value={form.stageDays} onChange={(event) => updateForm("stageDays", event.target.value)} />
              <input type="number" step="0.01" className={inputClass} placeholder="累增油" value={form.cumulativeOil} onChange={(event) => updateForm("cumulativeOil", event.target.value)} />
            </div>
            <textarea className="mt-3 min-h-20 w-full rounded border border-[#b8c8d8] px-3 py-2 text-sm outline-none focus:border-cnpc-blue" placeholder="备注" value={form.remark} onChange={(event) => updateForm("remark", event.target.value)} />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">取消</button>
              <button type="button" onClick={handleSave} disabled={saving} className="rounded bg-cnpc-red px-4 py-2 text-sm font-bold text-white hover:bg-cnpc-red-dark disabled:opacity-60">{saving ? "保存中..." : "保存"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AppContent({
  activePage,
  currentUser,
  onWellHistoryDirtyChange,
  onWellHistorySaveHandlerChange,
}: {
  activePage: PageType;
  currentUser: AuthUser | null;
  onWellHistoryDirtyChange?: (dirty: boolean) => void;
  onWellHistorySaveHandlerChange?: (handler: PdfSaveHandler | null) => void;
}) {
  if (isManagementPage(activePage) && !hasManagementPermission(currentUser)) {
    return <AccessDeniedPage />;
  }

  switch (activePage) {
    case "home":
      return <HomePage />;
    case "well-history":
      return <WellHistoryPage onDirtyChange={onWellHistoryDirtyChange} onSaveHandlerChange={onWellHistorySaveHandlerChange} />;
    case "dynamic-analysis":
      return <DynamicAnalysisPage />;
    case "water-cut":
      return <WaterCutPage currentUser={currentUser} />;
    case "injection-tech":
      return <InjectionTechPage />;
    case "zonal-injection":
      return <ZonalIndicatorSummaryPage />;
    case "concentric-test-history":
      return <ConcentricTestHistoryPage />;
    case "smart-test-history":
      return <SmartTestHistoryPage />;
    case "single-well-injection-evaluation":
      return <SingleWellInjectionEvaluationPage />;
    case "single-well-seal-evaluation":
      return <SingleWellSealEvaluationPage />;
    case "zonal-indicator-summary":
      return <ZonalIndicatorSummaryPage />;
    case "well-flushing":
      return <WellFlushingPage />;
    case "abnormal-wells":
      return <AbnormalWellsPage />;
    case "dynamic-adjustment":
      return <DynamicAdjustmentPage />;
    case "indicator-curve":
      return <IndicatorCurvePage />;
    case "key-matters":
      return <PlaceholderPage title="重点事项中心" />;
    case "user-management":
      return <UserManagementPage />;
    case "settings":
      return <SystemSettingsPage />;
    case "audit-log":
      return <PlaceholderPage title="审计日志" />;
    default:
      return <HomePage />;
  }
}

type AuthUser = {
  id: string;
  name: string;
  empId: string;
  role: string;
  unit?: string | null;
  status?: string | null;
};

const AUTH_STORAGE_KEY = "gszhushui_current_user";
const hasManagementPermission = (user: AuthUser | null) => user?.unit === MANAGEMENT_UNIT;
const isManagementPage = (page: PageType) => MANAGEMENT_PAGES.includes(page);

function AccessDeniedPage() {
  return (
    <PageShell title="无权限" subtitle="当前账号无权访问该页面">
      <div className="rounded border border-[#9fc4e8] bg-white p-8 text-center text-sm text-slate-600 shadow-sm">
        只有“采油管理部”账号可以访问用户管理和系统设置。
      </div>
    </PageShell>
  );
}

function LoginDialog({ theme, onLogin, onCancel }: { theme: ThemeKey; onLogin: (user: AuthUser) => void; onCancel: () => void }) {
  const [empId, setEmpId] = useState("GS001");
  const [password, setPassword] = useState("admin666");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (!empId.trim() || !password.trim()) {
      setError("请输入工号和密码");
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.post<AuthUser>("/api/auth/login", {
        empId: empId.trim(),
        password,
      });
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
      onLogin(data);
      onCancel();
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401) {
        setError("工号或密码错误");
      } else if (status === 403) {
        setError("账号已停用，请联系管理员");
      } else {
        setError("登录失败，请检查服务或数据库连接");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-dialog fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/30 px-4 backdrop-blur-sm" data-theme={theme}>
      <div className="login-dialog-card w-full max-w-md overflow-hidden rounded border border-[#8fb7df] bg-white shadow-xl">
        <div className="login-dialog-hero bg-cnpc-red px-8 py-7 text-center text-white">
          <div className="login-dialog-icon mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/15">
            <Droplet className="h-10 w-10" strokeWidth={2.8} />
          </div>
          <h1 className="text-2xl font-black tracking-wide">注水管理平台</h1>
          <p className="mt-2 text-sm text-white/80">登录后可录入、保存和删除数据</p>
        </div>
        <form data-auth-form="true" onSubmit={submitLogin} className="login-dialog-form space-y-4 px-8 py-7">
          <label className="login-dialog-label block text-sm font-bold text-slate-700">
            工号
            <input
              value={empId}
              onChange={(event) => setEmpId(event.target.value)}
              className="login-dialog-input mt-2 h-10 w-full rounded border border-[#9fc4e8] px-3 font-normal outline-none focus:border-cnpc-red"
              placeholder="请输入工号"
            />
          </label>
          <label className="login-dialog-label block text-sm font-bold text-slate-700">
            密码
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="login-dialog-input mt-2 h-10 w-full rounded border border-[#9fc4e8] px-3 font-normal outline-none focus:border-cnpc-red"
              placeholder="请输入密码"
            />
          </label>
          {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-600">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="login-dialog-submit h-10 w-full rounded bg-cnpc-red text-sm font-bold text-white hover:bg-cnpc-red-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "登录中..." : "登录"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="login-dialog-guest h-10 w-full rounded border border-[#9eb8d4] bg-white text-sm font-bold text-slate-700 hover:bg-[#eaf4ff]"
          >
            游客继续浏览
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [activePage, setActivePage] = useState<PageType>("home");
  const [theme, setTheme] = useState<ThemeKey>(getBrowserTheme);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
  });
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [wellHistoryDirty, setWellHistoryDirty] = useState(false);
  const [pendingPage, setPendingPage] = useState<PageType | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const wellHistorySaveHandlerRef = useRef<PdfSaveHandler | null>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const firstNavItemRef = useRef<HTMLButtonElement | null>(null);
  const showZonalSubNav = isZonalInjectionPage(activePage);
  const canManageSystem = hasManagementPermission(currentUser);
  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => !isManagementPage(item.id) || canManageSystem),
    [canManageSystem],
  );
  const logout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setCurrentUser(null);
    setActivePage("home");
    setPendingPage(null);
    setWellHistoryDirty(false);
  };
  const requireLoginForWrite = () => {
    if (currentUser) return false;
    setShowLoginDialog(true);
    return true;
  };
  const guardGuestWriteClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (currentUser) return;
    const button = (event.target as HTMLElement).closest("button");
    if (!button) return;
    const text = button.textContent?.replace(/\s+/g, "") || "";
    const writeActions = ["新增", "保存", "删除", "导入", "编辑"];
    if (writeActions.some((action) => text.includes(action))) {
      event.preventDefault();
      event.stopPropagation();
      setShowLoginDialog(true);
    }
  };
  const closeMobileNav = () => {
    setMobileNavOpen(false);
    if (isMobileViewport) {
      requestAnimationFrame(() => mobileMenuTriggerRef.current?.focus());
    }
  };
  useEffect(() => {
    const interceptorId = axios.interceptors.request.use((config) => {
      const method = String(config.method || "get").toLowerCase();
      const url = String(config.url || "");
      const isWrite = ["post", "put", "patch", "delete"].includes(method);
      if (currentUser) {
        const headers = AxiosHeaders.from(config.headers);
        headers.set("x-gs-user-unit", encodeURIComponent(currentUser.unit || ""));
        headers.set("x-gs-user-role", currentUser.role || "");
        headers.set("x-gs-user-empid", currentUser.empId || "");
        config.headers = headers;
      }
      if (!currentUser && isWrite && !url.includes("/api/auth/login")) {
        setShowLoginDialog(true);
        return Promise.reject(Object.assign(new Error("Login required"), { isLoginRequired: true }));
      }
      return config;
    });
    return () => axios.interceptors.request.eject(interceptorId);
  }, [currentUser]);
  useEffect(() => {
    persistBrowserTheme(theme);
  }, [theme]);
  useEffect(() => {
    if (isManagementPage(activePage) && !canManageSystem) {
      setActivePage("home");
    }
  }, [activePage, canManageSystem]);
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1023px)");
    const updateViewport = () => {
      setIsMobileViewport(mediaQuery.matches);
      if (!mediaQuery.matches) setMobileNavOpen(false);
    };
    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);
  useEffect(() => {
    if (isMobileViewport && mobileNavOpen) firstNavItemRef.current?.focus();
  }, [isMobileViewport, mobileNavOpen]);
  useEffect(() => {
    const handleMobileNavKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isMobileViewport && mobileNavOpen) {
        closeMobileNav();
      }
    };
    window.addEventListener("keydown", handleMobileNavKeydown);
    return () => window.removeEventListener("keydown", handleMobileNavKeydown);
  }, [isMobileViewport, mobileNavOpen, closeMobileNav]);
  const requestPageChange = (page: PageType) => {
    if (page === activePage) return;
    if (isManagementPage(page) && !canManageSystem) {
      setActivePage("home");
      return;
    }
    if (activePage === "well-history" && wellHistoryDirty) {
      setPendingPage(page);
      return;
    }
    setActivePage(page);
  };
  const confirmPageChange = async () => {
    const nextPage = pendingPage;
    if (!nextPage) return;
    const saved = await wellHistorySaveHandlerRef.current?.();
    if (!saved) return;
    setWellHistoryDirty(false);
    setActivePage(nextPage);
    setPendingPage(null);
  };

  const pageLabel = [...NAV_ITEMS, ...ZONAL_INJECTION_SUB_ITEMS].find((item) => item.id === activePage)?.label ?? "首页";

  return (
    <div
      className="shell-app"
      data-theme={theme}
      onClickCapture={guardGuestWriteClick}
      onSubmitCapture={(event) => {
        if ((event.target as HTMLElement).closest('[data-auth-form="true"]')) return;
        if (requireLoginForWrite()) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {showLoginDialog && (
        <LoginDialog
          theme={theme}
          onLogin={setCurrentUser}
          onCancel={() => setShowLoginDialog(false)}
        />
      )}
      {pendingPage && (
        <StyledConfirmDialog
          message="当前 PDF 有未保存的编辑内容，离开页面后这些内容会消失。是否保存？"
          confirmText="保存"
          onConfirm={() => void confirmPageChange()}
          onCancel={() => setPendingPage(null)}
        />
      )}
      <aside
        id="app-sidebar"
        className={cn("shell-sidebar", mobileNavOpen && "is-open")}
        inert={isMobileViewport && !mobileNavOpen ? "" : undefined}
        aria-hidden={isMobileViewport && !mobileNavOpen ? true : undefined}
      >
        <button
          type="button"
          className="shell-mobile-trigger m-3 self-end"
          aria-label="关闭导航菜单"
          onClick={closeMobileNav}
        >
          关闭
        </button>
        <div className="flex items-center gap-3 px-5 py-6">
          <Droplet className="h-8 w-8 text-shell-accent" strokeWidth={2.4} />
          <div>
            <div className="font-black tracking-wide">注水管理平台</div>
            <div className="mt-0.5 text-xs text-white/65">生产运行管理系统</div>
          </div>
        </div>
        <nav className="shell-sidebar-nav">
          {visibleNavItems.map((item) => {
            const NavIcon = item.icon;

            return (
              <React.Fragment key={item.id}>
                <button
                  ref={item === visibleNavItems[0] ? firstNavItemRef : undefined}
                  onClick={() => {
                    requestPageChange(item.id === "zonal-injection" ? "zonal-indicator-summary" : item.id);
                    closeMobileNav();
                  }}
                  className={cn(
                    "shell-nav-link w-full text-left",
                    (activePage === item.id || (item.id === "zonal-injection" && showZonalSubNav))
                      ? "shell-nav-link-active"
                      : "shell-nav-link-idle",
                  )}
                >
                  <NavIcon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden="true" />
                  {item.label}
                </button>
                {item.id === "zonal-injection" && showZonalSubNav && (
                  <div className="shell-subnav">
                    {ZONAL_INJECTION_SUB_ITEMS.map((subItem) => (
                      <button
                        key={subItem.id}
                        onClick={() => {
                          requestPageChange(subItem.id);
                          closeMobileNav();
                        }}
                        className={cn(
                          "shell-nav-link w-full py-2 text-left text-xs",
                          activePage === subItem.id ? "shell-nav-link-active" : "shell-nav-link-idle",
                        )}
                      >
                        {subItem.label}
                      </button>
                    ))}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </aside>
      <div className="shell-main">
        <header className="shell-topbar">
          <div className="shell-topbar-inner">
            <div className="flex items-center gap-3">
              <button
                ref={mobileMenuTriggerRef}
                className="shell-mobile-trigger"
                onClick={() => {
                  if (isMobileViewport && mobileNavOpen) {
                    closeMobileNav();
                  } else {
                    setMobileNavOpen(true);
                  }
                }}
                aria-label="切换导航菜单"
                aria-expanded={mobileNavOpen}
                aria-controls="app-sidebar"
              >
                菜单
              </button>
              <div>
                <div className="text-xs text-shell-muted">当前位置</div>
                <div className="font-bold text-shell-text">{pageLabel}</div>
              </div>
              <span className="hidden rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 sm:inline">系统运行正常</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-shell-muted">
              {activePage === "home" && (
                <label className="theme-switcher">
                  <span>主题切换</span>
                  <select value={theme} onChange={(event) => setTheme(getStoredTheme(event.target.value))}>
                    {THEME_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>{option.label}</option>
                    ))}
                  </select>
                </label>
              )}
              {currentUser ? (
                <>
                  <span>您好，{currentUser.name}（{currentUser.role}）</span>
                  <button onClick={logout} className="shell-primary-btn">
                    <LogOut className="mr-1 inline h-4 w-4" />
                    退出
                  </button>
                </>
              ) : (
                <>
                  <span>游客浏览</span>
                  <button onClick={() => setShowLoginDialog(true)} className="shell-primary-btn">登录</button>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="shell-content">
          <AppContent
            activePage={activePage}
            currentUser={currentUser}
            onWellHistoryDirtyChange={setWellHistoryDirty}
            onWellHistorySaveHandlerChange={(handler) => {
              wellHistorySaveHandlerRef.current = handler;
            }}
          />
        </main>
      </div>
    </div>
  );
}
