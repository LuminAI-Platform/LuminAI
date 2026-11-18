import React from "react";
import {
  type IngestedFile,
  formatRelativeTime,
  getHealthStatusBadge,
} from "./connectionsTypes";
import { FileText, Search, ShieldCheck, Trash2 } from "../../../lib/icons";
import { ActionMenu } from "../../../components/ui/dropdown";

interface FilesTableProps {
  ingestedFiles: IngestedFile[];
  onUploadFile: () => void;
  onOpenRawPreview: (file: IngestedFile) => void;
  onInspectCleanData: (file: IngestedFile) => void;
  onDeleteFile: (file: IngestedFile) => void;
}

export const FilesTable: React.FC<FilesTableProps> = ({
  ingestedFiles,
  onUploadFile,
  onOpenRawPreview,
  onInspectCleanData,
  onDeleteFile,
}) => {
  if (ingestedFiles.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-12 text-center flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-text-secondary mb-3">
          <FileText className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-semibold text-text">
          No ingested flat files
        </h4>
        <p className="text-xs text-text-secondary mt-1 max-w-sm">
          Upload CSV, TSV, or JSON datasets using the ingestion wizard to map
          records directly to your ontology.
        </p>
        <button
          onClick={onUploadFile}
          className="mt-4 px-3.5 py-1.5 bg-primary hover:bg-primary-hover text-primary-text border border-primary rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          Upload Flat File
        </button>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-surface-subtle border-b border-border text-[11px] font-semibold text-text-secondary uppercase tracking-wider">
              <th className="py-3 px-4">Dataset Name</th>
              <th className="py-3 px-4">Size</th>
              <th className="py-3 px-4">Records Loaded</th>
              <th className="py-3 px-4">Ingestion Status</th>
              <th className="py-3 px-4">Created</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {ingestedFiles.map((f) => {
              const statusCfg = getHealthStatusBadge(f.status);
              return (
                <tr
                  key={f.id}
                  className="hover:bg-surface-hover transition-colors group"
                >
                  <td className="py-3 px-4 font-semibold text-text flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-surface-subtle border border-border flex items-center justify-center text-text-secondary shrink-0">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate max-w-[200px]" title={f.name}>
                      {f.name}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-text-secondary font-mono text-[11px]">
                    {f.size}
                  </td>
                  <td className="py-3 px-4 text-text font-mono text-[11px]">
                    {f.recordsCount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusCfg.badgeStyle}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotColor}`}
                      />
                      {f.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-text-secondary text-[11px]">
                    {formatRelativeTime(f.createdAt)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center justify-end">
                      <ActionMenu
                        ariaLabel={`Actions for ${f.name}`}
                        items={[
                          {
                            label: "Inspect Raw",
                            icon: <Search className="w-4 h-4" />,
                            onClick: () => onOpenRawPreview(f),
                          },
                          {
                            label: "Clean Data",
                            icon: (
                              <ShieldCheck className="w-4 h-4 text-success" />
                            ),
                            onClick: () => onInspectCleanData(f),
                          },
                          {
                            label: "Delete File",
                            icon: <Trash2 className="w-4 h-4" />,
                            destructive: true,
                            dividerBefore: true,
                            onClick: () => onDeleteFile(f),
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
