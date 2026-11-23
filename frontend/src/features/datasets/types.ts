export type DatasetLayer =
  | "RAW"
  | "WORKING"
  | "PREPARED"
  | "CURATED"
  | "ANALYTICAL"
  | "MODEL_READY";

export type ProjectType =
  | "SOURCE"
  | "PREPARATION"
  | "TRANSFORMATION"
  | "SEMANTIC"
  | "ANALYTICS"
  | "DATA_SCIENCE"
  | "WORKFLOW"
  | "DATA_PREP"
  | "TRANSFORM"
  | "OPERATIONAL";

export type DatasetStatus = "ACTIVE" | "ARCHIVED" | "DEPRECATED";

export interface Dataset {
  id: string;
  tenantId: string;
  name: string;
  displayName: string;
  description?: string;
  layer: DatasetLayer;
  projectType: ProjectType;
  storageFormat: string;
  storagePath?: string;
  storageLocation?: string;
  sourceConnectionId?: string;
  currentVersion: number;
  rowCount: number;
  sizeBytes: number;
  byteSize?: number;
  qualityScore?: number | null;
  qualityStatus?: string;
  status: DatasetStatus;
  schemaMetadata?: Record<string, string>;
  profilingSummary?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DatasetVersion {
  id: string;
  datasetId: string;
  versionNumber: number;
  commitMessage: string;
  rowCount: number;
  sizeBytes: number;
  storageUri: string;
  schemaSnapshot?: Record<string, string>;
  profilingSnapshot?: Record<string, unknown>;
  committedBy: string;
  createdAt: string;
}

export interface LineageNode {
  id: string;
  label: string;
  type: string;
  layer?: string;
}

export interface LineageEdge {
  id: string;
  source: string;
  target: string;
  transformationType: string;
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
}

export interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  sqlText: string;
  chartConfig?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SqlColumnInfo {
  name: string;
  dataType: string;
  data_type?: string;
}

export interface SqlQueryResult {
  columns: SqlColumnInfo[];
  rows: Record<string, unknown>[];
  rowCount: number;
  totalCount: number;
  executionTimeMs: number;
  query: string;
}

export interface CleaningStepConfig {
  operation: string;
  targetColumns: string[];
  parameters?: Record<string, unknown>;
}

export interface CleaningRecipePayload {
  datasetId: string;
  recipeName?: string;
  steps: CleaningStepConfig[];
  targetLayer?: DatasetLayer;
}

export interface CleaningExecutionResult {
  status: string;
  datasetId: string;
  datasetName: string;
  layer: DatasetLayer;
  version: number;
  rowsProcessed: number;
  stepsApplied: number;
}

export interface PipelineExecutionPayload {
  pipelineId?: string;
  sourceDatasetId: string;
  steps: Array<{
    stepId: string;
    stepType: string;
    config?: Record<string, unknown>;
  }>;
}

export interface PipelineExecutionResult {
  pipelineRunId: string;
  status: string;
  sourceDatasetId: string;
  targetDatasetId?: string;
  recordsTransformed?: number;
}

export interface EdaReportResult {
  datasetId: string;
  totalRows: number;
  columnCount: number;
  columns?: Record<string, unknown>;
  qualityScore?: number;
  issues?: Array<Record<string, unknown>>;
}

export interface MlTrainOutcome {
  run_id: string;
  model_name: string;
  metrics: Record<string, number>;
  feature_importances?: Array<{ feature: string; importance: number }>;
  status?: string;
}

export interface MlExperiment {
  runId: string;
  modelName: string;
  algorithm: string;
  taskType: "CLASSIFICATION" | "REGRESSION";
  datasetName: string;
  datasetVersion: number;
  metrics: Record<string, number | undefined>;
  featureImportances?: Array<{ feature: string; importance: number }>;
  createdAt: string;
}

export interface MlModelRegistryItem {
  modelId: string;
  name: string;
  version: number;
  status: "CHAMPION" | "CHALLENGER" | "ARCHIVED" | "RETIRED";
  algorithm: string;
  taskType: string;
  description?: string;
  registeredAt: string;
}
