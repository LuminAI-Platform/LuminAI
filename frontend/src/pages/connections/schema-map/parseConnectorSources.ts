import type { SourceColumn } from "../../../features/connections/components/VisualSchemaMapper";

export function parseConnectorSources(
  list: Array<{
    id: string;
    name: string;
    type: string;
    config?: string | Record<string, unknown>;
  }>,
): {
  newSources: Record<string, { table: string; columns: SourceColumn[] }>;
  newLabels: Record<string, string>;
} {
  const newSources: Record<string, { table: string; columns: SourceColumn[] }> =
    {};
  const newLabels: Record<string, string> = {};

  list.forEach((c) => {
    let parsedConfig: Record<string, unknown> = {};
    if (typeof c.config === "string") {
      try {
        parsedConfig = JSON.parse(c.config);
      } catch {
        // ignore
      }
    } else if (c.config && typeof c.config === "object") {
      parsedConfig = c.config as Record<string, unknown>;
    }

    if (Array.isArray(parsedConfig.tables) && parsedConfig.tables.length > 0) {
      parsedConfig.tables.forEach(
        (
          tbl: {
            fileName?: string;
            columns?: string[];
            sampleRows?: Record<string, unknown>[];
          },
          tIdx: number,
        ) => {
          const tblName = tbl.fileName || `table_${tIdx + 1}`;
          const subKey = `conn_${c.id}_${tblName}`;
          newLabels[subKey] = `${c.name} > ${tblName}`;

          const cols: SourceColumn[] = [];
          const colNames = Array.isArray(tbl.columns) ? tbl.columns : [];
          const sampleRow =
            Array.isArray(tbl.sampleRows) && tbl.sampleRows[0]
              ? tbl.sampleRows[0]
              : {};

          colNames.forEach((colName: string, cIdx: number) => {
            const val = sampleRow[colName];
            let dType: SourceColumn["dataType"] = "string";
            if (typeof val === "number") {
              dType = Number.isInteger(val) ? "integer" : "float";
            } else if (typeof val === "boolean") {
              dType = "boolean";
            } else if (typeof val === "string") {
              if (
                !isNaN(Date.parse(val)) &&
                (val.includes("-") || val.includes("/"))
              ) {
                dType = "timestamp";
              }
            }
            cols.push({
              id: `col_${cIdx + 1}`,
              name: colName,
              dataType: dType,
              sample: val !== undefined && val !== null ? String(val) : "—",
              nullable: true,
            });
          });

          if (cols.length === 0) return;
          newSources[subKey] = {
            table: `${c.name}.${tblName}`,
            columns: cols,
          };
        },
      );
      return;
    }

    const key = `conn_${c.id}`;
    newLabels[key] = `${c.name} (${c.type})`;

    const cols: SourceColumn[] = [];
    const colNames = Array.isArray(parsedConfig.columns)
      ? (parsedConfig.columns as string[])
      : [];
    const sampleRow =
      Array.isArray(parsedConfig.sampleRows) && parsedConfig.sampleRows[0]
        ? (parsedConfig.sampleRows[0] as Record<string, unknown>)
        : {};

    colNames.forEach((colName: string, cIdx: number) => {
      const val = sampleRow[colName];
      let dType: SourceColumn["dataType"] = "string";
      if (typeof val === "number") {
        dType = Number.isInteger(val) ? "integer" : "float";
      } else if (typeof val === "boolean") {
        dType = "boolean";
      } else if (typeof val === "string") {
        if (
          !isNaN(Date.parse(val)) &&
          (val.includes("-") || val.includes("/"))
        ) {
          dType = "timestamp";
        }
      }
      cols.push({
        id: `col_${cIdx + 1}`,
        name: colName,
        dataType: dType,
        sample: val !== undefined && val !== null ? String(val) : "—",
        nullable: true,
      });
    });

    newSources[key] = {
      table: `${c.type}.${c.name.replace(/\s+/g, "_").toUpperCase()}`,
      columns: cols,
    };
  });

  return { newSources, newLabels };
}
