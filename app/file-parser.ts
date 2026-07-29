"use client";

const MAX_FILE_SIZE = 8 * 1024 * 1024;

export type ParsedResumeFile = {
  text: string;
  fileName: string;
  pageCount?: number;
};

function normalizeExtractedText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function parseResumeFile(file: File): Promise<ParsedResumeFile> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("文件超过 8MB，请压缩后重试，或直接粘贴简历文字。");
  }

  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "txt" || file.type === "text/plain") {
    const text = normalizeExtractedText(await file.text());
    if (!text) throw new Error("文件中没有可读取的文字。");
    return { text, fileName: file.name };
  }

  if (extension === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer(),
    });
    const text = normalizeExtractedText(result.value);
    if (!text) throw new Error("DOCX 中没有可读取的文字，请检查文件内容。");
    return { text, fileName: file.name };
  }

  if (extension === "pdf" || file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();

    const pdf = await pdfjs.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    }).promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let currentLine = "";

      for (const item of content.items) {
        if (!("str" in item)) continue;
        currentLine += `${currentLine ? " " : ""}${item.str}`;
        if ("hasEOL" in item && item.hasEOL) {
          lines.push(currentLine);
          currentLine = "";
        }
      }
      if (currentLine) lines.push(currentLine);

      if (lines.length <= 2) {
        const rows = new Map<number, Array<{ x: number; text: string }>>();
        for (const item of content.items) {
          if (!("str" in item) || !("transform" in item)) continue;
          const y = Math.round(item.transform[5] / 3) * 3;
          const row = rows.get(y) ?? [];
          row.push({ x: item.transform[4], text: item.str });
          rows.set(y, row);
        }
        const grouped = [...rows.entries()]
          .sort(([yA], [yB]) => yB - yA)
          .map(([, row]) => row.sort((a, b) => a.x - b.x).map((part) => part.text).join(" "));
        pages.push(grouped.join("\n"));
      } else {
        pages.push(lines.join("\n"));
      }
    }

    const text = normalizeExtractedText(pages.join("\n"));
    if (text.length < 30) {
      throw new Error(
        "这份 PDF 可能是扫描件，暂时无法读取。请上传可复制文字的 PDF、DOCX，或直接粘贴简历内容。",
      );
    }
    return { text, fileName: file.name, pageCount: pdf.numPages };
  }

  throw new Error("暂时只支持 PDF、DOCX 和 TXT 文件。");
}
