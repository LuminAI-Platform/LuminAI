package com.luminai.connection.converter;

import com.luminai.connection.model.SchemaMapping;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Case-insensitive JPA converter for {@link SchemaMapping.Transformation}. Tolerate database values
 * such as 'NONE', 'none', 'UPPERCASE', 'uppercase', 'TRIM', 'trim', 'LOWERCASE', 'DATE_PARSE'.
 * Defaults safely to NONE for null or unrecognized strings.
 */
@Converter(autoApply = true)
public class SchemaMappingTransformationConverter
    implements AttributeConverter<SchemaMapping.Transformation, String> {

  @Override
  public String convertToDatabaseColumn(SchemaMapping.Transformation attribute) {
    return attribute != null ? attribute.name() : SchemaMapping.Transformation.NONE.name();
  }

  @Override
  public SchemaMapping.Transformation convertToEntityAttribute(String dbData) {
    if (dbData == null || dbData.isBlank()) {
      return SchemaMapping.Transformation.NONE;
    }
    try {
      return SchemaMapping.Transformation.valueOf(dbData.trim().toUpperCase());
    } catch (IllegalArgumentException e) {
      return SchemaMapping.Transformation.NONE;
    }
  }
}
