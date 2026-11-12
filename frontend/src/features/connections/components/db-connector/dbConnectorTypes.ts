export type DBType = "postgresql" | "mysql" | "snowflake" | "sqlserver";

export interface ConnectionCheckStep {
  id: number;
  label: string;
  status: "idle" | "loading" | "success" | "error";
  errorMsg?: string;
}

export const INITIAL_CHECK_STEPS: ConnectionCheckStep[] = [
  { id: 1, label: "Resolving host domain...", status: "idle" },
  { id: 2, label: "Establishing port TCP handshake...", status: "idle" },
  { id: 3, label: "Authenticating credentials...", status: "idle" },
  { id: 4, label: "Discovering database schemas...", status: "idle" },
];
