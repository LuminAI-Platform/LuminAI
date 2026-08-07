package com.luminai.connection;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * JPA attribute converter that (de)serializes a {@code Map<String, Object>} to/from a JSON text
 * column.
 *
 * <p>Used for loosely-structured, schema-less payloads such as record property snapshots and
 * comparison diffs, where introducing a dedicated relational shape isn't warranted.
 *
 * <p>NOTE: if the project already has an equivalent converter (e.g. {@code JsonbConverter} for a
 * Postgres {@code jsonb} column), prefer that one and delete this class to avoid duplicating
 * conversion logic.
 */
@Converter
public class JsonMapConverter implements AttributeConverter<Map<String, Object>, String> {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};

    @Override
    public String convertToDatabaseColumn(Map<String, Object> attribute) {
        if (attribute == null) {
            return null;
        }
        try {
            return OBJECT_MAPPER.writeValueAsString(attribute);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize map attribute to JSON", e);
        }
    }

    @Override
    public Map<String, Object> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            return OBJECT_MAPPER.readValue(dbData, MAP_TYPE);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to deserialize JSON map attribute", e);
        }
    }
}
