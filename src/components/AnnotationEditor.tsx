import { useEffect, useRef } from "react";
import { ANNOTATION_COLOR_META, ANNOTATION_COLOR_ORDER, parseAnnotationSegments } from "@/lib/clinical";
import type { AnnotationColor } from "@/data/patients";

interface Props {
  /** Texto com marcação `[[cor:trecho]]`. */
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}

/** Converte o conteúdo do editor (DOM) de volta para texto com marcação. */
function serialize(root: HTMLElement): string {
  let out = "";
  const walk = (node: Node, color: AnnotationColor) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = (node.textContent ?? "").replace(/\u00a0/g, " ");
      if (!t) return;
      out += color === "default" ? t : `[[${color}:${t}]]`;
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === "BR") {
      out += "\n";
      return;
    }
    const attr = node.dataset.color as AnnotationColor | undefined;
    const next = attr && attr in ANNOTATION_COLOR_META ? attr : color;
    const block = node.tagName === "DIV" || node.tagName === "P";
    if (block && out && !out.endsWith("\n")) out += "\n";
    node.childNodes.forEach((child) => walk(child, next));
  };
  root.childNodes.forEach((child) => walk(child, "default"));
  return out;
}

/** Gera o HTML colorido a partir do texto com marcação. */
function toHtml(value: string): string {
  const segs = parseAnnotationSegments(value, "default");
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
  if (!segs.length) return "";
  return segs
    .map((seg) =>
      seg.color === "default"
        ? esc(seg.text)
        : `<span data-color="${seg.color}" style="color:${ANNOTATION_COLOR_META[seg.color].swatch}">${esc(seg.text)}</span>`,
    )
    .join("");
}

/**
 * Editor de anotação com coloração por trecho aplicada dentro da própria caixa.
 * Não exibe códigos de marcação — o texto já aparece colorido enquanto se edita.
 */
export function AnnotationEditor({ value, onChange, placeholder }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const lastValue = useRef<string>("");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value === lastValue.current) return;
    lastValue.current = value;
    el.innerHTML = toHtml(value);
  }, [value]);

  const emit = () => {
    const el = ref.current;
    if (!el) return;
    const next = serialize(el);
    lastValue.current = next;
    onChange(next);
  };

  const applyColor = (color: AnnotationColor) => {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    if (!el.contains(range.commonAncestorContainer)) return;

    const frag = range.extractContents();
    // Remove cores anteriores dentro do trecho selecionado.
    frag.querySelectorAll("[data-color]").forEach((node) => {
      const parent = node.parentNode;
      if (!parent) return;
      while (node.firstChild) parent.insertBefore(node.firstChild, node);
      parent.removeChild(node);
    });

    let inserted: Node;
    if (color === "default") {
      inserted = frag;
    } else {
      const span = document.createElement("span");
      span.dataset.color = color;
      span.style.color = ANNOTATION_COLOR_META[color].swatch;
      span.appendChild(frag);
      inserted = span;
    }
    const lastNode = inserted.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? inserted.lastChild : inserted;
    range.insertNode(inserted);

    // Mantém a seleção sobre o trecho recém-colorido.
    if (lastNode) {
      const after = document.createRange();
      after.selectNodeContents(lastNode);
      sel.removeAllRanges();
      sel.addRange(after);
    }
    emit();
  };

  return (
    <div className="flex flex-col gap-1">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder ?? ""}
        onInput={emit}
        onBlur={emit}
        className="ann-editor min-h-[2.5rem] w-full whitespace-pre-wrap break-words rounded border border-border/60 bg-background px-2 py-1 text-[12px] leading-snug outline-none focus:border-primary"
      />
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          Colorir seleção
        </span>
        {ANNOTATION_COLOR_ORDER.map((col) => (
          <button
            key={col}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyColor(col)}
            title={
              col === "default"
                ? "Remover cor do trecho selecionado"
                : `Aplicar ${ANNOTATION_COLOR_META[col].label.toLowerCase()} ao trecho selecionado`
            }
            aria-label={`Colorir seleção: ${ANNOTATION_COLOR_META[col].label}`}
            className="h-4 w-4 rounded-full border border-border hover:ring-2 hover:ring-ring"
            style={{ backgroundColor: ANNOTATION_COLOR_META[col].swatch }}
          />
        ))}
      </div>
    </div>
  );
}
