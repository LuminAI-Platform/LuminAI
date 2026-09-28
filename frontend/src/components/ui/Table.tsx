import React from "react";

export const Table: React.FC<React.HTMLAttributes<HTMLTableElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <div className="relative w-full overflow-auto">
    <table
      className={`w-full caption-bottom text-xs text-left text-zinc-300 ${className}`}
      {...props}
    >
      {children}
    </table>
  </div>
);

export const TableHeader: React.FC<
  React.HTMLAttributes<HTMLTableSectionElement>
> = ({ children, className = "", ...props }) => (
  <thead
    className={`bg-zinc-950/60 text-zinc-400 font-semibold border-b border-zinc-800 ${className}`}
    {...props}
  >
    {children}
  </thead>
);

export const TableBody: React.FC<
  React.HTMLAttributes<HTMLTableSectionElement>
> = ({ children, className = "", ...props }) => (
  <tbody className={`divide-y divide-zinc-800/60 ${className}`} {...props}>
    {children}
  </tbody>
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <tr
    className={`transition-colors hover:bg-zinc-800/40 data-[state=selected]:bg-zinc-800 ${className}`}
    {...props}
  >
    {children}
  </tr>
);

export const TableHead: React.FC<
  React.ThHTMLAttributes<HTMLTableCellElement>
> = ({ children, className = "", ...props }) => (
  <th
    className={`h-10 px-4 text-left align-middle text-zinc-400 font-medium select-none ${className}`}
    {...props}
  >
    {children}
  </th>
);

export const TableCell: React.FC<
  React.TdHTMLAttributes<HTMLTableCellElement>
> = ({ children, className = "", ...props }) => (
  <td className={`p-4 align-middle text-zinc-200 ${className}`} {...props}>
    {children}
  </td>
);
