import { useState } from "react";
import type { ColumnConfig } from "../DataPreviewTable";
import { showToastNotification } from "../../../../components/ui/ToastProvider";
import {
  type ColumnMappingConfig,
  sanitizeEntityName,
  sanitizePropertyName,
  inferType,
  parseCSV,
  parseJSON,
} from "./fileUploadTypes";
import type { ParsedDataState } from "./fileUploadTypes";

interface MappingConfigOptions {
  ontologyProperties: Record<string, string[]>;
  setOntologyEntityTypes: React.Dispatch<React.SetStateAction<string[]>>;
  setOntologyProperties: React.Dispatch<
    React.SetStateAction<Record<string, string[]>>
  >;
  setStep: (step: 1 | 2 | 3 | 4) => void;
  setFile: (file: File) => void;
  setParsedData: (data: ParsedDataState) => void;
}

export function useMappingConfig({
  ontologyProperties,
  setOntologyEntityTypes,
  setOntologyProperties,
  setStep,
  setFile,
  setParsedData,
}: MappingConfigOptions) {
  const [columnsConfig, setColumnsConfig] = useState<ColumnConfig[]>([]);
  const [mappings, setMappings] = useState<Record<string, ColumnMappingConfig>>(
    {},
  );
  const [primaryTargetEntity, setPrimaryTargetEntity] = useState<string>("");
  const [inferredEntityName, setInferredEntityName] = useState<string>("");
  const [isCreatingCustomEntity, setIsCreatingCustomEntity] = useState(false);
  const [customEntityInput, setCustomEntityInput] = useState("");

  const handleFile = (selectedFile: File) => {
    if (selectedFile.size > 500 * 1024 * 1024) {
      showToastNotification(
        "error",
        "File Too Large",
        "File size exceeds 500 MB limit.",
      );
      return;
    }
    setFile(selectedFile);

    const isZip =
      selectedFile.name.toLowerCase().endsWith(".zip") ||
      selectedFile.type === "application/zip" ||
      selectedFile.type === "application/x-zip-compressed";

    if (isZip) {
      const inferredEntity = sanitizeEntityName(selectedFile.name);
      setInferredEntityName(inferredEntity);
      setPrimaryTargetEntity(inferredEntity);
      setParsedData({
        columns: ["archive_name", "package_type", "status"],
        rows: [
          {
            archive_name: selectedFile.name,
            package_type: "Multi-Table Relational Archive",
            status:
              "Auto-extracted by backend storage engine into discrete entities",
          },
        ],
      });
      const archiveConfigs: ColumnConfig[] = [
        { name: "archive_name", type: "String", active: true },
        { name: "package_type", type: "String", active: true },
        { name: "status", type: "String", active: true },
      ];
      setColumnsConfig(archiveConfigs);
      setMappings({});
      setStep(4);
      return;
    }

    const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;
    const isLarge = selectedFile.size > MAX_PREVIEW_BYTES;
    const isJson = selectedFile.name.toLowerCase().endsWith(".json");
    const previewBlob = isLarge
      ? selectedFile.slice(0, MAX_PREVIEW_BYTES)
      : selectedFile;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const parsed = isJson
          ? parseJSON(text, isLarge)
          : parseCSV(text, isLarge);

        const result =
          isLarge && isJson && parsed.rows.length === 0
            ? {
                columns: ["file_name", "size_mb", "preview_status"],
                rows: [
                  {
                    file_name: selectedFile.name,
                    size_mb: (selectedFile.size / (1024 * 1024)).toFixed(2),
                    preview_status:
                      "Large JSON file (>2 MB) — full parsing will run on the backend during upload.",
                  },
                ],
              }
            : parsed;
        setParsedData(result);
        const configs: ColumnConfig[] = result.columns.map((colName) => ({
          name: colName,
          type: inferType(result.rows.map((r) => r[colName])),
          active: true,
        }));
        const inferredEntity = sanitizeEntityName(selectedFile.name);
        setInferredEntityName(inferredEntity);
        setPrimaryTargetEntity(inferredEntity);

        const inferredProps = configs.map((c) => sanitizePropertyName(c.name));
        setOntologyEntityTypes((prev) => {
          const filtered = prev.filter((t) => t.toLowerCase() !== "csv");
          return filtered.includes(inferredEntity)
            ? filtered
            : [inferredEntity, ...filtered];
        });
        setOntologyProperties((prev) => ({
          ...prev,
          [inferredEntity]: inferredProps,
        }));

        const initialMappings: Record<string, ColumnMappingConfig> = {};
        configs.forEach((cfg) => {
          initialMappings[cfg.name] = {
            targetEntityType: inferredEntity,
            targetProperty: sanitizePropertyName(cfg.name),
            transformation: "NONE",
          };
        });
        setColumnsConfig(configs);
        setMappings(initialMappings);
        setStep(2);
      } catch (err) {
        showToastNotification(
          "error",
          "Parse Failed",
          err instanceof Error ? err.message : "Failed to parse file.",
        );
      }
    };
    reader.readAsText(previewBlob);
  };

  const toggleColumn = (colName: string) =>
    setColumnsConfig((prev) =>
      prev.map((c) => (c.name === colName ? { ...c, active: !c.active } : c)),
    );

  const updateColumnType = (colName: string, type: ColumnConfig["type"]) =>
    setColumnsConfig((prev) =>
      prev.map((c) => (c.name === colName ? { ...c, type } : c)),
    );

  const handlePrimaryEntityChange = (newEntity: string) => {
    if (newEntity === "__CREATE_NEW__") {
      setIsCreatingCustomEntity(true);
      return;
    }
    setPrimaryTargetEntity(newEntity);
    setMappings((prev) => {
      const updated = { ...prev };
      const props = ontologyProperties[newEntity] || [];
      columnsConfig.forEach((col) => {
        const cur = prev[col.name];
        const cleanProp = sanitizePropertyName(col.name);
        updated[col.name] = {
          targetEntityType: newEntity,
          targetProperty: props.includes(cleanProp)
            ? cleanProp
            : props[0] || cleanProp,
          transformation: cur?.transformation || "NONE",
        };
      });
      return updated;
    });
  };

  const handleApplyCustomEntity = () => {
    const sanitized = sanitizeEntityName(customEntityInput);
    if (!sanitized) return;
    setOntologyEntityTypes((prev) =>
      prev.includes(sanitized) ? prev : [sanitized, ...prev],
    );
    setOntologyProperties((prev) => ({
      ...prev,
      [sanitized]: columnsConfig.map((c) => sanitizePropertyName(c.name)),
    }));
    setPrimaryTargetEntity(sanitized);
    setIsCreatingCustomEntity(false);
    setCustomEntityInput("");
    setMappings((prev) => {
      const updated = { ...prev };
      columnsConfig.forEach((col) => {
        const cur = prev[col.name];
        updated[col.name] = {
          targetEntityType: sanitized,
          targetProperty: sanitizePropertyName(col.name),
          transformation: cur?.transformation || "NONE",
        };
      });
      return updated;
    });
  };

  const updateMapping = (
    colName: string,
    key: "targetEntityType" | "targetProperty" | "transformation",
    value: string,
  ) => {
    setMappings((prev) => {
      const current = prev[colName] || {
        targetEntityType: primaryTargetEntity || "Entity",
        targetProperty: sanitizePropertyName(colName),
        transformation: "NONE",
      };
      const updated = { ...current, [key]: value };
      if (key === "targetEntityType") {
        const available = ontologyProperties[value];
        const cleanProp = sanitizePropertyName(colName);
        updated.targetProperty = available?.length
          ? available.includes(cleanProp)
            ? cleanProp
            : available[0]
          : cleanProp;
      }
      return { ...prev, [colName]: updated };
    });
  };

  return {
    columnsConfig,
    mappings,
    primaryTargetEntity,
    inferredEntityName,
    isCreatingCustomEntity,
    setIsCreatingCustomEntity,
    customEntityInput,
    setCustomEntityInput,
    handleFile,
    toggleColumn,
    updateColumnType,
    handlePrimaryEntityChange,
    handleApplyCustomEntity,
    updateMapping,
  };
}
