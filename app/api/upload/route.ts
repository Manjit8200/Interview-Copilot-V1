import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Please select a resume." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Resume must be between 1 byte and 5 MB." }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    const format = name.endsWith(".pdf") ? "pdf" : name.endsWith(".docx") ? "docx" : name.endsWith(".txt") ? "txt" : null;
    if (!format) {
      return NextResponse.json({ error: "Please upload a PDF, DOCX or TXT file." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let extractedText: string;

    if (format === "pdf") {
      if (!buffer.subarray(0, 5).toString("ascii").startsWith("%PDF-")) {
        return NextResponse.json({ error: "This file does not appear to be a valid PDF." }, { status: 422 });
      }
      // Bypass the pdf-parse package's example-running index entry point.
      // pdf-parse 1.1.1 exposes the parser directly here.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const parsePdf: (data: Buffer) => Promise<{ text: string }> = require("pdf-parse/lib/pdf-parse.js");
      extractedText = (await parsePdf(buffer)).text;
    } else if (format === "docx") {
      const mammoth = await import("mammoth");
      extractedText = (await mammoth.extractRawText({ buffer })).value;
    } else {
      extractedText = buffer.toString("utf8");
    }

    const text = extractedText.replace(/\0/g, "").trim().slice(0, 50000);
    if (text.length < 40) {
      return NextResponse.json({
        error: "Not enough selectable text was found. If your resume is a scanned PDF, export it as a text-based PDF or DOCX."
      }, { status: 422 });
    }

    return NextResponse.json({ fileName: file.name, text });
  } catch (error) {
    console.error("Resume upload parsing failed:", error);
    return NextResponse.json({
      error: "Unable to process this resume. Check the development terminal for the exact error, or try exporting the document again as a DOCX or text-based PDF."
    }, { status: 500 });
  }
}
