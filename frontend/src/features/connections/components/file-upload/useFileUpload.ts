import { useState, useEffect, useRef } from "react";
import type { ParsedDataState } from "./fileUploadTypes";
import { useOntologyFetcher } from "./useOntologyFetcher";
import { useMappingConfig } from "./useMappingConfig";
import { useIngestionRunner } from "./useIngestionRunner";

export function useFileUpload(onClose: () => void, onSuccess?: () => void) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedDataState>({
    columns: [],
    rows: [],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    ontologyEntityTypes,
    ontologyProperties,
    backendEntityTypes,
    setOntologyEntityTypes,
    setOntologyProperties,
  } = useOntologyFetcher();

  const mapping = useMappingConfig({
    ontologyProperties,
    setOntologyEntityTypes,
    setOntologyProperties,
    setStep,
    setFile,
    setParsedData,
  });

  const ingestion = useIngestionRunner({
    file,
    parsedData,
    columnsConfig: mapping.columnsConfig,
    mappings: mapping.mappings,
    primaryTargetEntity: mapping.primaryTargetEntity,
    backendEntityTypes,
    onSuccess,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) mapping.handleFile(e.dataTransfer.files[0]);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files?.[0]) mapping.handleFile(e.target.files[0]);
  };

  const handleClose = () => {
    if (ingestion.ingestionFinished && onSuccess) onSuccess();
    onClose();
  };

  return {
    step,
    setStep,
    dragActive,
    file,
    parsedData,
    fileInputRef,
    ontologyEntityTypes,
    ontologyProperties,
    // mapping state & handlers
    columnsConfig: mapping.columnsConfig,
    mappings: mapping.mappings,
    primaryTargetEntity: mapping.primaryTargetEntity,
    inferredEntityName: mapping.inferredEntityName,
    isCreatingCustomEntity: mapping.isCreatingCustomEntity,
    setIsCreatingCustomEntity: mapping.setIsCreatingCustomEntity,
    customEntityInput: mapping.customEntityInput,
    setCustomEntityInput: mapping.setCustomEntityInput,
    toggleColumn: mapping.toggleColumn,
    updateColumnType: mapping.updateColumnType,
    handlePrimaryEntityChange: mapping.handlePrimaryEntityChange,
    handleApplyCustomEntity: mapping.handleApplyCustomEntity,
    updateMapping: mapping.updateMapping,
    // ingestion state & handlers
    ingesting: ingestion.ingesting,
    ingestionProgress: ingestion.ingestionProgress,
    ingestionLogs: ingestion.ingestionLogs,
    ingestedCount: ingestion.ingestedCount,
    ingestionFinished: ingestion.ingestionFinished,
    ingestionFailed: ingestion.ingestionFailed,
    errorMessage: ingestion.errorMessage,
    startIngestion: ingestion.startIngestion,
    // drag & drop
    handleDrag,
    handleDrop,
    handleChange,
    handleClose,
  };
}
