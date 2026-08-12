CREATE TABLE pipeline_runs (
                               id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                               tenant_id UUID NOT NULL,
                               connection_id UUID NOT NULL,
                               source VARCHAR(255) NOT NULL,
                               status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
                               records_input BIGINT DEFAULT 0,
                               records_output BIGINT DEFAULT 0,
                               resolved_entities BIGINT DEFAULT 0,
                               created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                               updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pipeline_runs_connection_source ON pipeline_runs(connection_id, source);
CREATE INDEX idx_pipeline_runs_tenant_id ON pipeline_runs(tenant_id);