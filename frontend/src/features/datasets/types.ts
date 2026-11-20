export type DatasetLayer =
  | "RAW"
  | "PREPARED"
  | "CURATED"
  | "ANALYTICAL"
  | "MODEL_READY";

export type ProjectType =
  | "SOURCE"
  | "DATA_PREP"
  | "TRANSFORM"
  | "SEMANTIC"
  | "ANALYTICS"
  | "DATA_SCIENCE"
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
  currentVersion: number;
  rowCount: number;
  sizeBytes: number;
  qualityScore: number;
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

export interface MlTrainOutcome {
  run_id: string;
  model_name: string;
  metrics: Record<string, number>;
  feature_importances?: Array<{ feature: string; importance: number }>;
  status?: string;
}

export interface SqlQueryResult {
  columns: SqlColumnInfo[];
  rows: Record<string, unknown>[];
  rowCount: number;
  totalCount: number;
  executionTimeMs: number;
  query: string;
}

export interface MlExperiment {
  runId: string;
  modelName: string;
  algorithm: string;
  taskType: "CLASSIFICATION" | "REGRESSION";
  datasetName: string;
  datasetVersion: number;
  metrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1_score?: number;
    roc_auc?: number;
    r2_score?: number;
    rmse?: number;
    mae?: number;
    mse?: number;
  };
  featureImportances?: Array<{ feature: string; importance: number }>;
  createdAt: string;
}

export interface MlModelRegistryItem {
  modelId: string;
  name: string;
  version: number;
  status: "CHAMPION" | "CHALLENGER" | "ARCHIVED";
  algorithm: string;
  taskType: string;
  description?: string;
  registeredAt: string;
}
