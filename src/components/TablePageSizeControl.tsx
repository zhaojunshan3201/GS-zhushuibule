import { useEffect, useRef, useState } from "react";
import { normalizeTablePageSizeInput } from "../shared/tablePageSize";

export function TablePageSizeControl({
  pageSize,
  onPageSizeChange,
}: {
  pageSize: number;
  onPageSizeChange: (pageSize: number) => void;
}) {
  const [draft, setDraft] = useState(String(pageSize));
  const suppressNextBlur = useRef(false);

  useEffect(() => {
    setDraft(String(pageSize));
  }, [pageSize]);

  const commit = () => {
    if (suppressNextBlur.current) {
      suppressNextBlur.current = false;
      setDraft(String(pageSize));
      return;
    }

    const normalized = normalizeTablePageSizeInput(draft);
    if (normalized === null) {
      setDraft(String(pageSize));
      return;
    }

    setDraft(String(normalized));
    if (normalized !== pageSize) onPageSizeChange(normalized);
  };

  return (
    <span className="flex items-center gap-1 whitespace-nowrap text-[12px] text-[#001a33]">
      每页 <input
        aria-label="每页显示行数"
        className="h-6 w-11 rounded border border-[#9bbfe5] bg-white px-1 text-center text-[12px] outline-none"
        type="number"
        min={5}
        max={100}
        step={1}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            suppressNextBlur.current = true;
            setDraft(String(pageSize));
            event.currentTarget.blur();
          }
        }}
      /> 条
    </span>
  );
}
