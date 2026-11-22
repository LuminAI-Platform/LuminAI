package com.luminai.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.tags.Tag;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** OpenAPI 3.0 / Swagger documentation configuration for LuminAI Core Platform REST API. */
@Configuration
public class OpenApiConfig {

  @Bean
  public OpenAPI luminAiOpenAPI() {
    return new OpenAPI()
        .info(
            new Info()
                .title("LuminAI Core Platform API")
                .description(
                    "Enterprise Data Platform REST APIs powering Ingestion, Data Understanding, "
                        + "Cleaning, Transformation Pipelines, Machine Learning Studio, and Graph Intelligence.")
                .version("1.0.0")
                .contact(
                    new Contact().name("LuminAI Engineering Team").email("engineering@luminai.io"))
                .license(new License().name("Proprietary").url("https://luminai.io/terms")))
        .tags(
            List.of(
                new Tag()
                    .name("Datasets")
                    .description("Dataset lifecycle, versions, SQL analytics and lineage DAG"),
                new Tag()
                    .name("Machine Learning")
                    .description("Model experiment tracking, registry, and champion governance"),
                new Tag()
                    .name("Graph Intelligence")
                    .description(
                        "Neo4j knowledge graph, multi-class decomposition and neighbourhood queries"),
                new Tag()
                    .name("Connections & Ingestion")
                    .description("File and archive ingestion, connectors, and batch streaming"),
                new Tag()
                    .name("Explorer")
                    .description(
                        "Golden record search, facet aggregations, and provenance history"),
                new Tag().name("Ontology").description("Semantic entity and relation type models"),
                new Tag()
                    .name("Audit")
                    .description("Immutable audit trail logging and compliance telemetry"),
                new Tag()
                    .name("Authentication")
                    .description("Tenant users, API keys, and RBAC administration")))
        .components(
            new Components()
                .addSecuritySchemes(
                    "BearerAuth",
                    new SecurityScheme()
                        .type(SecurityScheme.Type.HTTP)
                        .scheme("bearer")
                        .bearerFormat("JWT")
                        .description("Keycloak JWT Bearer Token"))
                .addSecuritySchemes(
                    "ApiKeyAuth",
                    new SecurityScheme()
                        .type(SecurityScheme.Type.APIKEY)
                        .in(SecurityScheme.In.HEADER)
                        .name("X-API-Key")
                        .description("LuminAI Service API Key")))
        .addSecurityItem(new SecurityRequirement().addList("BearerAuth").addList("ApiKeyAuth"));
  }
}
