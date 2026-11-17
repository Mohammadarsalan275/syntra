import path from "node:path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const MAX_EXTRACTED_CHARACTERS = 120_000;

function documentError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function limitText(text) {
  const normalizedText = text.replace(/\u0000/g, "").trim();
  if (!normalizedText) {
    throw documentError("No readable text was found in the document.");
  }

  return normalizedText.length > MAX_EXTRACTED_CHARACTERS
    ? `${normalizedText.slice(0, MAX_EXTRACTED_CHARACTERS)}\n\n[Document text truncated because it exceeds the processing limit.]`
    : normalizedText;
}

export async function extractDocumentText(file) {
  const extension = path.extname(file.originalname).toLowerCase();

  if (extension === ".txt") {
    try {
      return limitText(new TextDecoder("utf-8", { fatal: true }).decode(file.buffer));
    } catch (error) {
      if (error.statusCode) throw error;
      throw documentError("The TXT file must use valid UTF-8 text.");
    }
  }

  if (extension === ".pdf") {
    if (!file.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      throw documentError("The selected file is not a valid PDF.");
    }

    const parser = new PDFParse({ data: file.buffer });
    try {
      const parsed = await parser.getText();
      return limitText(parsed.text);
    } catch (error) {
      if (error.statusCode) throw error;
      throw documentError("Unable to extract text from this PDF. It may be damaged or image-only.");
    } finally {
      await parser.destroy();
    }
  }

  if (extension === ".docx") {
    if (file.buffer[0] !== 0x50 || file.buffer[1] !== 0x4b) {
      throw documentError("The selected file is not a valid DOCX document.");
    }

    try {
      const parsed = await mammoth.extractRawText({ buffer: file.buffer });
      return limitText(parsed.value);
    } catch (error) {
      if (error.statusCode) throw error;
      throw documentError("Unable to extract text from this DOCX document.");
    }
  }

  throw documentError("Only PDF, DOCX, and TXT documents are supported.");
}
