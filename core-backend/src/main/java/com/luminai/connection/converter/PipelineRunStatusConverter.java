package com.luminai.connection.converter;

import com.luminai.connection.model.PipelineRun;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Case-insensitive JPA converter for {@link PipelineRun.PipelineRunStatus}. Tolerate database
 * values such as 'running', 'RUNNING', 'completed', 'COMPLETED'.
 */
@Converter(autoApply = true)
public class PipelineRunStatusConverter
    implements AttributeConverter<PipelineRun.PipelineRunStatus, String> {

  @Override
  public String convertToDatabaseColumn(PipelineRun.PipelineRunStatus attribute) {
    return attribute != null ? attribute.name() : null;
  }

  @Override
  public PipelineRun.PipelineRunStatus convertToEntityAttribute(String dbData) {
    if (dbData == null || dbData.isBlank()) {
      return PipelineRun.PipelineRunStatus.PENDING;
    }
    try {
      return PipelineRun.PipelineRunStatus.valueOf(dbData.trim().toUpperCase());
    } catch (IllegalArgumentException e) {
      return PipelineRun.PipelineRunStatus.PENDING;
    }
  }
}
