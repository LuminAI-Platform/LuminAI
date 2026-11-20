-- =====================================================================
-- LuminAI — V1003: Enterprise Data Platform Workspace & Lifecycle Tables
-- =====================================================================
-- Creates core tables for:
--   - datasets & dataset_versions (Raw, Prepared, Curated, Analytical, Model-Ready)
--   - pipeline_definitions (Visual & code-based DAG builder workflows)
--   - data_quality_rules (Boundary assertions & DAMA continuous health checks)
--   - dataset_lineage (End-to-end provenance graphs)
--   - saved_queries (Analyst SQL & EDA queries with visual configs)
--   - ml_models (Data Science experiments, metrics leaderboard, model registry)
-- =====================================================================

DO $$
DECLARE
    schema_rec RECORD;
BEGIN
    FOR schema_rec IN 
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'tenant_%' OR schema_name = 'tenant_template'
    LOOP
        -- 1. Datasets registry
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I.datasets (
                id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id           UUID NOT NULL,
                name                VARCHAR(255) NOT NULL,
                display_name        VARCHAR(255) NOT NULL,
                description         TEXT,
                layer               VARCHAR(50) NOT NULL DEFAULT ''RAW'',
                project_type        VARCHAR(50) NOT NULL DEFAULT ''SOURCE'',
                source_connection_id UUID,
                current_version     INT NOT NULL DEFAULT 1,
                row_count           BIGINT NOT NULL DEFAULT 0,
                byte_size           BIGINT NOT NULL DEFAULT 0,
                storage_location    VARCHAR(1000),
                schema_metadata     JSONB NOT NULL DEFAULT ''[]'',
                profiling_summary   JSONB NOT NULL DEFAULT ''{}'',
                quality_status      VARCHAR(50) NOT NULL DEFAULT ''UNASSESSED'',
                created_by          UUID,
                created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_%s_datasets_tenant ON %I.datasets(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_%s_datasets_layer ON %I.datasets(layer);
            CREATE INDEX IF NOT EXISTS idx_%s_datasets_project ON %I.datasets(project_type);
        ', schema_rec.schema_name, schema_rec.schema_name, schema_rec.schema_name, schema_rec.schema_name, schema_rec.schema_name, schema_rec.schema_name, schema_rec.schema_name);

        -- 2. Dataset Versions
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I.dataset_versions (
                id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id           UUID NOT NULL,
                dataset_id          UUID NOT NULL,
                version             INT NOT NULL,
                storage_location    VARCHAR(1000),
                row_count           BIGINT NOT NULL DEFAULT 0,
                schema_snapshot     JSONB NOT NULL DEFAULT ''[]'',
                profiling_snapshot  JSONB NOT NULL DEFAULT ''{}'',
                commit_message      VARCHAR(500),
                created_by          UUID,
                created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_%s_dataset_versions_ds ON %I.dataset_versions(dataset_id, version);
        ', schema_rec.schema_name, schema_rec.schema_name, schema_rec.schema_name);

        -- 3. Pipeline Definitions (DAG Builder)
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I.pipeline_definitions (
                id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id           UUID NOT NULL,
                name                VARCHAR(255) NOT NULL,
                description         TEXT,
                project_type        VARCHAR(50) NOT NULL DEFAULT ''TRANSFORMATION'',
                dag_definition      JSONB NOT NULL DEFAULT ''{}'',
                status              VARCHAR(50) NOT NULL DEFAULT ''ACTIVE'',
                target_dataset_id   UUID,
                created_by          UUID,
                created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_%s_pipeline_defs_tenant ON %I.pipeline_definitions(tenant_id);
        ', schema_rec.schema_name, schema_rec.schema_name, schema_rec.schema_name);

        -- 4. Continuous Data Quality Rules
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I.data_quality_rules (
                id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id           UUID NOT NULL,
                dataset_id          UUID,
                rule_name           VARCHAR(255) NOT NULL,
                dimension           VARCHAR(50) NOT NULL,
                column_name         VARCHAR(255),
                rule_type           VARCHAR(50) NOT NULL,
                parameters          JSONB NOT NULL DEFAULT ''{}'',
                severity            VARCHAR(20) NOT NULL DEFAULT ''ERROR'',
                status              VARCHAR(20) NOT NULL DEFAULT ''ACTIVE'',
                last_run_at         TIMESTAMPTZ,
                last_status         VARCHAR(20),
                created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_%s_dq_rules_tenant ON %I.data_quality_rules(tenant_id);
            CREATE INDEX IF NOT EXISTS idx_%s_dq_rules_dataset ON %I.data_quality_rules(dataset_id);
        ', schema_rec.schema_name, schema_rec.schema_name, schema_rec.schema_name, schema_rec.schema_name, schema_rec.schema_name);

        -- 5. Dataset Lineage
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I.dataset_lineage (
                id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id           UUID NOT NULL,
                source_dataset_id   UUID NOT NULL,
                target_dataset_id   UUID NOT NULL,
                pipeline_id         UUID,
                transformation_type VARCHAR(50) NOT NULL DEFAULT ''TRANSFORM'',
                column_lineage      JSONB NOT NULL DEFAULT ''[]'',
                created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_%s_lineage_source ON %I.dataset_lineage(source_dataset_id);
            CREATE INDEX IF NOT EXISTS idx_%s_lineage_target ON %I.dataset_lineage(target_dataset_id);
        ', schema_rec.schema_name, schema_rec.schema_name, schema_rec.schema_name, schema_rec.schema_name, schema_rec.schema_name);

        -- 6. Saved Queries (Analyst Workspace)
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I.saved_queries (
                id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id           UUID NOT NULL,
                title               VARCHAR(255) NOT NULL,
                description         TEXT,
                sql_query           TEXT NOT NULL,
                dataset_id          UUID,
                visual_config       JSONB NOT NULL DEFAULT ''{}'',
                created_by          UUID,
                created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_%s_saved_queries_tenant ON %I.saved_queries(tenant_id);
        ', schema_rec.schema_name, schema_rec.schema_name, schema_rec.schema_name);

        -- 7. Machine Learning Models & Registry (Data Science Workspace)
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I.ml_models (
                id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id           UUID NOT NULL,
                name                VARCHAR(255) NOT NULL,
                algorithm           VARCHAR(100) NOT NULL,
                task_type           VARCHAR(50) NOT NULL,
                training_dataset_id UUID,
                dataset_version     INT DEFAULT 1,
                features            JSONB NOT NULL DEFAULT ''[]'',
                target_column       VARCHAR(255),
                hyperparameters     JSONB NOT NULL DEFAULT ''{}'',
                metrics             JSONB NOT NULL DEFAULT ''{}'',
                status              VARCHAR(50) NOT NULL DEFAULT ''CHALLENGER'',
                model_artifact_path VARCHAR(1000),
                created_by          UUID,
                created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_%s_ml_models_tenant ON %I.ml_models(tenant_id);
        ', schema_rec.schema_name, schema_rec.schema_name, schema_rec.schema_name);

    END LOOP;
END $$;
