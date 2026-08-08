package com.luminai.connection.repository;

import com.luminai.connection.model.ErCandidate.CandidateStatus;
import com.luminai.connection.model.ErCandidate;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Access to {@link ErCandidate}.
 *
 * <p>No manual tenant filtering: this project's multi-tenancy is schema-based (see
 * {@link com.luminai.common.tenant.TenantContext}) — Hibernate routes every connection to the
 * current tenant's schema before any query runs, so the inherited {@code findById}/{@code
 * findAll} are already tenant-safe. A row-level {@code tenant_id} filter here would be redundant
 * with (and could mask misconfiguration of) that schema-routing layer.
 */
public interface ErCandidateRepository extends JpaRepository<ErCandidate, UUID> {

    Page<ErCandidate> findByStatus(CandidateStatus status, Pageable pageable);
}
