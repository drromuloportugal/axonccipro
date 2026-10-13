import { useMemo, useRef, useState } from "react";
import { Check, FileText, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Patient } from "@/data/patients";
import { previewPatientDocumentImport } from "@/lib/documentImport";

type Props = {
  patient: Patient;
  onApply: (patient: Patient) => void;
};

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_SCANNED_PDF_PAGES = 8;

const canvasFile = (canvas: HTMLCanvasElement, name: string) =>
  new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Não foi possível preparar esta página para leitura."));
        return;
      }
      resolve(new File([blob], name, { type: "image/png" }));
    }, "image/png");
  });

async function ocrImage(
  file: File,
  onProgress: (message: string) => void,
) {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("por", 1, {
    logger: (event) => {
      if (typeof event.progress === "number") {
        onProgress(`${event.status} ${Math.round(event.progress * 100)}%`);
      }
    },
  });

  try {
    const result = await worker.recognize(file);
    return result.data.text.trim();
  } finally {
    await worker.terminate();
  }
}

async function textFromPdf(
  file: File,
  onProgress: (message: string) => void,
) {
  const pdfjs = await import("pdfjs-dist");
  const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default as string;
  pdfjs.GlobalWorkerOptions.workerSrc = worker;

  const pdfDocument = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const textPages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    onProgress(`Lendo página ${pageNumber} de ${pdfDocument.numPages}…`);
    const page = await pdfDocument.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? String(item.str ?? "") : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) textPages.push(pageText);
  }

  if (textPages.join("\n").trim().length >= 30) return textPages.join("\n\n");

  const scannedPages = Math.min(pdfDocument.numPages, MAX_SCANNED_PDF_PAGES);
  const ocrPages: string[] = [];
  for (let pageNumber = 1; pageNumber <= scannedPages; pageNumber += 1) {
    onProgress(`Reconhecendo página digitalizada ${pageNumber} de ${scannedPages}…`);
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("O navegador não conseguiu preparar o documento para leitura.");
    await page.render({ canvasContext: context, viewport }).promise;
    const pageImage = await canvasFile(canvas, `pagina-${pageNumber}.png`);
    const recognized = await ocrImage(pageImage, onProgress);
    if (recognized) ocrPages.push(recognized);
  }

  if (!ocrPages.length) {
    throw new Error("Não encontrei texto legível no PDF. Tente uma imagem mais nítida.");
  }
  return ocrPages.join("\n\n");
}

export function DocumentClinicalImport({ patient, onApply }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const preview = useMemo(
    () => previewPatientDocumentImport(patient, extractedText),
    [patient, extractedText],
  );

  const importFile = async (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      setError("O arquivo deve ter no máximo 15 MB.");
      return;
    }
    if (!(file.type === "application/pdf" || file.type.startsWith("image/"))) {
      setError("Selecione uma imagem ou um arquivo PDF.");
      return;
    }

    setError(null);
    setApplied(false);
    setFileName(file.name);
    setExtractedText("");
    setProgress(file.type === "application/pdf" ? "Preparando PDF…" : "Preparando imagem…");

    try {
      const text =
        file.type === "application/pdf"
          ? await textFromPdf(file, setProgress)
          : await ocrImage(file, setProgress);

      if (!text.trim()) throw new Error("Não foi possível identificar texto no arquivo.");
      setExtractedText(text.slice(0, 50_000));
      setProgress(null);
    } catch (cause) {
      setProgress(null);
      setError(cause instanceof Error ? cause.message : "Falha ao ler o documento.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clear = () => {
    setFileName(null);
    setExtractedText("");
    setProgress(null);
    setError(null);
    setApplied(false);
  };

  return (
    <section className="rounded-xl border border-primary/25 bg-primary/[0.04] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Importar documento clínico</p>
          <p className="text-[11px] text-muted-foreground">
            Envie imagem ou PDF. O texto é extraído no navegador, revisado e só então aplicado.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf,.pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importFile(file);
          }}
        />
        <Button type="button" size="sm" variant="outline" disabled={Boolean(progress)} onClick={() => inputRef.current?.click()}>
          {progress ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
          {progress ? "Lendo documento" : "Selecionar imagem ou PDF"}
        </Button>
      </div>

      {progress && (
        <p className="mt-2 text-xs text-muted-foreground">{progress}</p>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {fileName && !progress && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-md border bg-background/70 px-2 py-1.5 text-xs">
          <span className="flex min-w-0 items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{fileName}</span>
          </span>
          <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={clear} title="Remover documento">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {extractedText && (
        <>
          <div className="mt-3 rounded-lg border bg-background/80 p-2">
            <p className="text-xs font-semibold">Texto extraído para revisão</p>
            <textarea
              value={extractedText}
              onChange={(event) => {
                setExtractedText(event.target.value.slice(0, 50_000));
                setApplied(false);
              }}
              rows={8}
              className="mt-2 w-full resize-y rounded-md border bg-background p-2 text-xs"
              aria-label="Texto extraído do documento"
            />
          </div>

          <div className="mt-3 rounded-lg border bg-background/80 p-2">
            <p className="text-xs font-semibold">Propostas para revisão</p>
            {preview.suggestions.length ? (
              <ul className="mt-1 space-y-1 text-xs">
                {preview.suggestions.map((suggestion, index) => (
                  <li key={`${suggestion.label}-${index}`}>
                    <b>{suggestion.label}:</b> {suggestion.detail}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">
                Nenhum campo estruturado foi identificado. O texto ainda poderá ser preservado na evolução prévia.
              </p>
            )}
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                size="sm"
                disabled={applied}
                onClick={() => {
                  onApply(preview.patient);
                  setApplied(true);
                }}
              >
                <Check className="mr-1 h-4 w-4" />
                {applied ? "Informações aplicadas" : "Confirmar e aplicar"}
              </Button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
