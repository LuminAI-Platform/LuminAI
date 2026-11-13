import React from "react";

export const Table: React.FC<React.HTMLAttributes<HTMLTableElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <div className="relative w-full overflow-x-auto scrollbar-thin">
    <table
      className={`w-full caption-bottom text-xs text-left text-text min-w-[640px] sm:min-w-full ${className}`}
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
    className={`bg-surface-subtle text-text-secondary font-semibold border-b border-border ${className}`}
    {...props}
  >
    {children}
  </thead>
);

export const TableBody: React.FC<
  React.HTMLAttributes<HTMLTableSectionElement>
> = ({ children, className = "", ...props }) => (
  <tbody className={`divide-y divide-border ${className}`} {...props}>
    {children}
  </tbody>
);

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <tr
    className={`transition-colors hover:bg-surface-hover data-[state=selected]:bg-surface-hover ${className}`}
    {...props}
  >
    {children}
  </tr>
);

export const TableHead: React.FC<
  React.ThHTMLAttributes<HTMLTableCellElement>
> = ({ children, className = "", ...props }) => (
  <th
    className={`h-10 px-4 text-left align-middle text-text-secondary font-medium select-none ${className}`}
    {...props}
  >
    {children}
  </th>
);

export const TableCell: React.FC<
  React.TdHTMLAttributes<HTMLTableCellElement>
> = ({ children, className = "", ...props }) => (
  <td className={`p-4 align-middle text-text ${className}`} {...props}>
    {children}
  </td>
);
