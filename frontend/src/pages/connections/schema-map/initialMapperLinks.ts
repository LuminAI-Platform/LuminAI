import type {
  SourceColumn,
  OntologyProperty,
  SchemaMapping,
} from "../../../features/connections/components/VisualSchemaMapper";

export function computeInitialMapperLinks(
  sourceData: { table: string; columns: SourceColumn[] },
  ontologyProps: OntologyProperty[],
  rawDbMappings: Array<{
    connectorId?: string;
    name?: string;
    sourceColumn?: string;
    targetEntityType?: string;
    targetProperty?: string;
  }>,
  selectedSource: string,
  activeOntologyKey: string,
): SchemaMapping[] {
  if (
    !sourceData.columns ||
    sourceData.columns.length === 0 ||
    !ontologyProps ||
    ontologyProps.length === 0
  ) {
    return [];
  }

  const cleanConnId = selectedSource.replace(/^conn_/, "").toLowerCase();
  const result: SchemaMapping[] = [];
  const usedSourceCols = new Set<string>();
  const usedOntoProps = new Set<string>();

  for (const raw of rawDbMappings) {
    if (!raw.sourceColumn || !raw.targetProperty) continue;
    const targetEntity = String(raw.targetEntityType ?? "")
      .trim()
      .toLowerCase();
    if (targetEntity && targetEntity !== activeOntologyKey.toLowerCase()) {
      continue;
    }

    const rawConnId = String(raw.connectorId ?? "").toLowerCase();
    const rawName = String(raw.name ?? "").toLowerCase();
    const rawTable = sourceData.table.toLowerCase();
    const isConnectionMatch =
      (rawConnId &&
        (rawConnId === cleanConnId || cleanConnId.includes(rawConnId))) ||
      rawName.includes(rawTable) ||
      rawTable.includes(rawName.split(" - ")[0]);

    if (isConnectionMatch || rawDbMappings.length <= 25) {
      const matchedCol = sourceData.columns.find(
        (c) =>
          c.name.toLowerCase() === raw.sourceColumn!.toLowerCase() ||
          c.id.toLowerCase() === raw.sourceColumn!.toLowerCase(),
      );
      const matchedProp = ontologyProps.find(
        (p) =>
          p.name.toLowerCase() === raw.targetProperty!.toLowerCase() ||
          p.id.toLowerCase() === raw.targetProperty!.toLowerCase(),
      );

      if (matchedCol && matchedProp) {
        if (
          !usedSourceCols.has(matchedCol.id) &&
          !usedOntoProps.has(matchedProp.id)
        ) {
          result.push({
            sourceColumnId: matchedCol.id,
            ontologyPropertyId: matchedProp.id,
          });
          usedSourceCols.add(matchedCol.id);
          usedOntoProps.add(matchedProp.id);
        }
      }
    }
  }

  if (result.length === 0) {
    try {
      const stored =
        localStorage.getItem(
          `lumin_mapping_${selectedSource}_${sourceData.table}`,
        ) ||
        localStorage.getItem(
          `lumin_mapping_${selectedSource}_${activeOntologyKey}`,
        ) ||
        localStorage.getItem(
          `lumin_mapping_${sourceData.table}_${activeOntologyKey}`,
        ) ||
        localStorage.getItem(`lumin_mapping_${sourceData.table}`) ||
        localStorage.getItem("lumin_schema_mapping");
      if (stored) {
        const parsed = JSON.parse(stored);
        const rawItems = Array.isArray(parsed)
          ? parsed
          : Array.isArray(parsed?.mappings)
            ? parsed.mappings
            : [];
        for (const item of rawItems) {
          const srcId = String(item.sourceColumnId ?? item.sourceColumn ?? "");
          const propId = String(
            item.ontologyPropertyId ?? item.targetProperty ?? "",
          );
          const matchedCol = sourceData.columns.find(
            (c) =>
              c.id === srcId || c.name.toLowerCase() === srcId.toLowerCase(),
          );
          const matchedProp = ontologyProps.find(
            (p) =>
              p.id === propId || p.name.toLowerCase() === propId.toLowerCase(),
          );
          if (matchedCol && matchedProp) {
            if (
              !usedSourceCols.has(matchedCol.id) &&
              !usedOntoProps.has(matchedProp.id)
            ) {
              result.push({
                sourceColumnId: matchedCol.id,
                ontologyPropertyId: matchedProp.id,
              });
              usedSourceCols.add(matchedCol.id);
              usedOntoProps.add(matchedProp.id);
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return result;
}
