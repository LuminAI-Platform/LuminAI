import type { ColumnConfig } from "../DataPreviewTable";

export interface FileUploadWizardProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export interface IngestionLog {
  timestamp: string;
  level: "INFO" | "SUCCESS" | "WARN" | "ERROR";
  message: string;
}

export interface ParsedDataState {
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface ColumnMappingConfig {
  targetEntityType: string;
  targetProperty: string;
  transformation: "NONE" | "UPPERCASE" | "LOWERCASE" | "TRIM" | "DATE_PARSE";
}

export function sanitizeEntityName(rawName: string): string {
  if (!rawName) return "CustomEntity";
  let cleaned = rawName.replace(/\.(csv|tsv|json|xlsx|parquet|zip)$/i, "");
  cleaned = cleaned.split(".").pop() || cleaned;
  cleaned = cleaned.replace(/(_csv|_xlsx|_json)$/i, "");
  cleaned = cleaned.replace(/[^a-zA-Z0-9]/g, " ").trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  let pascal = words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
  if (!/^[a-zA-Z]/.test(pascal)) {
    pascal = "Entity_" + pascal;
  }
  if (pascal.length < 2) {
    pascal = pascal + "_Record";
  }
  return pascal;
}

export function sanitizePropertyName(rawName: string): string {
  if (!rawName) return "field";
  const words = rawName
    .replace(/[^a-zA-Z0-9]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "field";
  let camel = words
    .map((w, i) =>
      i === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join("");
  if (!/^[a-zA-Z]/.test(camel)) {
    camel = "col_" + camel;
  }
  return camel;
}

export function inferPropertyType(colType?: string): string {
  switch (colType?.toLowerCase()) {
    case "integer":
      return "integer";
    case "double":
      return "double";
    case "boolean":
      return "boolean";
    case "timestamp":
      return "date";
    default:
      return "string";
  }
}

export const inferType = (values: unknown[]): ColumnConfig["type"] => {
  const nonNullValues = values.filter((v) => v !== null && v !== "");
  if (nonNullValues.length === 0) return "String";

  const isBoolean = nonNullValues.every((v) =>
    /^(true|false|1|0)$/i.test(String(v)),
  );
  if (isBoolean) return "Boolean";

  const isInteger = nonNullValues.every((v) => /^-?\d+$/.test(String(v)));
  if (isInteger) return "Integer";

  const isDouble = nonNullValues.every(
    (v) => !isNaN(Number(v)) && String(v).includes("."),
  );
  if (isDouble) return "Double";

  const isTimestamp = nonNullValues.every((v) => {
    const s = String(v);
    if (s.length < 8) return false;
    const parsed = Date.parse(s);
    return !isNaN(parsed) && (s.includes("-") || s.includes("/"));
  });
  if (isTimestamp) return "Timestamp";

  return "String";
};

export const parseCSV = (text: string, isSample = false) => {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) return { columns: [], rows: [] };

  const parseLine = (line: string) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map((h) => h.replace(/^["']|["']$/g, ""));

  const dataLines =
    isSample && lines.length > 2 ? lines.slice(1, -1) : lines.slice(1);
  const previewLines = dataLines.slice(0, 200);

  const rows = previewLines.map((line) => {
    const values = parseLine(line);
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      let val = values[index] !== undefined ? values[index] : null;
      if (val !== null) {
        val = val.replace(/^["']|["']$/g, "");
        if (val === "") val = null;
      }
      row[header] = val;
    });
    return row;
  });

  return { columns: headers, rows };
};

export const parseJSON = (text: string) => {
  try {
    const parsed = JSON.parse(text);
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    if (rows.length === 0) return { columns: [], rows: [] };

    const columnsSet = new Set<string>();
    rows.forEach((row) => {
      Object.keys(row).forEach((k) => columnsSet.add(k));
    });
    const columns = Array.from(columnsSet);

    return { columns, rows: rows.slice(0, 200) };
  } catch (e) {
    throw new Error("Invalid JSON structure. Must be an array of objects.", {
      cause: e,
    });
  }
};
