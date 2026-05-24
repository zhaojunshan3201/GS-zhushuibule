export type HomeReserveOverviewSeedRow = {
  unit: "采一" | "采二";
  block: string;
  oilArea: number;
  producingReserve: number;
  recoverableReserve: number;
  recoveryRate: number;
  lastYearOil: number;
  sortOrder: number;
};

export type HomeReserveOverviewRow = Omit<HomeReserveOverviewSeedRow, "unit"> & {
  unit: HomeReserveOverviewSeedRow["unit"] | "合计";
  id?: string;
  rowType: "block" | "subtotal" | "total";
};

const HOME_RESERVE_OVERVIEW_ORDER = [
  { unit: "采一" as const, blocks: ["雷11", "雷04", "雷72"] },
  { unit: "采二" as const, blocks: ["牛心坨油层", "牛心坨潜山", "坨33"] },
];

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const calculateRecoveryRate = (recoverableReserve: number, producingReserve: number) =>
  producingReserve > 0 ? round2((recoverableReserve / producingReserve) * 100) : 0;

type SummableHomeReserveRow = Pick<HomeReserveOverviewSeedRow, "oilArea" | "producingReserve" | "recoverableReserve" | "lastYearOil">;

const sumRows = (unit: HomeReserveOverviewSeedRow["unit"] | "合计", block: string, rows: SummableHomeReserveRow[]): HomeReserveOverviewRow => {
  const oilArea = round2(rows.reduce((sum, row) => sum + row.oilArea, 0));
  const producingReserve = round2(rows.reduce((sum, row) => sum + row.producingReserve, 0));
  const recoverableReserve = round2(rows.reduce((sum, row) => sum + row.recoverableReserve, 0));
  const lastYearOil = round2(rows.reduce((sum, row) => sum + row.lastYearOil, 0));

  return {
    unit,
    block,
    oilArea,
    producingReserve,
    recoverableReserve,
    recoveryRate: calculateRecoveryRate(recoverableReserve, producingReserve),
    lastYearOil,
    sortOrder: 999,
    rowType: unit === "合计" ? "total" : "subtotal",
  };
};

export function buildHomeReserveOverviewRows(sourceRows: HomeReserveOverviewSeedRow[]): HomeReserveOverviewRow[] {
  const rows: HomeReserveOverviewRow[] = [];

  for (const group of HOME_RESERVE_OVERVIEW_ORDER) {
    const groupRows = group.blocks.map((block) => {
      const found = sourceRows.find((row) => row.unit === group.unit && row.block === block);
      return {
        unit: group.unit,
        block,
        oilArea: found?.oilArea ?? 0,
        producingReserve: found?.producingReserve ?? 0,
        recoverableReserve: found?.recoverableReserve ?? 0,
        recoveryRate: found?.recoveryRate ?? 0,
        lastYearOil: found?.lastYearOil ?? 0,
        sortOrder: found?.sortOrder ?? 0,
        rowType: "block" as const,
      };
    });
    rows.push(...groupRows, sumRows(group.unit, "小计", groupRows));
  }

  rows.push(sumRows("合计", "", rows.filter((row) => row.rowType === "block")));
  return rows;
}

export function buildHomeReserveOverviewSeedRows(): HomeReserveOverviewSeedRow[] {
  return [
    { unit: "采一", block: "雷11", oilArea: 3.42, producingReserve: 185.6, recoverableReserve: 42.7, recoveryRate: 23.01, lastYearOil: 5.86, sortOrder: 1 },
    { unit: "采一", block: "雷04", oilArea: 2.18, producingReserve: 96.3, recoverableReserve: 21.9, recoveryRate: 22.74, lastYearOil: 3.12, sortOrder: 2 },
    { unit: "采一", block: "雷72", oilArea: 1.76, producingReserve: 73.4, recoverableReserve: 16.8, recoveryRate: 22.89, lastYearOil: 2.45, sortOrder: 3 },
    { unit: "采二", block: "牛心坨油层", oilArea: 4.26, producingReserve: 221.8, recoverableReserve: 54.1, recoveryRate: 24.39, lastYearOil: 7.68, sortOrder: 4 },
    { unit: "采二", block: "牛心坨潜山", oilArea: 2.94, producingReserve: 148.5, recoverableReserve: 33.7, recoveryRate: 22.69, lastYearOil: 4.36, sortOrder: 5 },
    { unit: "采二", block: "坨33", oilArea: 1.58, producingReserve: 68.9, recoverableReserve: 15.4, recoveryRate: 22.35, lastYearOil: 2.08, sortOrder: 6 },
  ];
}
