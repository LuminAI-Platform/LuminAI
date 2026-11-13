import React from "react";
import { Modal } from "../../../components/ui/Modal";
import { type DomainTemplate, DOMAIN_STARTER_PACKS } from "./domainTemplates";
import { Loader2 } from "lucide-react";

interface TemplatePickerProps {
  isOpen: boolean;
  seedingDomain: string | null;
  onClose: () => void;
  onSelectTemplate: (tpl: DomainTemplate) => void;
}

export const TemplatePicker: React.FC<TemplatePickerProps> = ({
  isOpen,
  seedingDomain,
  onClose,
  onSelectTemplate,
}) => {
  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Ready-to-Use Industry Templates"
      description="Select an industry template to automatically create standard entity types and schema fields in your database."
      maxWidth="xl"
    >
      <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {DOMAIN_STARTER_PACKS.map((tpl) => {
            const isInstalling = seedingDomain === tpl.id;
            return (
              <div
                key={tpl.id}
                className="group relative flex flex-col justify-between p-4 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-750 transition-all text-left"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${tpl.badgeColor}`}
                    >
                      {tpl.badge}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {tpl.entityTypes.length} entity types
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-zinc-100 group-hover:text-zinc-50 transition-colors">
                    {tpl.name}
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
                    {tpl.description}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {tpl.entityTypes.map((et) => (
                      <span
                        key={et.name}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: et.color }}
                        />
                        {et.label}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500">
                    {tpl.entityTypes.reduce(
                      (acc, e) => acc + e.properties.length,
                      0,
                    )}{" "}
                    standard fields
                  </span>
                  <button
                    onClick={() => onSelectTemplate(tpl)}
                    disabled={isInstalling || seedingDomain !== null}
                    className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover border border-primary disabled:opacity-40 text-primary-text text-xs font-semibold cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    {isInstalling ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Adding...</span>
                      </>
                    ) : (
                      <span>Use Template</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
