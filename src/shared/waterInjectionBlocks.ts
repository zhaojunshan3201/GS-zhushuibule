export const WATER_INJECTION_BLOCK_UNIT_MAP: Record<string, string> = {
  "高18": "高采采油作业一区",
  "雷11": "高采采油作业一区",
  "雷64": "高采采油作业一区",
  "雷72": "高采采油作业一区",
  "牛心坨油层": "高采采油作业二区",
  "牛心坨潜山": "高采采油作业二区",
  "坨33": "高采采油作业二区",
  "高3": "高采采油作业三区",
};

const WATER_INJECTION_BLOCK_RULES: Record<string, Record<string, string | null>> = {
  "高采采油作业一区": {
    "高18": "高18",
    "高18(南)": "高18",
    "雷11": "雷11",
    "雷家L": "雷11",
    "雷家D": "雷11",
    "雷64": "雷64",
    "雷64氮气驱": "雷64",
    "雷64水驱": "雷64",
    "雷72": "雷72",
    "高升零散井(采一)": null,
  },
  "高采采油作业二区": {
    "牛心坨油层": "牛心坨油层",
    "牛心坨N1-3": "牛心坨油层",
    "牛心坨N4-5": "牛心坨油层",
    "牛心坨N6-7": "牛心坨油层",
    "牛心坨潜山": "牛心坨潜山",
    "坨33": "坨33",
    "牛心坨零散井": null,
    "宋1未开发区": null,
    "坨19": null,
    "坨25": null,
    "坨32未开发区": null,
  },
  "高采采油作业三区": {
    "高3": "高3",
    "3块L6": "高3",
    "3块L7": "高3",
  },
};

const WATER_INJECTION_UNIT_ALIASES: Record<string, string> = {
  "采油作业一区": "高采采油作业一区",
  "采油作业二区": "高采采油作业二区",
  "采油作业三区": "高采采油作业三区",
};

function normalizeWaterInjectionUnit(unit: string) {
  const normalizedUnit = unit.trim();
  return WATER_INJECTION_UNIT_ALIASES[normalizedUnit] ?? normalizedUnit;
}

export function normalizeWaterInjectionBlock(unit: string, block: string) {
  const normalizedUnit = normalizeWaterInjectionUnit(unit);
  const normalizedBlock = block.trim();
  const unitRules = WATER_INJECTION_BLOCK_RULES[normalizedUnit];
  if (!unitRules || !(normalizedBlock in unitRules)) {
    return null;
  }
  return unitRules[normalizedBlock];
}

export function getWaterInjectionBlocks(unit?: string) {
  const blocks = Object.keys(WATER_INJECTION_BLOCK_UNIT_MAP);
  if (!unit) {
    return blocks;
  }
  const normalizedUnit = normalizeWaterInjectionUnit(unit);
  return blocks.filter((block) => WATER_INJECTION_BLOCK_UNIT_MAP[block] === normalizedUnit);
}

export function getWaterInjectionRawBlocks(unit: string) {
  const unitRules = WATER_INJECTION_BLOCK_RULES[normalizeWaterInjectionUnit(unit)];
  if (!unitRules) {
    return [];
  }
  return Object.entries(unitRules)
    .filter(([, normalizedBlock]) => normalizedBlock !== null)
    .map(([rawBlock]) => rawBlock);
}

/** Full consolidated-block → raw-blocks lookup (reverse of WATER_INJECTION_BLOCK_RULES). */
export const WATER_CONSOLIDATED_TO_RAW: Record<string, Record<string, string[]>> = (() => {
  const result: Record<string, Record<string, string[]>> = {};
  for (const [unit, rules] of Object.entries(WATER_INJECTION_BLOCK_RULES)) {
    const unitMap: Record<string, string[]> = {};
    for (const [rawBlock, consolidated] of Object.entries(rules)) {
      if (consolidated === null) continue;
      if (!unitMap[consolidated]) unitMap[consolidated] = [];
      unitMap[consolidated].push(rawBlock);
    }
    result[unit] = unitMap;
  }
  return result;
})();

/** Return all raw block names that map to a given consolidated block under the given unit. */
export function getWaterRawBlocksForConsolidated(unit: string, consolidatedBlock: string): string[] {
  const normalizedUnit = normalizeWaterInjectionUnit(unit);
  return WATER_CONSOLIDATED_TO_RAW[normalizedUnit]?.[consolidatedBlock] ?? [];
}

/** Return ALL raw block names (across all units) that map to a given consolidated block name. */
export function getAllWaterRawBlocksForConsolidated(consolidatedBlock: string): string[] {
  const result: string[] = [];
  for (const unitRules of Object.values(WATER_CONSOLIDATED_TO_RAW)) {
    const raw = unitRules[consolidatedBlock];
    if (raw) result.push(...raw);
  }
  return result;
}

export { normalizeWaterInjectionUnit };