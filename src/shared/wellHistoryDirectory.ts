export function groupWellHistoryArchivesByUnit<T extends { unit?: string | null }>(archives: T[]) {
  return archives.reduce<Record<string, T[]>>((groups, item) => {
    const unitName = item.unit || "未分配作业区";
    (groups[unitName] ||= []).push(item);
    return groups;
  }, {});
}
