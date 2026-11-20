export interface DomainTemplateProperty {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface DomainTemplateEntityType {
  name: string;
  label: string;
  color: string;
  icon: string;
  description: string;
  properties: DomainTemplateProperty[];
}

export interface DomainTemplateRelationship {
  name: string;
  label: string;
  sourceEntity: string;
  targetEntity: string;
  cardinality: "ONE_TO_ONE" | "ONE_TO_MANY" | "MANY_TO_ONE" | "MANY_TO_MANY";
  description: string;
}

export interface DomainTemplate {
  id: string;
  domain: string;
  name: string;
  badge: string;
  badgeColor: string;
  description: string;
  entityTypes: DomainTemplateEntityType[];
  relationships?: DomainTemplateRelationship[];
}
