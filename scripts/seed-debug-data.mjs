import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const now = new Date();
const ymd = (offsetDays = 0) => {
  const date = new Date(now);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};
const zhNow = now.toLocaleString("zh-CN", { hour12: false });

const units = ["高采采油作业一区", "高采采油作业二区", "高采采油作业三区"];

const wells = [
  { id: "debug-well-001", unit: units[0], block: "雷11", status: "正常", pressure: 12.4, injectionRate: 42 },
  { id: "debug-well-002", unit: units[0], block: "雷64", status: "重点关注", pressure: 15.1, injectionRate: 38 },
  { id: "debug-well-003", unit: units[0], block: "高18", status: "调配中", pressure: 13.8, injectionRate: 45 },
  { id: "debug-well-004", unit: units[1], block: "牛心坨油层", status: "正常", pressure: 11.7, injectionRate: 35 },
  { id: "debug-well-005", unit: units[1], block: "坨33", status: "洗井待办", pressure: 16.2, injectionRate: 31 },
  { id: "debug-well-006", unit: units[2], block: "高3", status: "正常", pressure: 10.9, injectionRate: 29 },
];

const indicatorRows = [
  ["debug-indicator-001", units[0], "雷11", "雷25-21-24", ymd(-12), "N1-N2", [20, 8.1, 35, 10.4, 50, 12.7, 65, 15.2, 80, 18.8]],
  ["debug-indicator-002", units[0], "雷11", "雷25-21-48", ymd(-10), "N2-N3", [18, 7.8, 32, 9.8, 48, 12.1, 62, 14.9, 78, 18.2]],
  ["debug-indicator-003", units[0], "雷64", "雷64-26-20", ymd(-9), "N1-N4", [22, 8.6, 38, 10.9, 54, 13.5, 70, 16.1, 86, 19.5]],
  ["debug-indicator-004", units[1], "牛心坨油层", "坨38-35", ymd(-7), "潜山段", [16, 7.2, 30, 9.5, 44, 12.2, 58, 15.0, 72, 18.1]],
  ["debug-indicator-005", units[1], "坨33", "坨33-34-30", ymd(-6), "主力层", [19, 7.9, 34, 10.1, 49, 12.8, 64, 15.6, 82, 19.0]],
  ["debug-indicator-006", units[2], "高3", "高3-5-041", ymd(-5), "N3-N5", [21, 8.3, 36, 10.8, 52, 13.0, 69, 16.0, 88, 19.8]],
];

const dynamicAnalysisRows = [
  ["debug-da-overall-oil-1", "overall-oil", units[0], "雷11", null, ["10", "8", "520", "43", "91.7"], ["9", "7", "500", "40", "92.0"], ["8", "6", "470", "36", "92.3"], ["+1", "+1", "+20", "+3", "-0.3"], ["+2", "+2", "+50", "+7", "-0.6"], ["保持雷11稳注，跟踪高含水井产液变化", "建议对雷25-21井组复核配注"]],
  ["debug-da-overall-water-1", "overall-water", units[0], "雷11", null, ["18", "15", "280"], ["17", "14", "265"], ["16", "13", "250"], ["+1", "+1", "+15"], ["+2", "+2", "+30"], ["雷11注采对应较好", "关注套压升高井"]],
  ["debug-da-single-oil-1", "single-oil", units[0], "雷11", "雷25-21-24", ["12.4", "3.1", "74.8"], ["11.2", "2.7", "75.9"], ["9.8", "2.2", "77.6"], ["+1.2", "+0.4", "-1.1"], ["+2.6", "+0.9", "-2.8"], ["调配后日产油提升", "继续跟踪含水下降趋势"]],
  ["debug-da-single-water-1", "single-water", units[0], "雷11", "雷31-9", ["42", "13.5", "7.8"], ["39", "13.0", "7.5"], ["36", "12.6", "7.2"], ["+3", "+0.5", "+0.3"], ["+6", "+0.9", "+0.6"], ["注水能力满足当前方案", "建议下周期复测指示曲线"]],
  ["debug-da-overall-oil-2", "overall-oil", units[1], "牛心坨油层", null, ["14", "11", "760", "65", "91.4"], ["13", "10", "735", "62", "91.6"], ["12", "9", "700", "58", "91.7"], ["+1", "+1", "+25", "+3", "-0.2"], ["+2", "+2", "+60", "+7", "-0.3"], ["牛心坨油层整体平稳", "建议优化边部水井注入"]],
  ["debug-da-single-water-2", "single-water", units[1], "牛心坨油层", "坨38-35", ["36", "12.1", "6.9"], ["34", "11.8", "6.6"], ["31", "11.3", "6.2"], ["+2", "+0.3", "+0.3"], ["+5", "+0.8", "+0.7"], ["吸水能力增强", "关注邻井见效"]],
];

async function resetDebugRows() {
  await prisma.wellMeasure.deleteMany({ where: { id: { startsWith: "debug-" } } });
  await prisma.pressureData.deleteMany({ where: { id: { startsWith: "debug-" } } });
  await prisma.adjustmentRecord.deleteMany({ where: { id: { startsWith: "debug-" } } });
  await prisma.well.deleteMany({ where: { id: { startsWith: "debug-" } } });
  await prisma.task.deleteMany({ where: { id: { startsWith: "debug-" } } });
  await prisma.meeting.deleteMany({ where: { id: { startsWith: "debug-" } } });
  await prisma.notification.deleteMany({ where: { id: { startsWith: "debug-" } } });
  await prisma.auditLog.deleteMany({ where: { id: { startsWith: "debug-" } } });
  await prisma.indicatorCurveRecord.deleteMany({ where: { id: { startsWith: "debug-" } } });
  await prisma.dynamicAnalysisRecord.deleteMany({ where: { id: { startsWith: "debug-" } } });
  await prisma.user.deleteMany({ where: { empId: { startsWith: "DBG" } } });
}

async function seedDebugRows() {
  await prisma.user.createMany({
    data: [
      { id: "debug-user-admin", name: "调试管理员", empId: "DBG001", email: "debug.admin@example.local", password: "admin666", role: "ADMIN", unit: units[0], status: "Active", phone: "13800000001", gender: "男" },
      { id: "debug-user-analyst", name: "动态分析员", empId: "DBG002", email: "debug.analyst@example.local", password: "123456", role: "ANALYST", unit: units[1], status: "Active", phone: "13800000002", gender: "女" },
      { id: "debug-user-operator", name: "注水岗操作员", empId: "DBG003", email: "debug.operator@example.local", password: "123456", role: "OPERATOR", unit: units[2], status: "Active", phone: "13800000003", gender: "男" },
    ],
  });

  await prisma.well.createMany({ data: wells.map((well) => ({ ...well, lastUpdate: now })) });

  await prisma.pressureData.createMany({
    data: wells.flatMap((well, wellIndex) =>
      Array.from({ length: 12 }, (_, index) => ({
        id: `debug-pressure-${well.id}-${index + 1}`,
        wellId: well.id,
        date: ymd(index - 11),
        pressure: Number((well.pressure + Math.sin(index / 2) * 0.8 + wellIndex * 0.15).toFixed(2)),
        flowRate: Number((well.injectionRate + Math.cos(index / 3) * 2.5).toFixed(2)),
      })),
    ),
  });

  await prisma.wellMeasure.createMany({
    data: wells.flatMap((well, index) => [
      {
        id: `debug-measure-${well.id}-flush`,
        wellId: well.id,
        date: ymd(-20 + index),
        type: "洗井",
        description: `${well.id} 完成常规洗井，返排水清澈度达标`,
        status: index % 3 === 0 ? "Pending" : "Completed",
        result: index % 3 === 0 ? null : "压力恢复正常",
      },
      {
        id: `debug-measure-${well.id}-adjust`,
        wellId: well.id,
        date: ymd(-8 + index),
        type: "调配",
        description: `${well.id} 根据井组见效调整日配注`,
        status: "Completed",
        result: `日配注调整至 ${well.injectionRate} m³/d`,
      },
    ]),
  });

  await prisma.adjustmentRecord.createMany({
    data: wells.slice(0, 4).map((well, index) => ({
      id: `debug-adjustment-${index + 1}`,
      wellId: well.id,
      currentRate: well.injectionRate - 4,
      suggestedRate: well.injectionRate,
      reason: index % 2 === 0 ? "邻井含水上升，优化分层吸水" : "井组产油见效弱，提升主力层注入",
      status: index % 2 === 0 ? "Approved" : "Proposed",
      timestamp: new Date(now.getTime() - index * 86400000),
    })),
  });

  await prisma.task.createMany({
    data: [
      { id: "debug-task-001", title: "雷11井组注采对应复核", description: "核对雷11区块近7天注水、产液和含水变化，形成调配建议。", status: "In Progress", priority: "High", progress: 55, deadline: ymd(2), fromUnit: "生产运行科", toUnit: units[0], timestamp: zhNow, replies: JSON.stringify([{ user: "调试管理员", text: "已完成数据初筛，等待现场复核。", time: zhNow }]) },
      { id: "debug-task-002", title: "牛心坨油层洗井计划确认", description: "确认坨38-35、坨33-34-30洗井窗口和施工资源。", status: "Pending", priority: "Medium", progress: 20, deadline: ymd(4), fromUnit: "地质所", toUnit: units[1], timestamp: zhNow, replies: JSON.stringify([]) },
      { id: "debug-task-003", title: "高3指示曲线复测", description: "完成高3-5-041指示曲线复测并上传结果。", status: "Auditing", priority: "Medium", progress: 85, deadline: ymd(1), fromUnit: "注采管理室", toUnit: units[2], timestamp: zhNow, replies: JSON.stringify([{ user: "注水岗操作员", text: "现场复测已完成，数据已录入。", time: zhNow }]) },
    ],
  });

  await prisma.meeting.createMany({
    data: [
      { id: "debug-meeting-001", title: "周度注水动态分析会", content: "复盘本周注采响应、异常水井和下周调配计划。", date: ymd(1), time: "09:30", location: "生产楼三楼会议室", organizer: "生产运行科" },
      { id: "debug-meeting-002", title: "单井井史资料补录评审", content: "检查PPT/PDF归档质量，确认缺失井史补录清单。", date: ymd(3), time: "15:00", location: "资料室", organizer: "信息管理岗" },
    ],
  });

  await prisma.notification.createMany({
    data: [
      { id: "debug-notification-001", userId: null, title: "调试数据已刷新", content: "系统已填充用于页面联调的模拟数据。", type: "success", time: zhNow, isRead: false },
      { id: "debug-notification-002", userId: "debug-user-operator", title: "待处理洗井任务", content: "坨33井组存在待确认洗井计划。", type: "warning", time: zhNow, isRead: false },
      { id: "debug-notification-003", userId: "debug-user-analyst", title: "动态分析样例已生成", content: "可在动态分析页面查看总体和单井对比样例。", type: "info", time: zhNow, isRead: true },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      { id: "debug-audit-001", user: "调试管理员", role: "ADMIN", action: "刷新调试数据", details: "执行 scripts/seed-debug-data.mjs", timestamp: zhNow, ip: "127.0.0.1" },
      { id: "debug-audit-002", user: "动态分析员", role: "ANALYST", action: "查看动态分析", details: "筛选雷11区块总体对比", timestamp: zhNow, ip: "127.0.0.1" },
      { id: "debug-audit-003", user: "注水岗操作员", role: "OPERATOR", action: "上传指示曲线", details: "录入高3-5-041指示曲线样例", timestamp: zhNow, ip: "127.0.0.1" },
    ],
  });

  await prisma.deptResponsibility.createMany({
    data: units.map((unit, index) => ({
      unit,
      responsibility: [
        "负责雷11、雷64等区块注水动态跟踪、异常水井处理和现场调配执行。",
        "负责牛心坨油层、坨33区块分注管理、洗井计划和井史归档。",
        "负责高3区块注采对应分析、指示曲线复测和调配效果跟踪。",
      ][index],
    })),
    skipDuplicates: true,
  });

  await prisma.indicatorCurveRecord.createMany({
    data: indicatorRows.map(([id, unit, block, wellNo, testDate, testInterval, values]) => ({
      id,
      unit,
      block,
      wellNo,
      testDate: new Date(`${testDate}T00:00:00.000Z`),
      testInterval,
      injection1: values[0],
      pressure1: values[1],
      injection2: values[2],
      pressure2: values[3],
      injection3: values[4],
      pressure3: values[5],
      injection4: values[6],
      pressure4: values[7],
      injection5: values[8],
      pressure5: values[9],
      createdAt: now,
      updatedAt: now,
    })),
    skipDuplicates: true,
  });

  await prisma.dynamicAnalysisRecord.createMany({
    data: dynamicAnalysisRows.map(([id, kind, unit, block, wellNo, endValues, averageValues, lastYearValues, diffMonth, diffYear, advice]) => ({
      id,
      kind,
      unit,
      block,
      wellNo,
      endValues,
      averageValues,
      lastYearValues,
      diffMonth,
      diffYear,
      advice,
      status: wellNo ? "需跟踪" : "正常",
      process: kind.includes("water") ? "分注" : null,
      createdAt: now,
      updatedAt: now,
    })),
  });
}

async function summarize() {
  const entries = await Promise.all([
    ["Task", prisma.task.count()],
    ["Meeting", prisma.meeting.count()],
    ["Well", prisma.well.count()],
    ["WellMeasure", prisma.wellMeasure.count()],
    ["PressureData", prisma.pressureData.count()],
    ["AdjustmentRecord", prisma.adjustmentRecord.count()],
    ["IndicatorCurveRecord", prisma.indicatorCurveRecord.count()],
    ["DynamicAnalysisRecord", prisma.dynamicAnalysisRecord.count()],
    ["User", prisma.user.count()],
    ["Notification", prisma.notification.count()],
    ["AuditLog", prisma.auditLog.count()],
    ["DeptResponsibility", prisma.deptResponsibility.count()],
  ].map(async ([name, countPromise]) => [name, await countPromise]));
  return Object.fromEntries(entries);
}

try {
  await resetDebugRows();
  await seedDebugRows();
  console.log(JSON.stringify(await summarize(), null, 2));
} finally {
  await prisma.$disconnect();
}
