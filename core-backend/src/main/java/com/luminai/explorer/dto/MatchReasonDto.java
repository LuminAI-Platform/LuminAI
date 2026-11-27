package com.luminai.explorer.dto;

/**
 * Structured match reason returned for resolved Explorer entities so the UI renders provenance
 * explanations rather than blank bullets.
 *
 * @param field the matched entity field or attribute name
 * @param rule the resolution rule or strategy applied
 * @param score normalized confidence contribution in [0.0, 1.0]
 * @param detail human-readable explanation of the match
 */
public record MatchReasonDto(String field, String rule, double score, String detail) {}
