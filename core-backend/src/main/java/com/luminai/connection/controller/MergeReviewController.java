package com.luminai.connection.controller;

import com.luminai.connection.dto.MergeReviewDto;
import com.luminai.connection.model.ErCandidate.CandidateStatus;
import com.luminai.connection.service.MergeReviewService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST API for manual entity-resolution merge review.
 *
 * <p>All endpoints require a valid JWT. Tenant isolation is enforced by the service layer — the
 * authenticated tenant can only see and act on its own candidates and Golden Records.
 *
 * <pre>
 * GET  /api/v1/er/candidates                    — List candidates (paged, filter by status)
 * GET  /api/v1/er/candidates/{id}                — Get candidate detail
 * POST /api/v1/er/candidates/{id}/accept         — Accept + merge candidate into its Golden Record
 * POST /api/v1/er/candidates/{id}/reject         — Reject candidate (preserved, not deleted)
 * POST /api/v1/er/golden-records/{id}/split      — Split a source record out of a Golden Record
 * </pre>
 */
@RestController
@RequestMapping("/api/v1/er")
public class MergeReviewController {

    private final MergeReviewService mergeReviewService;

    public MergeReviewController(MergeReviewService mergeReviewService) {
        this.mergeReviewService = mergeReviewService;
    }

    @GetMapping("/candidates")
    public ResponseEntity<Page<MergeReviewDto.CandidateResponse>> listCandidates(
            @RequestParam(required = false) CandidateStatus status, Pageable pageable) {

        return ResponseEntity.ok(mergeReviewService.listCandidates(status, pageable));
    }

    @GetMapping("/candidates/{id}")
    public ResponseEntity<MergeReviewDto.CandidateResponse> getCandidate(@PathVariable UUID id) {
        return ResponseEntity.ok(mergeReviewService.getCandidate(id));
    }

    @PostMapping("/candidates/{id}/accept")
    public ResponseEntity<MergeReviewDto.CandidateResponse> acceptCandidate(@PathVariable UUID id) {
        return ResponseEntity.ok(mergeReviewService.acceptCandidate(id));
    }

    @PostMapping("/candidates/{id}/reject")
    public ResponseEntity<MergeReviewDto.CandidateResponse> rejectCandidate(@PathVariable UUID id) {
        return ResponseEntity.ok(mergeReviewService.rejectCandidate(id));
    }

    @PostMapping("/golden-records/{id}/split")
    public ResponseEntity<MergeReviewDto.SplitResponse> splitGoldenRecord(
            @PathVariable("id") UUID goldenRecordId, @Valid @RequestBody MergeReviewDto.SplitRequest request) {

        MergeReviewDto.SplitResponse response =
                mergeReviewService.splitGoldenRecord(goldenRecordId, request.sourceRecordIdToExtract());
        return ResponseEntity.ok(response);
    }
}