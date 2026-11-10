import React from "react";

interface ExplorerResultsBannerProps {
  totalElements: number;
  currentPage: number;
  pageSize: number;
  query?: string;
}

export const ExplorerResultsBanner: React.FC<ExplorerResultsBannerProps> = ({
  totalElements,
  currentPage,
  pageSize,
  query,
}) => {
  return (
    <div className="flex items-center justify-between text-xs text-zinc-500 select-none">
      <span>
        Showing{" "}
        <span className="text-zinc-300 font-semibold">
          {totalElements === 0 ? 0 : currentPage * pageSize + 1}
        </span>
        -
        <span className="text-zinc-300 font-semibold">
          {Math.min((currentPage + 1) * pageSize, totalElements)}
        </span>{" "}
        of <span className="text-zinc-300 font-semibold">{totalElements}</span>{" "}
        entities
      </span>
      {query && (
        <span className="italic text-[10px]">
          Matched in {totalElements} records
        </span>
      )}
    </div>
  );
};
