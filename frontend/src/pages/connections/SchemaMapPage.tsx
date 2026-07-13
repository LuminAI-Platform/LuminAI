import React, { useState } from "react";
import {
  VisualSchemaMapper,
  type SourceColumn,
  type OntologyProperty,
  type SchemaMappingPayload,
} from "../../features/connections/components/VisualSchemaMapper";

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_SOURCES: Record<string, { table: string; columns: SourceColumn[] }> =
  {
    snowflake_users: {
      table: "SNOWFLAKE.PUBLIC.USERS_GOLD_V2",
      columns: [
        {
          id: "c1",
          name: "user_id",
          dataType: "string",
          sample: "usr_8f2k91",
          nullable: false,
        },
        {
          id: "c2",
          name: "email_address",
          dataType: "string",
          sample: "alice@corp.io",
          nullable: false,
        },
        {
          id: "c3",
          name: "full_name",
          dataType: "string",
          sample: "Alice Mensah",
          nullable: true,
        },
        {
          id: "c4",
          name: "created_at",
          dataType: "timestamp",
          sample: "2024-01-15T08:30:00Z",
          nullable: false,
        },
        {
          id: "c5",
          name: "account_status",
          dataType: "string",
          sample: "active",
          nullable: false,
        },
        {
          id: "c6",
          name: "monthly_spend",
          dataType: "float",
          sample: "1250.00",
          nullable: true,
        },
        {
          id: "c7",
          name: "country_code",
          dataType: "string",
          sample: "GH",
          nullable: true,
        },
        {
          id: "c8",
          name: "is_verified",
          dataType: "boolean",
          sample: "true",
          nullable: false,
        },
        {
          id: "c9",
          name: "plan_tier",
          dataType: "string",
          sample: "enterprise",
          nullable: false,
        },
        {
          id: "c10",
          name: "metadata_json",
          dataType: "json",
          sample: '{"source":"signup"}',
          nullable: true,
        },
      ],
    },
    s3_transactions: {
      table: "S3.lumin-raw/stripe_transactions.parquet",
      columns: [
        {
          id: "t1",
          name: "transaction_id",
          dataType: "string",
          sample: "txn_a7k2p",
          nullable: false,
        },
        {
          id: "t2",
          name: "amount_usd",
          dataType: "float",
          sample: "299.99",
          nullable: false,
        },
        {
          id: "t3",
          name: "currency",
          dataType: "string",
          sample: "USD",
          nullable: false,
        },
        {
          id: "t4",
          name: "initiated_at",
          dataType: "timestamp",
          sample: "2024-06-01T12:00:00Z",
          nullable: false,
        },
        {
          id: "t5",
          name: "customer_ref",
          dataType: "string",
          sample: "usr_8f2k91",
          nullable: false,
        },
        {
          id: "t6",
          name: "status_code",
          dataType: "integer",
          sample: "200",
          nullable: false,
        },
        {
          id: "t7",
          name: "payment_method",
          dataType: "string",
          sample: "card",
          nullable: true,
        },
        {
          id: "t8",
          name: "failure_reason",
          dataType: "string",
          sample: "null",
          nullable: true,
        },
      ],
    },
    kafka_events: {
      table: "KAFKA.clickstream.page_views",
      columns: [
        {
          id: "e1",
          name: "event_id",
          dataType: "string",
          sample: "evt_xk29",
          nullable: false,
        },
        {
          id: "e2",
          name: "session_id",
          dataType: "string",
          sample: "sess_7m1q",
          nullable: false,
        },
        {
          id: "e3",
          name: "user_agent",
          dataType: "string",
          sample: "Mozilla/5.0",
          nullable: true,
        },
        {
          id: "e4",
          name: "page_path",
          dataType: "string",
          sample: "/dashboard",
          nullable: false,
        },
        {
          id: "e5",
          name: "referrer_url",
          dataType: "string",
          sample: "https://google.com",
          nullable: true,
        },
        {
          id: "e6",
          name: "event_time",
          dataType: "timestamp",
          sample: "2024-07-10T09:00:00Z",
          nullable: false,
        },
        {
          id: "e7",
          name: "device_type",
          dataType: "string",
          sample: "desktop",
          nullable: true,
        },
      ],
    },
  };

const MOCK_ONTOLOGIES: Record<string, OntologyProperty[]> = {
  User: [
    {
      id: "p1",
      name: "identifier",
      entityClass: "User",
      expectedType: "xsd:string",
      required: true,
      description: "Unique entity identifier",
    },
    {
      id: "p2",
      name: "emailAddress",
      entityClass: "User",
      expectedType: "xsd:string",
      required: true,
      description: "Primary contact email",
    },
    {
      id: "p3",
      name: "displayName",
      entityClass: "User",
      expectedType: "xsd:string",
      required: false,
      description: "Human-readable full name",
    },
    {
      id: "p4",
      name: "registeredAt",
      entityClass: "User",
      expectedType: "xsd:dateTime",
      required: true,
      description: "Account creation timestamp",
    },
    {
      id: "p5",
      name: "accountState",
      entityClass: "User",
      expectedType: "xsd:string",
      required: false,
      description: "Lifecycle state of account",
    },
    {
      id: "p6",
      name: "lifetimeValue",
      entityClass: "User",
      expectedType: "xsd:decimal",
      required: false,
      description: "Total revenue attributed",
    },
    {
      id: "p7",
      name: "countryISO",
      entityClass: "User",
      expectedType: "xsd:string",
      required: false,
      description: "ISO 3166-1 alpha-2 code",
    },
    {
      id: "p8",
      name: "isEmailVerified",
      entityClass: "User",
      expectedType: "xsd:boolean",
      required: false,
      description: "Verification status flag",
    },
    {
      id: "p9",
      name: "subscriptionTier",
      entityClass: "User",
      expectedType: "xsd:string",
      required: false,
      description: "Commercial plan level",
    },
  ],
  Transaction: [
    {
      id: "q1",
      name: "transactionId",
      entityClass: "Transaction",
      expectedType: "xsd:string",
      required: true,
      description: "Unique payment identifier",
    },
    {
      id: "q2",
      name: "amountDecimal",
      entityClass: "Transaction",
      expectedType: "xsd:decimal",
      required: true,
      description: "Value in base currency",
    },
    {
      id: "q3",
      name: "currencyCode",
      entityClass: "Transaction",
      expectedType: "xsd:string",
      required: true,
      description: "ISO 4217 currency code",
    },
    {
      id: "q4",
      name: "initiatedAt",
      entityClass: "Transaction",
      expectedType: "xsd:dateTime",
      required: true,
      description: "Payment initiation time",
    },
    {
      id: "q5",
      name: "customerRef",
      entityClass: "Transaction",
      expectedType: "xsd:string",
      required: true,
      description: "FK to User.identifier",
    },
    {
      id: "q6",
      name: "httpStatus",
      entityClass: "Transaction",
      expectedType: "xsd:integer",
      required: false,
      description: "Response status code",
    },
    {
      id: "q7",
      name: "paymentInstrument",
      entityClass: "Transaction",
      expectedType: "xsd:string",
      required: false,
      description: "Payment method used",
    },
  ],
  WebEvent: [
    {
      id: "w1",
      name: "eventId",
      entityClass: "WebEvent",
      expectedType: "xsd:string",
      required: true,
      description: "Unique event identifier",
    },
    {
      id: "w2",
      name: "sessionId",
      entityClass: "WebEvent",
      expectedType: "xsd:string",
      required: true,
      description: "Browser session reference",
    },
    {
      id: "w3",
      name: "userAgentString",
      entityClass: "WebEvent",
      expectedType: "xsd:string",
      required: false,
      description: "HTTP User-Agent header",
    },
    {
      id: "w4",
      name: "pagePath",
      entityClass: "WebEvent",
      expectedType: "xsd:string",
      required: true,
      description: "URL path visited",
    },
    {
      id: "w5",
      name: "referrerUrl",
      entityClass: "WebEvent",
      expectedType: "xsd:anyURI",
      required: false,
      description: "Originating page URL",
    },
    {
      id: "w6",
      name: "occurredAt",
      entityClass: "WebEvent",
      expectedType: "xsd:dateTime",
      required: true,
      description: "Event timestamp",
    },
  ],
};

type SourceKey = keyof typeof MOCK_SOURCES;
type OntologyKey = keyof typeof MOCK_ONTOLOGIES;

const SOURCE_LABELS: Record<SourceKey, string> = {
  snowflake_users: "Snowflake · USERS_GOLD_V2",
  s3_transactions: "S3 · stripe_transactions",
  kafka_events: "Kafka · page_views",
};

const ONTOLOGY_LABELS: Record<OntologyKey, string> = {
  User: "User",
  Transaction: "Transaction",
  WebEvent: "WebEvent",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export const SchemaMapPage: React.FC = () => {
  const [selectedSource, setSelectedSource] =
    useState<SourceKey>("snowflake_users");
  const [selectedOntology, setSelectedOntology] = useState<OntologyKey>("User");
  const [savedMappings, setSavedMappings] = useState<SchemaMappingPayload[]>(
    [],
  );
  const [showHistory, setShowHistory] = useState(false);

  const handleSave = (payload: SchemaMappingPayload) => {
    setSavedMappings((prev) => [payload, ...prev.slice(0, 4)]);
  };

  const sourceData = MOCK_SOURCES[selectedSource];
  const ontologyProps = MOCK_ONTOLOGIES[selectedOntology];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between mb-5 flex-shrink-0 select-none">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            Schema Mapping
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Visually connect raw source columns to ontology properties to
            generate mapping configs
          </p>
        </div>
        <button
          id="schema-map-history-toggle"
          onClick={() => setShowHistory((h) => !h)}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 transition-all cursor-pointer"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M12 7v5l4 2" />
          </svg>
          History ({savedMappings.length})
        </button>
      </div>

      {/* ── Source / Target Selectors ── */}
      <div className="grid grid-cols-2 gap-4 mb-4 flex-shrink-0 select-none">
        {/* Source selector */}
        <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">
            Source Table
          </p>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(SOURCE_LABELS) as SourceKey[]).map((key) => (
              <button
                key={key}
                id={`source-select-${key}`}
                onClick={() => setSelectedSource(key)}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-all cursor-pointer ${
                  selectedSource === key
                    ? "bg-blue-600 border-blue-500/40 text-white shadow-lg shadow-blue-500/15"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                }`}
              >
                {SOURCE_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        {/* Ontology selector */}
        <div className="p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">
            Target Ontology Entity
          </p>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(ONTOLOGY_LABELS) as OntologyKey[]).map((key) => (
              <button
                key={key}
                id={`ontology-select-${key}`}
                onClick={() => setSelectedOntology(key)}
                className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg border transition-all cursor-pointer ${
                  selectedOntology === key
                    ? "bg-emerald-600 border-emerald-500/40 text-white shadow-lg shadow-emerald-500/15"
                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700"
                }`}
              >
                {ONTOLOGY_LABELS[key]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mapping History Drawer ── */}
      {showHistory && (
        <div className="mb-4 p-4 bg-zinc-900/60 border border-zinc-800/80 rounded-xl flex-shrink-0">
          <p className="text-xs font-semibold text-zinc-300 mb-3">
            Saved Mapping Configs
          </p>
          {savedMappings.length === 0 ? (
            <p className="text-[11px] text-zinc-600">
              No mappings saved yet. Build a mapping and click Save.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {savedMappings.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-zinc-400">
                      {m.sourceTable.split(".").pop()}
                    </span>
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-zinc-700"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    <span className="font-mono text-emerald-400">
                      {m.targetEntity}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-zinc-600">
                    <span>{m.mappings.length} mappings</span>
                    <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Mapper Canvas ── */}
      <div className="flex-1 min-h-0 bg-zinc-950/80 border border-zinc-800/80 rounded-xl overflow-hidden relative">
        {/* Dot grid bg */}
        <div className="absolute inset-0 bg-grid-dots opacity-60 pointer-events-none" />
        <div className="relative h-full">
          <VisualSchemaMapper
            key={`${selectedSource}-${selectedOntology}`}
            connectionId={selectedSource}
            sourceTable={sourceData.table}
            sourceColumns={sourceData.columns}
            ontologyProperties={ontologyProps}
            onSave={handleSave}
          />
        </div>
      </div>
    </div>
  );
};
