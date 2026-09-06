import { ANNOTATION_COLOR_META, parseAnnotationSegments } from "@/lib/clinical";
import type { AnnotationColor } from "@/data/patients";

interface Props {
  text: string;
  /** Cor base da anotação (aplicada aos trechos sem marcação). */
  base?: AnnotationColor;
  /** Classe de cor usada quando o trecho é "padrão". */
  defaultClass?: string;
}

/** Renderiza uma anotação com cores diferentes por trecho. */
export function AnnotationText({ text, base = "default", defaultClass = "" }: Props) {
  const segments = parseAnnotationSegments(text, base);
  return (
    <>
      {segments.map((seg, i) => (
        <span key={i} className={ANNOTATION_COLOR_META[seg.color].textClass || defaultClass}>
          {seg.text}
        </span>
      ))}
    </>
  );
}
