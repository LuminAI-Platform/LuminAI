package com.luminai.connection.repository;

import com.luminai.connection.model.GoldenRecord;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Access to {@link GoldenRecord}. No custom finders needed: the inherited {@code findById}/{@code
 * save} are already tenant-safe under this project's schema-per-tenant multi-tenancy — see
 * {@link ErCandidateRepository} for the same rationale.
 */
public interface GoldenRecordRepository extends JpaRepository<GoldenRecord, UUID> {}
