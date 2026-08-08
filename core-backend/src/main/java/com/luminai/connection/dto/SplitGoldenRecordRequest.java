package com.luminai.connection.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/**
 * Request body for {@code POST /api/v1/er/golden-records/{id}/split}.
 */
@Schema(description = "Identifies which clustered source record to extract into a new Golden Record")
public record SplitGoldenRecordRequest(
        @NotNull @Schema(description = "Source record to remove from the cluster and re-house separately")
        UUID sourceRecordIdToExtract) {
}
