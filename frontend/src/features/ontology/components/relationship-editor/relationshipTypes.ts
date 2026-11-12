export type RelationshipCardinality =
  | "ONE_TO_ONE"
  | "ONE_TO_MANY"
  | "MANY_TO_ONE"
  | "MANY_TO_MANY";

export interface RelationshipType {
  id?: string;
  name: string;
  label: string;
  sourceEntityTypeId: string;
  targetEntityTypeId: string;
  cardinality: RelationshipCardinality;
  description: string;
  directed: boolean;
}

export interface EntityTypeOption {
  id: string;
  name: string;
}

export const CARDINALITY_OPTIONS: {
  value: RelationshipCardinality;
  label: string;
  desc: string;
}[] = [
  {
    value: "ONE_TO_ONE",
    label: "1 : 1",
    desc: "One source relates to one target",
  },
  {
    value: "ONE_TO_MANY",
    label: "1 : N",
    desc: "One source relates to many targets",
  },
  {
    value: "MANY_TO_ONE",
    label: "N : 1",
    desc: "Many sources relate to one target",
  },
  {
    value: "MANY_TO_MANY",
    label: "N : N",
    desc: "Many sources relate to many targets",
  },
];

export const EMPTY_RELATIONSHIP: RelationshipType = {
  name: "",
  label: "",
  sourceEntityTypeId: "",
  targetEntityTypeId: "",
  cardinality: "ONE_TO_MANY",
  description: "",
  directed: true,
};
