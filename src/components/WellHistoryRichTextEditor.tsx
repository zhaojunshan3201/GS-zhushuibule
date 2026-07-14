import { useCallback, useEffect, useRef, useState } from "react";

export function WellHistoryRichTextEditor({ html, editable, onChange }: { html: string; editable: boolean; onChange?: (html: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const localHtmlRef = useRef<string | null>(null);
  const selectionRef = useRef<Range | null>(null);
  const [active, setActive] = useState({ bold: false, italic: false, underline: false, heading: false, list: false });
  const moveCaretToEditingEnd = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const textBlocks = Array.from(editor.querySelectorAll("p, h1, h2, h3, li, td, th")) as HTMLElement[];
    const lastTextBlock = [...textBlocks].reverse().find((block) => Boolean(block.textContent?.trim()));
    const target = lastTextBlock ?? editor.appendChild(document.createElement("p"));
    if (!lastTextBlock) target.appendChild(document.createElement("br"));
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, []);
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const isLocalUpdate = localHtmlRef.current === html;
    if (!isLocalUpdate && editor.innerHTML !== html) {
      editor.innerHTML = html;
      if (editable) queueMicrotask(moveCaretToEditingEnd);
    }
    localHtmlRef.current = null;
  }, [editable, html, moveCaretToEditingEnd]);
  const refreshActive = useCallback(() => {
    const selection = window.getSelection();
    if (!selection?.anchorNode || !editorRef.current?.contains(selection.anchorNode)) return;
    if (selection.rangeCount) selectionRef.current = selection.getRangeAt(0).cloneRange();
    const block = document.queryCommandValue("formatBlock").toLowerCase();
    setActive({ bold: document.queryCommandState("bold"), italic: document.queryCommandState("italic"), underline: document.queryCommandState("underline"), heading: block === "h2", list: document.queryCommandState("insertUnorderedList") });
  }, []);
  useEffect(() => { document.addEventListener("selectionchange", refreshActive); return () => document.removeEventListener("selectionchange", refreshActive); }, [refreshActive]);
  const command = (name: string, value?: string, preserveSelection = false) => {
    const savedRange = selectionRef.current;
    if (preserveSelection && savedRange) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(savedRange);
      editorRef.current?.focus();
    } else {
      moveCaretToEditingEnd();
    }
    document.execCommand(name, false, value);
    const nextHtml = editorRef.current?.innerHTML ?? "";
    localHtmlRef.current = nextHtml;
    onChange?.(nextHtml);
    refreshActive();
  };
  const buttonClass = (isActive: boolean) => `border px-2 py-1 transition-colors ${isActive ? "border-cnpc-red bg-cnpc-red text-white" : "border-slate-500 bg-white hover:border-cnpc-red hover:text-cnpc-red"}`;
  return <section className="border border-gray-300 bg-white">
    {editable && <div className="flex flex-wrap gap-1 border-b bg-[#f5efe7] p-2 text-xs font-bold text-slate-700">
      <button type="button" onClick={() => command("bold")} className={buttonClass(active.bold)}>B</button><button type="button" onClick={() => command("italic")} className={`${buttonClass(active.italic)} italic`}>I</button><button type="button" onClick={() => command("underline")} className={`${buttonClass(active.underline)} underline`}>U</button>
      <button type="button" onClick={() => command("formatBlock", "h2")} className={buttonClass(active.heading)}>标题</button><button type="button" onClick={() => command("insertUnorderedList")} className={buttonClass(active.list)}>列表</button>
      <label className="flex h-7 cursor-pointer items-center gap-1 border border-slate-500 bg-white px-2 text-xs hover:border-cnpc-red hover:text-cnpc-red" title="字体颜色">
        字色
        <input aria-label="字体颜色" type="color" defaultValue="#000000" className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0" onChange={(event) => command("foreColor", event.target.value, true)} />
      </label>
      <button type="button" onClick={() => command("insertHTML", "<table><tbody><tr><td>内容</td><td>内容</td></tr></tbody></table><p><br></p>")} className={buttonClass(false)}>表格</button>
    </div>}
    <div ref={editorRef} data-well-history-editor contentEditable={editable} suppressContentEditableWarning onFocus={refreshActive} onInput={() => { const nextHtml = editorRef.current?.innerHTML ?? ""; localHtmlRef.current = nextHtml; onChange?.(nextHtml); refreshActive(); }} className="min-h-[620px] p-6 leading-7 outline-none [&_figure]:my-5 [&_h1]:my-5 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:my-4 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:my-3 [&_h3]:text-lg [&_h3]:font-bold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-7 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-7 [&_li]:my-1 [&_img]:mx-auto [&_img]:block [&_img]:max-w-full [&_table]:my-4 [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2" />
  </section>;
}
