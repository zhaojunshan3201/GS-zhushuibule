import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { ChevronDown, ChevronUp, Download, FileText, History, Plus, Redo2, Save, Trash2, Undo2 } from "lucide-react";
import {
  applyPptxEdit,
  parsePptxWellHistory,
  type PptxEdit,
  type PptxSlide,
  type PptxWellHistoryDocument,
} from "../shared/pptxWellHistory";

type SaveHandler = () => Promise<boolean>;
type DownloadHandler = () => Promise<void>;
type PptxRecord = {
  id?: string;
  fileUrl?: string | null;
  originalName?: string | null;
  versionNo?: number | null;
  editorModelJson?: unknown;
};
type PptxVersion = { id: string; versionNo: number; savedBy?: string | null; createdAt?: string | null };

const asEditorDocument = (value: PptxRecord["editorModelJson"]) => {
  const candidate = value as PptxWellHistoryDocument | null;
  if (!candidate || !Array.isArray(candidate.slides) || !Array.isArray(candidate.source)) return null;
  return { ...candidate, source: new Uint8Array(candidate.source), dirty: false } as PptxWellHistoryDocument;
};

function labelFor(slide: PptxSlide, index: number) {
  return slide.elements.find((element) => element.type === "text")?.text.trim().slice(0, 34) || `第 ${index + 1} 页`;
}

export function PptxWellHistoryEditor({
  wellNo,
  currentPptx,
  onDirtyChange,
  onSaveHandlerChange,
  onDownloadHandlerChange,
}: {
  wellNo: string;
  currentPptx: PptxRecord;
  onDirtyChange?: (dirty: boolean) => void;
  onSaveHandlerChange?: (handler: SaveHandler | null) => void;
  onDownloadHandlerChange?: (handler: DownloadHandler | null) => void;
}) {
  const [document, setDocument] = useState<PptxWellHistoryDocument | null>(null);
  const [history, setHistory] = useState<PptxWellHistoryDocument[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedSlideId, setSelectedSlideId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [versions, setVersions] = useState<PptxVersion[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const documentRef = useRef<PptxWellHistoryDocument | null>(null);
  const versionNoRef = useRef(currentPptx.versionNo ?? 1);

  useEffect(() => { documentRef.current = document; }, [document]);
  useEffect(() => { versionNoRef.current = currentPptx.versionNo ?? 1; }, [currentPptx.versionNo]);
  useEffect(() => { onDirtyChange?.(Boolean(document?.dirty)); }, [document?.dirty, onDirtyChange]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        let next = asEditorDocument(currentPptx.editorModelJson);
        if (!next) {
          if (!currentPptx.fileUrl) throw new Error("该井暂无 PPTX 原件。");
          const response = await fetch(currentPptx.fileUrl);
          if (!response.ok) throw new Error("PPTX 原件加载失败。");
          next = await parsePptxWellHistory(await response.arrayBuffer());
        }
        if (!active) return;
        setDocument(next);
        setHistory([next]);
        setHistoryIndex(0);
        setSelectedSlideId(next.slides[0]?.id ?? "");
      } catch (loadError: any) {
        if (active) setError(loadError?.message || "PPTX 加载失败。");
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [currentPptx.editorModelJson, currentPptx.fileUrl, wellNo]);

  const selectedSlide = useMemo(() => document?.slides.find((slide) => slide.id === selectedSlideId) ?? document?.slides[0] ?? null, [document, selectedSlideId]);
  const commit = useCallback((edit: PptxEdit) => {
    const current = documentRef.current;
    if (!current) return;
    const next = applyPptxEdit(current, edit);
    if (next === current) return;
    const nextHistory = [...history.slice(0, historyIndex + 1), next];
    setDocument(next);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  }, [history, historyIndex]);

  const undo = () => {
    if (historyIndex < 1) return;
    const nextIndex = historyIndex - 1;
    const restored = { ...history[nextIndex], dirty: nextIndex > 0 };
    setHistoryIndex(nextIndex);
    setDocument(restored);
  };
  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const nextIndex = historyIndex + 1;
    const restored = { ...history[nextIndex], dirty: true };
    setHistoryIndex(nextIndex);
    setDocument(restored);
  };

  const save = useCallback(async () => {
    const current = documentRef.current;
    if (!current || !current.dirty) return true;
    setSaving(true);
    setError("");
    try {
      const { data } = await axios.post<PptxRecord>(`/api/well-history-archives/${encodeURIComponent(wellNo)}/pptx/versions`, {
        document: { ...current, source: Array.from(current.source) },
        baseVersionNo: versionNoRef.current,
      });
      versionNoRef.current = data.versionNo ?? versionNoRef.current + 1;
      const saved = { ...current, dirty: false };
      setDocument(saved);
      setHistory([saved]);
      setHistoryIndex(0);
      return true;
    } catch (saveError: any) {
      setError(saveError?.response?.data?.error || "PPTX 保存失败。");
      return false;
    } finally { setSaving(false); }
  }, [wellNo]);

  const download = useCallback(async () => {
    const response = await fetch(`/api/well-history-archives/${encodeURIComponent(wellNo)}/pptx/download`);
    if (!response.ok) { setError("PPTX 下载失败。"); return; }
    const url = URL.createObjectURL(await response.blob());
    const anchor = window.document.createElement("a");
    anchor.href = url;
    anchor.download = currentPptx.originalName || `${wellNo}.pptx`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [currentPptx.originalName, wellNo]);

  useEffect(() => {
    onSaveHandlerChange?.(save);
    onDownloadHandlerChange?.(download);
    return () => { onSaveHandlerChange?.(null); onDownloadHandlerChange?.(null); };
  }, [download, onDownloadHandlerChange, onSaveHandlerChange, save]);

  const loadVersions = async () => {
    setShowVersions((value) => !value);
    try { const { data } = await axios.get<PptxVersion[]>(`/api/well-history-archives/${encodeURIComponent(wellNo)}/pptx/versions`); setVersions(data); }
    catch { setError("版本列表加载失败。"); }
  };

  if (loading) return <div className="py-20 text-center text-sm text-gray-400">正在加载 PPTX...</div>;
  if (!document || !selectedSlide) return <div className="border border-dashed border-gray-200 p-10 text-center text-sm text-gray-400">{error || "该井暂无 PPTX 原件。"}</div>;

  const toolbarButton = "inline-flex h-8 items-center gap-1 border border-gray-200 bg-white px-2 text-xs font-bold text-gray-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45";
  const editableText = selectedSlide.elements.filter((element) => element.type === "text");

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-2">
      <button type="button" className={toolbarButton} onClick={undo} disabled={historyIndex < 1}><Undo2 className="h-3.5 w-3.5" />撤销</button>
      <button type="button" className={toolbarButton} onClick={redo} disabled={historyIndex >= history.length - 1}><Redo2 className="h-3.5 w-3.5" />重做</button>
      <span className="h-5 w-px bg-gray-200" />
      <button type="button" className={toolbarButton} onClick={() => commit({ type: "add-slide", afterSlideId: selectedSlide.id })}><Plus className="h-3.5 w-3.5" />新增页</button>
      <button type="button" className={toolbarButton} onClick={() => commit({ type: "delete-slide", slideId: selectedSlide.id })} disabled={document.slides.length <= 1}><Trash2 className="h-3.5 w-3.5" />删除页</button>
      <button type="button" className={toolbarButton} onClick={() => commit({ type: "reorder-slides", fromIndex: document.slides.findIndex((slide) => slide.id === selectedSlide.id), toIndex: document.slides.findIndex((slide) => slide.id === selectedSlide.id) - 1 })} disabled={document.slides[0].id === selectedSlide.id}><ChevronUp className="h-3.5 w-3.5" />上移</button>
      <button type="button" className={toolbarButton} onClick={() => commit({ type: "reorder-slides", fromIndex: document.slides.findIndex((slide) => slide.id === selectedSlide.id), toIndex: document.slides.findIndex((slide) => slide.id === selectedSlide.id) + 1 })} disabled={document.slides.at(-1)?.id === selectedSlide.id}><ChevronDown className="h-3.5 w-3.5" />下移</button>
      <span className="h-5 w-px bg-gray-200" />
      <button type="button" className="inline-flex h-8 items-center gap-1 bg-cnpc-red px-3 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50" onClick={() => void save()} disabled={saving || !document.dirty}><Save className="h-3.5 w-3.5" />{saving ? "保存中" : "保存"}</button>
      <button type="button" className={toolbarButton} onClick={() => void download()}><Download className="h-3.5 w-3.5" />下载</button>
      {currentPptx.fileUrl && <a className={toolbarButton} href={currentPptx.fileUrl} target="_blank" rel="noreferrer"><FileText className="h-3.5 w-3.5" />原件</a>}
      <button type="button" className={toolbarButton} onClick={() => void loadVersions()}><History className="h-3.5 w-3.5" />版本列表</button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
    {showVersions && <div className="border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-slate-700">{versions.length ? versions.map((version) => <div key={version.id}>V{version.versionNo}　{version.savedBy || "管理员"}　{version.createdAt?.slice(0, 19).replace("T", " ")}</div>) : "暂无历史版本"}</div>}
    <div className="grid min-h-[580px] grid-cols-[156px_minmax(0,1fr)] border border-gray-200 bg-slate-100">
      <aside className="overflow-y-auto border-r border-gray-200 bg-white p-2">
        {document.slides.map((slide, index) => <button key={slide.id} type="button" onClick={() => setSelectedSlideId(slide.id)} className={`mb-2 w-full border p-2 text-left ${slide.id === selectedSlide.id ? "border-cnpc-red bg-red-50" : "border-gray-200 hover:bg-slate-50"}`}>
          <span className="block text-[10px] text-gray-400">第 {index + 1} 页</span><span className="mt-1 block truncate text-xs font-bold text-slate-700">{labelFor(slide, index)}</span>
        </button>)}
      </aside>
      <section className="overflow-auto p-8">
        <div className="mx-auto min-h-[430px] max-w-4xl bg-white p-10 shadow-lg" style={{ aspectRatio: "16 / 9" }}>
          <div className="mb-5 text-xs font-bold text-slate-400">第 {document.slides.findIndex((slide) => slide.id === selectedSlide.id) + 1} 页 · 仅文本元素可编辑</div>
          <div className="space-y-4">{editableText.map((element) => <div key={element.id} contentEditable suppressContentEditableWarning role="textbox" tabIndex={0} onBlur={(event) => commit({ type: "replace-text", slideId: selectedSlide.id, elementId: element.id, text: event.currentTarget.textContent || "" })} className="whitespace-pre-wrap border border-transparent p-2 text-lg text-slate-800 outline-none hover:border-red-200 focus:border-cnpc-red">{element.text}</div>)}</div>
          {selectedSlide.elements.filter((element) => element.type !== "text").map((element) => <div key={element.id} className="mt-3 border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">{element.type === "unsupported" ? "不支持编辑的原件元素，保存时将保持原样。" : element.type === "image" ? "图片原件保留。" : "表格原件保留。"}</div>)}
        </div>
      </section>
    </div>
  </div>;
}
