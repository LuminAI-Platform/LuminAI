package com.luminai.connection;

import com.luminai.common.exception.ResourceNotFoundException;
import com.luminai.common.security.JwtClaimsExtractor;
import com.luminai.connection.dto.SchemaMappingDto;
import com.luminai.connection.model.SchemaMapping;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Service layer for SchemaMapping CRUD operations.
 *
 * <p>Tenant isolation is enforced on every operation by extracting the
 * tenant ID from the authenticated JWT. A request from Tenant A can
 * never read, update, or delete Tenant B's schema mappings.
 */
@Service
public class SchemaMappingService {

    private static final Logger log = LoggerFactory.getLogger(SchemaMappingService.class);

    private final SchemaMappingRepository repository;
    private final JwtClaimsExtractor claimsExtractor;

    public SchemaMappingService(SchemaMappingRepository repository,
                                JwtClaimsExtractor claimsExtractor) {
        this.repository = repository;
        this.claimsExtractor = claimsExtractor;
    }

    /**
     * Create a new schema mapping for the authenticated tenant.
     */
    @Transactional
    public SchemaMappingDto.Response create(SchemaMappingDto.CreateRequest request) {
        UUID tenantId = getCurrentTenantId();

        SchemaMapping mapping = new SchemaMapping(
            tenantId,
            request.connectorId(),
            request.name(),
            request.sourceColumn(),
            request.targetEntityType(),
            request.targetProperty(),
            request.transformation()
        );

        SchemaMapping saved = repository.save(mapping);
        log.info("Created schema mapping '{}' (id={}) for tenant {}",
                saved.getName(), saved.getId(), tenantId);

        return SchemaMappingDto.Response.from(saved);
    }

    /**
     * Get a schema mapping by ID, scoped to the authenticated tenant.
     *
     * @throws ResourceNotFoundException if not found or belongs to another tenant
     */
    @Transactional(readOnly = true)
    public SchemaMappingDto.Response getById(UUID id) {
        UUID tenantId = getCurrentTenantId();

        SchemaMapping mapping = repository.findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("SchemaMapping", id));

        return SchemaMappingDto.Response.from(mapping);
    }

    /**
     * Get all schema mappings for the authenticated tenant.
     */
    @Transactional(readOnly = true)
    public List<SchemaMappingDto.Response> getAllForTenant() {
        UUID tenantId = getCurrentTenantId();

        return repository.findAllByTenantId(tenantId)
            .stream()
            .map(SchemaMappingDto.Response::from)
            .toList();
    }

    /**
     * Get all schema mappings for a specific connector, scoped to the authenticated tenant.
     */
    @Transactional(readOnly = true)
    public List<SchemaMappingDto.Response> getAllForConnector(UUID connectorId) {
        UUID tenantId = getCurrentTenantId();

        return repository.findAllByConnectorIdAndTenantId(connectorId, tenantId)
            .stream()
            .map(SchemaMappingDto.Response::from)
            .toList();
    }

    /**
     * Update an existing schema mapping. Only non-null fields in the
     * request are applied (partial update).
     *
     * @throws ResourceNotFoundException if not found or belongs to another tenant
     */
    @Transactional
    public SchemaMappingDto.Response update(UUID id, SchemaMappingDto.UpdateRequest request) {
        UUID tenantId = getCurrentTenantId();

        SchemaMapping mapping = repository.findByIdAndTenantId(id, tenantId)
            .orElseThrow(() -> new ResourceNotFoundException("SchemaMapping", id));

        // Apply partial updates — only overwrite if the field was provided
        if (request.name() != null) {
            mapping.setName(request.name());
        }
        if (request.sourceColumn() != null) {
            mapping.setSourceColumn(request.sourceColumn());
        }
        if (request.targetEntityType() != null) {
            mapping.setTargetEntityType(request.targetEntityType());
        }
        if (request.targetProperty() != null) {
            mapping.setTargetProperty(request.targetProperty());
        }
        if (request.transformation() != null) {
            mapping.setTransformation(request.transformation());
        }
        if (request.active() != null) {
            mapping.setActive(request.active());
        }

        SchemaMapping updated = repository.save(mapping);
        log.info("Updated schema mapping '{}' (id={}) for tenant {}",
                updated.getName(), updated.getId(), tenantId);

        return SchemaMappingDto.Response.from(updated);
    }

    /**
     * Delete a schema mapping by ID, scoped to the authenticated tenant.
     *
     * @throws ResourceNotFoundException if not found or belongs to another tenant
     */
    @Transactional
    public void delete(UUID id) {
        UUID tenantId = getCurrentTenantId();

        long deleted = repository.deleteByIdAndTenantId(id, tenantId);
        if (deleted == 0) {
            throw new ResourceNotFoundException("SchemaMapping", id);
        }
        log.info("Deleted schema mapping (id={}) for tenant {}", id, tenantId);
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------

    private UUID getCurrentTenantId() {
        return UUID.fromString(claimsExtractor.getCurrentTenantId());
    }
}
