import React, { useState } from "react";
import { Check, Loader2, ArrowRight } from "../../../lib/icons";
import { apiFetch } from "../../../lib/api";
import { DOMAIN_STARTER_PACKS, type DomainTemplate } from "../domainTemplates";
import { EntityIcon } from "./EntityTypeEditor";

interface AutoGenerateFromTemplateProps {
  selectedTemplate: DomainTemplate;
  setSelectedTemplate: (tpl: DomainTemplate) => void;
  onSuccess: (msg: string) => void;
  onError: (err: string) => void;
  onClose: () => void;
}

export const AutoGenerateFromTemplate: React.FC<
  AutoGenerateFromTemplateProps
> = ({
  selectedTemplate,
  setSelectedTemplate,
  onSuccess,
  onError,
  onClose,
}) => {
  const [importingTemplate, setImportingTemplate] = useState(false);

  const handleImportTemplate = async () => {
    setImportingTemplate(true);
    onError("");
    try {
      let createdEntitiesCount = 0;
      const createdEntityIds: Record<string, string> = {};

      const existingRes = await apiFetch("/api/v1/ontology/entity-types");
      const existingEntities: Array<{ id: string; name: string }> =
        await existingRes.json().catch(() => []);
      for (const e of existingEntities) {
        createdEntityIds[e.name.toLowerCase()] = e.id;
      }

      for (const et of selectedTemplate.entityTypes) {
        if (createdEntityIds[et.name.toLowerCase()]) {
          continue;
        }
        try {
          const res = await apiFetch("/api/v1/ontology/entity-types", {
            method: "POST",
            body: JSON.stringify({
              name: et.name,
              label: et.label,
              color: et.color,
              icon: et.icon,
              description: et.description,
              properties: et.properties.map((p) => ({
                name: p.name,
                type: p.type,
                required: p.required,
                defaultValue: null,
                description: p.description,
              })),
            }),
          });
          if (res.ok) {
            const data = await res.json();
            createdEntityIds[et.name.toLowerCase()] = data.id;
            createdEntitiesCount++;
          }
        } catch {
          // ignore duplicate
        }
      }

      let createdRelsCount = 0;
      if (selectedTemplate.relationships) {
        for (const rel of selectedTemplate.relationships) {
          const srcId = createdEntityIds[rel.sourceEntity.toLowerCase()];
          const tgtId = createdEntityIds[rel.targetEntity.toLowerCase()];
          if (!srcId || !tgtId) continue;

          try {
            const relRes = await apiFetch(
              "/api/v1/ontology/relationship-types",
              {
                method: "POST",
                body: JSON.stringify({
                  name: rel.name,
                  description: rel.description,
                  sourceEntityTypeId: srcId,
                  targetEntityTypeId: tgtId,
                  cardinality: rel.cardinality,
                }),
              },
            );
            if (relRes.ok) {
              createdRelsCount++;
            }
          } catch {
            // ignore duplicate
          }
        }
      }

      onSuccess(
        `Imported ${createdEntitiesCount} entity types and ${createdRelsCount} relationship types from ${selectedTemplate.name}!`,
      );
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "Failed to import domain template",
      );
    } finally {
      setImportingTemplate(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <label className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
          Select Industry Ontology Starter Pack
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {DOMAIN_STARTER_PACKS.map((pack) => (
            <div
              key={pack.id}
              onClick={() => setSelectedTemplate(pack)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 ${
                selectedTemplate.id === pack.id
                  ? "bg-purple-950/20 border-purple-500/50 shadow-lg shadow-purple-950/40"
                  : "bg-zinc-900/50 border-zinc-800/80 hover:border-zinc-700"
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border ${pack.badgeColor}`}
                  >
                    {pack.badge}
                  </span>
                  <h3 className="text-sm font-bold text-zinc-100 mt-2">
                    {pack.name}
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-1 leading-normal">
                    {pack.description}
                  </p>
                </div>
                {selectedTemplate.id === pack.id && (
                  <div className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3" />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2 border-t border-zinc-800/60 text-[10px] text-zinc-400">
                <span>{pack.entityTypes.length} Entity Types</span>
                <span>•</span>
                <span>{pack.relationships?.length ?? 0} Relationships</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Template details preview */}
      <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-xl flex flex-col gap-3">
        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
          Included Domain Model Components
        </span>
        <div className="flex flex-wrap gap-2">
          {selectedTemplate.entityTypes.map((et) => (
            <div
              key={et.name}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700/60 text-xs"
            >
              <EntityIcon iconKey={et.icon} size={13} />
              <span className="font-semibold text-zinc-200">{et.name}</span>
              <span className="text-[10px] text-zinc-500">
                ({et.properties.length} props)
              </span>
            </div>
          ))}
        </div>
        {selectedTemplate.relationships &&
          selectedTemplate.relationships.length > 0 && (
            <div className="mt-2 flex flex-col gap-1.5">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase">
                Directional Relationships:
              </span>
              {selectedTemplate.relationships.map((rel) => (
                <div
                  key={rel.name}
                  className="flex items-center gap-2 text-[11px] text-purple-400 font-mono"
                >
                  <span className="text-zinc-300">{rel.sourceEntity}</span>
                  <ArrowRight className="w-3 h-3 text-purple-400" />
                  <span className="text-zinc-300">{rel.targetEntity}</span>
                  <span className="text-[10px] text-zinc-500">
                    [{rel.name}]
                  </span>
                </div>
              ))}
            </div>
          )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleImportTemplate}
          disabled={importingTemplate}
          className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg shadow-lg shadow-purple-500/20 transition-all cursor-pointer disabled:opacity-50"
        >
          {importingTemplate && (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          )}
          Import {selectedTemplate.name} Model
        </button>
      </div>
    </div>
  );
};
