import React, { useRef, useState } from "react";
import { Database, Layers, Upload, ArrowRight } from "../../../lib/icons";
import type { DBType } from "../../../features/connections/components/db-connector/dbConnectorTypes";

interface ConnectorTileDef {
  id: DBType;
  name: string;
  abbr: string;
  description: string;
  group: "Databases" | "Warehouses";
}

const SUPPORTED_CONNECTOR_TILES: ConnectorTileDef[] = [
  {
    id: "postgresql",
    name: "PostgreSQL",
    abbr: "PG",
    description: "Transactional relational database",
    group: "Databases",
  },
  {
    id: "mysql",
    name: "MySQL",
    abbr: "MY",
    description: "Open-source relational database",
    group: "Databases",
  },
  {
    id: "sqlserver",
    name: "SQL Server",
    abbr: "MS",
    description: "Microsoft enterprise SQL database",
    group: "Databases",
  },
  {
    id: "snowflake",
    name: "Snowflake",
    abbr: "SF",
    description: "Cloud data warehouse",
    group: "Warehouses",
  },
];

interface DatabaseEmptyStateProps {
  onSelectConnector: (dbType: DBType) => void;
}

export const DatabaseEmptyState: React.FC<DatabaseEmptyStateProps> = ({
  onSelectConnector,
}) => {
  const databases = SUPPORTED_CONNECTOR_TILES.filter(
    (t) => t.group === "Databases",
  );
  const warehouses = SUPPORTED_CONNECTOR_TILES.filter(
    (t) => t.group === "Warehouses",
  );

  const renderGroup = (
    title: string,
    items: ConnectorTileDef[],
    isWarehouse: boolean,
  ) => (
    <div className="space-y-2.5">
      <h4 className="text-xs font-semibold text-text-secondary">{title}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => onSelectConnector(tile.id)}
            className="group text-left p-4 rounded-lg border border-border bg-surface hover:bg-surface-hover hover:border-border-focus transition-colors flex items-center justify-between gap-3 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-primary shrink-0 relative">
                {isWarehouse ? (
                  <Layers className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Database className="w-4 h-4" aria-hidden="true" />
                )}
                <span className="sr-only">{tile.abbr}</span>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text truncate">
                  {tile.name}
                </div>
                <div className="text-xs text-text-secondary truncate">
                  {tile.description}
                </div>
              </div>
            </div>
            <ArrowRight
              className="w-4 h-4 text-text-secondary group-hover:text-text transition-colors shrink-0"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-surface border border-border rounded-lg p-6 sm:p-8 space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-text">
          Choose a database or warehouse to connect
        </h3>
        <p className="text-xs text-text-secondary mt-1">
          Connect a source, map it in Schema Studio, then run a pipeline.
        </p>
      </div>

      {renderGroup("Databases", databases, false)}
      {renderGroup("Warehouses", warehouses, true)}
    </div>
  );
};

interface FilesEmptyStateProps {
  onSelectFile: (file?: File | null) => void;
}

export const FilesEmptyState: React.FC<FilesEmptyStateProps> = ({
  onSelectFile,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      onSelectFile(dropped);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) {
      onSelectFile(picked);
    }
    e.target.value = "";
  };

  return (
    <div className="bg-surface border border-border rounded-lg p-6 sm:p-8 space-y-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload CSV or JSON (up to 500 MB)"
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={`rounded-lg border-2 border-dashed p-10 text-center flex flex-col items-center justify-center transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
          dragActive
            ? "border-primary bg-primary-tint/40"
            : "border-border hover:border-border-focus bg-surface-subtle/40 hover:bg-surface-subtle/70"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.json,.xlsx,.parquet"
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
        />
        <div className="w-12 h-12 rounded-lg bg-surface border border-border flex items-center justify-center text-primary mb-3">
          <Upload className="w-5 h-5" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold text-text">
          Upload CSV or JSON (up to 500 MB)
        </p>
        <p className="text-xs text-text-secondary mt-1">
          Drag and drop a file here, or click to browse your computer.
        </p>
      </div>

      <p className="text-xs text-text-secondary text-center">
        Connect a source, map it in Schema Studio, then run a pipeline.
      </p>
    </div>
  );
};

interface AllSourcesEmptyStateProps {
  onSelectConnector: (dbType: DBType) => void;
  onSelectFile: (file?: File | null) => void;
}

export const AllSourcesEmptyState: React.FC<AllSourcesEmptyStateProps> = ({
  onSelectConnector,
  onSelectFile,
}) => {
  return (
    <div className="space-y-5">
      <DatabaseEmptyState onSelectConnector={onSelectConnector} />
      <FilesEmptyState onSelectFile={onSelectFile} />
    </div>
  );
};
