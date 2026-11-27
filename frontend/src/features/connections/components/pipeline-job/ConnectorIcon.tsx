import React from "react";
import postgresqlSvg from "simple-icons/icons/postgresql.svg?raw";
import mysqlSvg from "simple-icons/icons/mysql.svg?raw";
import mariadbSvg from "simple-icons/icons/mariadb.svg?raw";
import snowflakeSvg from "simple-icons/icons/snowflake.svg?raw";
import clickhouseSvg from "simple-icons/icons/clickhouse.svg?raw";
import kafkaSvg from "simple-icons/icons/apachekafka.svg?raw";
import mongodbSvg from "simple-icons/icons/mongodb.svg?raw";
import gcsSvg from "simple-icons/icons/googlecloudstorage.svg?raw";
import { ICON_MAP, ICON_SIZES } from "../../../../lib/icons";

interface ConnectorIconProps {
  type: string;
  size?: number;
  className?: string;
}

function extractPath(rawSvg: string): string {
  return rawSvg.match(/d="([^"]+)"/)?.[1] ?? "";
}

const BRAND_PATHS: Record<string, string> = {
  postgresql: extractPath(postgresqlSvg),
  mysql: extractPath(mysqlSvg),
  mariadb: extractPath(mariadbSvg),
  snowflake: extractPath(snowflakeSvg),
  clickhouse: extractPath(clickhouseSvg),
  kafka: extractPath(kafkaSvg),
  mongodb: extractPath(mongodbSvg),
  gcs: extractPath(gcsSvg),
};

function matchBrandPath(rawType: string): string | null {
  const t = rawType.toLowerCase();
  if (t.includes("postgres")) return BRAND_PATHS.postgresql;
  if (t.includes("mysql")) return BRAND_PATHS.mysql;
  if (t.includes("mariadb")) return BRAND_PATHS.mariadb;
  if (t.includes("snowflake")) return BRAND_PATHS.snowflake;
  if (t.includes("clickhouse")) return BRAND_PATHS.clickhouse;
  if (t.includes("kafka") || t.includes("stream")) return BRAND_PATHS.kafka;
  if (t.includes("mongo")) return BRAND_PATHS.mongodb;
  if (t.includes("gcs") || t.includes("google cloud")) return BRAND_PATHS.gcs;
  return null;
}

/**
 * Renders Simple Icons brand marks for supported connectors (PostgreSQL, MySQL,
 * MariaDB, Snowflake, ClickHouse, Kafka, MongoDB, GCS) via individual SVG
 * imports, falling back to FileUp for files and Database for generic DBs.
 */
export const ConnectorIcon: React.FC<ConnectorIconProps> = ({
  type,
  size = ICON_SIZES.inline,
  className = "",
}) => {
  const brandPath = matchBrandPath(type);
  if (brandPath) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <path d={brandPath} />
      </svg>
    );
  }

  const t = type.toLowerCase();
  if (t.includes("file") || t.includes("csv") || t.includes("json")) {
    const FileIcon = ICON_MAP.activity.fileIngestion;
    return <FileIcon size={size} className={className} aria-hidden="true" />;
  }

  const FallbackDbIcon = ICON_MAP.activity.databaseSync;
  return (
    <FallbackDbIcon size={size} className={className} aria-hidden="true" />
  );
};
