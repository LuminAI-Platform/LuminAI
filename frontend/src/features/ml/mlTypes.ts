export type MlModelStatus = "CHAMPION" | "CHALLENGER" | "RETIRED" | "CANDIDATE";

export type MlTaskType = "CLASSIFICATION" | "REGRESSION";

export interface TrainModelRequest {
  modelName: string;
  datasetId?: string;
  datasetName?: string;
  datasetVersion?: number;
  targetColumn: string;
  records?: Record<string, unknown>[];
  featureColumns?: string[];
  algorithm?: string;
  taskType?: MlTaskType;
  testSize?: number;
  hyperparameters?: Record<string, unknown>;
}

export interface MlModelDto {
  id: string;
  tenantId: string;
  name: string;
  datasetId?: string;
  datasetVersion?: number;
  algorithm: string;
  taskType: string;
  status: MlModelStatus;
  metrics: Record<string, number>;
  artifactPath?: string;
  hyperparameters?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MlExperiment {
  run_id: string;
  model_id?: string;
  experiment_name: string;
  model_name?: string;
  metrics?: Record<string, number>;
  params?: Record<string, unknown>;
  status?: string;
  created_at?: string;
}

export interface MlTrainOutcome {
  run_id: string;
  model_name: string;
  model_id?: string;
  metrics: Record<string, number>;
  feature_importances?: Array<{ feature: string; importance: number }>;
  status?: string;
}
