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
  datasetId?: string;
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
  status?: string;
}

export interface CreateDatasetPayload {
  name: string;
  displayName?: string;
  description?: string;
  layer?: DatasetLayer;
  projectType?: ProjectType;
  sourceConnectionId?: string;
  schemaMetadata?: string;
  storageLocation?: string;
  rowCount?: number;
  byteSize?: number;
}

export interface DatasetPreviewColumn {
  name: string;
  type: string;
}

export interface DatasetPreviewResult {
  datasetId: string;
  datasetName: string;
  columns: DatasetPreviewColumn[];
  rows: Record<string, unknown>[];
  totalRows: number;
  previewCount: number;
}

export interface DataQualityRule {
  id: string;
  datasetId: string;
  ruleName: string;
  dimension: string;
  columnName?: string | null;
  ruleType: string;
  parameters: Record<string, unknown>;
  severity: string;
  status: string;
  lastRunAt?: string | null;
  lastStatus?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQualityRulePayload {
  ruleName: string;
  dimension: string;
  columnName?: string;
  ruleType: string;
  parameters?: Record<string, unknown>;
  severity?: string;
}

export interface RuleEvaluationResult {
  ruleId: string;
  ruleName: string;
  dimension: string;
  columnName?: string | null;
  ruleType: string;
  status: string;
  totalEvaluated: number;
  failedCount: number;
  passRate: number;
  sampleFailures: string[];
}

export interface QualityRuleEvaluationSummary {
  datasetId: string;
  totalRules: number;
  passedRules: number;
  failedRules: number;
  evaluatedAt: string;
  results: RuleEvaluationResult[];
}

export interface CleaningStepConfig {
  operation: string;
  targetColumns: string[];
  column?: string;
  columns?: string[];
  parameters?: Record<string, unknown>;
  description?: string;
}

export interface CleaningRecipePayload {
  sourceDatasetId?: string;
  datasetId?: string;
  datasetName?: string;
  recipeName?: string;
  steps: CleaningStepConfig[];
  targetLayer?: DatasetLayer;
  records?: Record<string, unknown>[];
}

export interface CleaningPreviewPayload {
  sourceDatasetId?: string;
  datasetId?: string;
  step: CleaningStepConfig;
  records?: Record<string, unknown>[];
  preview_limit?: number;
}

export interface CleaningExecutionResult {
  status?: string;
  datasetId?: string;
  dataset_id?: string;
  datasetName?: string;
  dataset_name?: string;
  layer?: DatasetLayer;
  version?: number;
  rowsProcessed?: number;
  total_input_rows?: number;
  total_output_rows?: number;
  stepsApplied?: number;
  audit_log?: Array<Record<string, unknown>>;
  rows?: Array<Record<string, unknown>>;
}

export interface PipelineExecutionPayload {
  pipelineId?: string;
  primaryDatasetId?: string;
  sourceDatasetId: string;
  datasetName?: string;
  secondaryDatasetIds?: Record<string, string>;
  steps: Array<{
    stepId: string;
    stepType: string;
    parameters?: Record<string, unknown>;
    config?: Record<string, unknown>;
    description?: string;
  }>;
}

export interface PipelineExecutionResult {
  pipelineRunId?: string;
  run_id?: string;
  status?: string;
  sourceDatasetId?: string;
  targetDatasetId?: string;
  datasetId?: string;
  dataset_id?: string;
  curated_dataset_name?: string;
  total_output_rows?: number;
  recordsTransformed?: number;
  rows?: Array<Record<string, unknown>>;
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
