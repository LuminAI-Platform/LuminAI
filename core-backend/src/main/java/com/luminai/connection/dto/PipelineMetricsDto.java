package com.luminai.connection.dto;

/** DTO for aggregated pipeline metrics. */
public record PipelineMetricsDto(
    long totalRecordsCleaned,
    long totalEntitiesResolved,
    long activeJobsCount,
    long totalFailedRecords,
    long totalRunsCount) {}
