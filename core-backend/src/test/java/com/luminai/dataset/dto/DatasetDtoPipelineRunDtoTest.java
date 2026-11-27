package com.luminai.dataset.dto;

import static org.junit.jupiter.api.Assertions.*;

import com.luminai.connection.dto.PipelineRunDto;
import com.luminai.connection.model.PipelineRun;
import com.luminai.dataset.model.Dataset;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class DatasetDtoPipelineRunDtoTest {

  @Test
  void datasetDtoDoesNotFabricateScoreWhenProfilingSummaryEmpty() {
    Dataset ds = new Dataset();
    ds.setId(UUID.randomUUID());
    ds.setTenantId(UUID.randomUUID());
    ds.setName("raw_events");
    ds.setDisplayName("Raw Events");
    ds.setQualityStatus(Dataset.QualityStatus.VERIFIED);
    ds.setProfilingSummary("{}");

    DatasetDto dto = DatasetDto.fromEntity(ds);
    assertNull(dto.qualityScore(), "Should not invent a synthetic 95.0 score without profiling");
    assertEquals("{}", dto.profilingSummary());
  }

  @Test
  void datasetDtoReadsRealScoreFromProfilingSummary() {
    Dataset ds = new Dataset();
    ds.setId(UUID.randomUUID());
    ds.setTenantId(UUID.randomUUID());
    ds.setName("customers_clean");
    ds.setDisplayName("Customers Clean");
    ds.setProfilingSummary("{\"overallScore\":91.5,\"completeness\":94.0}");

    DatasetDto dto = DatasetDto.fromEntity(ds);
    assertEquals(91.5, dto.qualityScore());
  }

  @Test
  void pipelineRunDtoDoesNotFabricateHalfQuarantinedOrStagesForEmptyRun() {
    PipelineRun run = new PipelineRun(UUID.randomUUID(), "FILE_INGEST");
    run.setId(UUID.randomUUID());
    run.setTenantId(UUID.randomUUID());
    run.setRecordsFailed(5L);
    run.setStartedAt(Instant.now());
    run.setCompletedAt(run.getStartedAt());

    PipelineRunDto dto = PipelineRunDto.fromEntity(run, "Orders CSV", "FILE");
    assertEquals(0L, dto.recordsQuarantined());
    assertEquals(5L, dto.recordsRejected());

    PipelineRun emptyRun = new PipelineRun(UUID.randomUUID(), "FILE_INGEST");
    emptyRun.setId(UUID.randomUUID());
    emptyRun.setTenantId(UUID.randomUUID());
    emptyRun.setStartedAt(Instant.now());
    emptyRun.setCompletedAt(emptyRun.getStartedAt());
    PipelineRunDto emptyDto = PipelineRunDto.fromEntity(emptyRun, "Empty CSV", "FILE");
    assertTrue(emptyDto.stages().isEmpty());
  }

  @Test
  void pipelineRunDtoParsesRealQuarantinedAndStagesFromMetadata() {
    PipelineRun run = new PipelineRun(UUID.randomUUID(), "POSTGRES_SYNC");
    run.setId(UUID.randomUUID());
    run.setTenantId(UUID.randomUUID());
    run.setRecordsInput(100L);
    run.setRecordsOutput(90L);
    run.setRecordsFailed(10L);
    run.setStartedAt(Instant.now().minusSeconds(12));
    run.setCompletedAt(Instant.now());
    run.setMetadata(
        "{\"quarantined\":3,\"rejected\":7,\"stages\":[{\"stage\":\"ingest\",\"label\":\"Ingest\",\"recordsIn\":100,\"recordsOut\":97,\"dropped\":3,\"durationSeconds\":4}]}");

    PipelineRunDto dto = PipelineRunDto.fromEntity(run, "PG", "POSTGRESQL");
    assertEquals(3L, dto.recordsQuarantined());
    assertEquals(7L, dto.recordsRejected());
    assertEquals(1, dto.stages().size());
    assertEquals("ingest", dto.stages().get(0).stage());
    assertEquals("Ingest", dto.stages().get(0).label());
    assertEquals(3L, dto.stages().get(0).dropped());
    assertEquals(4L, dto.stages().get(0).durationSeconds());
  }
}
