package com.luminai.common.tenant;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import javax.sql.DataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Provisions new tenant schemas by cloning {@code tenant_template} → {@code tenant_{slug}}. */
@Service
public class TenantProvisioningService {

  private static final Logger log = LoggerFactory.getLogger(TenantProvisioningService.class);

  private static final String TEMPLATE_SCHEMA = "tenant_template";

  /** Tables to clone, ordered so FK targets exist before dependents. */
  private static final List<String> TEMPLATE_TABLES =
      List.of(
          "ontology_versions",
          "entity_types",
          "relationship_types",
          "entities",
          "relationships",
          "source_records",
          "audit_log",
          "connectors",
          "sync_jobs",
          "schema_mappings",
          "cleaning_rules",
          "pipeline_runs",
          "golden_records",
          "golden_records_source_ids",
          "golden_records_provenance",
          "er_candidates",
          "provenance");

  private final DataSource dataSource;

  public TenantProvisioningService(DataSource dataSource) {
    this.dataSource = dataSource;
  }

  /**
   * Provisions a new tenant schema and registers the tenant.
   *
   * @param name display name for the tenant (e.g. "Acme Corporation")
   * @param slug unique URL-safe identifier (e.g. "acme") — becomes the schema suffix
   * @return the generated tenant UUID
   * @throws TenantProvisioningException if provisioning fails at any step
   */
  @Transactional
  public UUID provisionTenant(String name, String slug) {
    validateSlug(slug);
    String schemaName = TenantContext.SCHEMA_PREFIX + slug;

    log.info("Provisioning tenant: name='{}', slug='{}', schema='{}'", name, slug, schemaName);

    try (Connection conn = dataSource.getConnection()) {
      conn.setAutoCommit(false);

      try {
        createSchema(conn, schemaName);
        cloneTemplateTables(conn, schemaName);
        addForeignKeys(conn, schemaName);
        UUID tenantId = registerTenant(conn, name, slug);

        conn.commit();
        log.info("Tenant provisioned successfully: id={}, schema='{}'", tenantId, schemaName);
        return tenantId;

      } catch (Exception e) {
        conn.rollback();
        throw new TenantProvisioningException(
            "Failed to provision tenant '" + slug + "': " + e.getMessage(), e);
      }
    } catch (TenantProvisioningException e) {
      throw e;
    } catch (SQLException e) {
      throw new TenantProvisioningException("Database connection error during provisioning", e);
    }
  }

  /**
   * Checks whether a tenant schema already exists.
   *
   * @param slug the tenant slug
   * @return true if the schema exists
   */
  public boolean schemaExists(String slug) {
    String schemaName = TenantContext.SCHEMA_PREFIX + slug;
    try (Connection conn = dataSource.getConnection();
        var ps =
            conn.prepareStatement(
                "SELECT 1 FROM information_schema.schemata WHERE schema_name = ?")) {
      ps.setString(1, schemaName);
      try (var rs = ps.executeQuery()) {
        return rs.next();
      }
    } catch (SQLException e) {
      log.error("Failed to check schema existence for '{}'", schemaName, e);
      return false;
    }
  }

  private void createSchema(Connection conn, String schemaName) throws SQLException {
    String sql = String.format("CREATE SCHEMA IF NOT EXISTS %s", sanitize(schemaName));
    try (var stmt = conn.createStatement()) {
      stmt.execute(sql);
    }
    log.debug("Schema created: {}", schemaName);
  }

  private void cloneTemplateTables(Connection conn, String schemaName) throws SQLException {
    for (String table : TEMPLATE_TABLES) {
      String sql =
          String.format(
              "CREATE TABLE IF NOT EXISTS %s.%s (LIKE %s.%s INCLUDING ALL)",
              sanitize(schemaName), sanitize(table), TEMPLATE_SCHEMA, sanitize(table));
      try (var stmt = conn.createStatement()) {
        stmt.execute(sql);
      }
      log.debug("Cloned table: {}.{}", schemaName, table);
    }
  }

  private void addForeignKeys(Connection conn, String schemaName) throws SQLException {
    String safe = sanitize(schemaName);

    String[][] fks = {
      {
        "entity_types",
        "fk_entity_types_ontology",
        "ontology_id",
        "ontology_versions",
        "id",
        "ON DELETE CASCADE"
      },
      {
        "relationship_types",
        "fk_rel_types_source",
        "source_entity_type_id",
        "entity_types",
        "id",
        "ON DELETE CASCADE"
      },
      {
        "relationship_types",
        "fk_rel_types_target",
        "target_entity_type_id",
        "entity_types",
        "id",
        "ON DELETE CASCADE"
      },
      {
        "relationship_types",
        "fk_rel_types_ontology",
        "ontology_id",
        "ontology_versions",
        "id",
        "ON DELETE SET NULL"
      },
      {
        "relationships",
        "fk_relationships_source",
        "source_entity_id",
        "entities",
        "id",
        "ON DELETE CASCADE"
      },
      {
        "relationships",
        "fk_relationships_target",
        "target_entity_id",
        "entities",
        "id",
        "ON DELETE CASCADE"
      },
      {"source_records", "fk_source_records_golden", "golden_id", "entities", "id", ""},
      {
        "sync_jobs",
        "fk_sync_jobs_connector",
        "connector_id",
        "connectors",
        "id",
        "ON DELETE CASCADE"
      },
      {
        "schema_mappings",
        "fk_schema_mappings_connector",
        "connector_id",
        "connectors",
        "id",
        "ON DELETE CASCADE"
      },
      {
        "cleaning_rules",
        "fk_cleaning_rules_connector",
        "connection_id",
        "connectors",
        "id",
        "ON DELETE CASCADE"
      },
      {
        "pipeline_runs",
        "fk_pipeline_runs_connector",
        "connection_id",
        "connectors",
        "id",
        "ON DELETE CASCADE"
      },
      {
        "er_candidates",
        "fk_er_candidates_pipeline_run",
        "pipeline_run_id",
        "pipeline_runs",
        "id",
        "ON DELETE CASCADE"
      },
      {
        "er_candidates",
        "fk_er_candidates_golden_record",
        "golden_record_id",
        "golden_records",
        "id",
        "ON DELETE SET NULL"
      },
      {
        "provenance",
        "fk_provenance_golden_record",
        "golden_record_id",
        "golden_records",
        "id",
        "ON DELETE CASCADE"
      },
      {
        "provenance",
        "fk_provenance_source_connection",
        "source_connection_id",
        "connectors",
        "id",
        "ON DELETE CASCADE"
      },
      {
        "golden_records_source_ids",
        "fk_gr_source_ids_golden",
        "golden_record_id",
        "golden_records",
        "id",
        "ON DELETE CASCADE"
      },
      {
        "golden_records_provenance",
        "fk_gr_provenance_golden",
        "golden_record_id",
        "golden_records",
        "id",
        "ON DELETE CASCADE"
      },
    };

    for (String[] fk : fks) {
      String sql =
          String.format(
              "ALTER TABLE %s.%s ADD CONSTRAINT %s FOREIGN KEY (%s) REFERENCES %s.%s(%s) %s",
              safe, fk[0], fk[1], fk[2], safe, fk[3], fk[4], fk[5]);
      try (var stmt = conn.createStatement()) {
        stmt.execute(sql);
      }
    }
    log.debug("Foreign keys added to schema: {}", schemaName);
  }

  private UUID registerTenant(Connection conn, String name, String slug) throws SQLException {
    UUID tenantId = UUID.randomUUID();
    String sql =
        "INSERT INTO public.tenants (id, name, slug, status) "
            + "VALUES (?::uuid, ?, ?, 'active') "
            + "ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name "
            + "RETURNING id";
    try (var ps = conn.prepareStatement(sql)) {
      ps.setString(1, tenantId.toString());
      ps.setString(2, name);
      ps.setString(3, slug);
      try (var rs = ps.executeQuery()) {
        if (rs.next()) {
          return UUID.fromString(rs.getString("id"));
        }
      }
    }
    return tenantId;
  }

  private void validateSlug(String slug) {
    if (slug == null || !slug.matches("[a-z0-9][a-z0-9_-]{1,48}[a-z0-9]")) {
      throw new IllegalArgumentException(
          "Tenant slug must be 3-50 lowercase alphanumeric characters, underscores, or hyphens: "
              + slug);
    }
    if ("template".equals(slug)) {
      throw new IllegalArgumentException("Cannot use reserved slug 'template'");
    }
  }

  private String sanitize(String identifier) {
    if (identifier == null || !identifier.matches("[a-zA-Z0-9_-]+")) {
      throw new IllegalArgumentException("Invalid SQL identifier: " + identifier);
    }
    return identifier;
  }

  /** Runtime exception indicating a tenant provisioning failure. */
  public static class TenantProvisioningException extends RuntimeException {

    public TenantProvisioningException(String message, Throwable cause) {
      super(message, cause);
    }
  }
}
