package com.luminai.dataset.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Typed column descriptor returned by the SQL Studio query endpoint.
 *
 * <p>Uses {@code dataType} to match the frontend {@code SqlColumnInfo} contract and includes a
 * convenience alias for snake_case consumers.
 *
 * @param name the column label as reported by {@link java.sql.ResultSetMetaData#getColumnLabel}
 * @param dataType the SQL type name (lower-cased) from {@link
 *     java.sql.ResultSetMetaData#getColumnTypeName}
 */
public record SqlColumnInfo(String name, @JsonProperty("dataType") String dataType) {}
