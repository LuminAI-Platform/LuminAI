// ─── Connections / TableSelector Types ──────────────────────────────────────

export interface SchemaDiscovery {
  schema: string;
  tables: string[];
}

export interface UseTableSelectorOptions {
  discovered: SchemaDiscovery[];
  selectedTables: string[];
  onChange: (selected: string[]) => void;
}

export interface UseTableSelectorResult {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  expandedSchemas: Record<string, boolean>;
  toggleExpand: (schema: string) => void;
  isSelected: (schema: string, table: string) => boolean;
  handleToggleTable: (schema: string, table: string) => void;
  handleToggleSchema: (schema: string, tables: string[]) => void;
  filteredDiscovered: SchemaDiscovery[];
  getSchemaSelectionStatus: (
    schema: string,
    tables: string[],
  ) => { all: boolean; some: boolean; count: number };
}

