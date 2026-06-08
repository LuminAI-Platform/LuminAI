🧑‍💻 E1 — Tech Lead / Senior Backend Engineer

## Sprint 0 — Foundation (Weeks 1–2)

> **Role:** Core Backend (Java) — Auth, Ontology, Architecture, Code Review
> **Working Directory:** `core-backend/`
> **Language:** Java 21 + Spring Boot 3.5

---

## 📖 Required Reading (Before You Start)

Read these docs in the `docs/` folder **before writing any code:**

| Doc | What to Focus On |
|---|---|
| `docs/02-architecture.md` | Section 4 (Domain Package Architecture), Section 4.3 (Spring Boot Patterns) |
| `docs/03-data-model.md` | Section 8 (PostgreSQL schema — key tables for Flyway migration) |
| `docs/06-technology-stack.md` | Section 4.1 (Java stack), Section 9 (Java Dev Standards), Section 7 (OpenAPI codegen) |
| `docs/07-security-architecture.md` | Section 2 (Auth), Section 3 (Authorisation), Section 4.4 (Input Security) |

---

## 🚫 Rules — What You Must NOT Do

1. **DO NOT** touch anything inside `frontend/`, `data-engine/`, or `infra/` — those belong to E3, E5, and E4 respectively.
2. **DO NOT** modify `docker-compose.yml` — that is E4's responsibility. If you need a new service, ask E4.
3. **DO NOT** create Kafka producer/consumer code — E2 owns Kafka config and integration.
4. **DO NOT** use `ddl-auto: create` or `update` in Hibernate — all schema changes go through Flyway migrations.
5. **DO NOT** hardcode credentials — use `application-dev.yml` with environment variable placeholders.
6. **DO NOT** push directly to `main` or `develop` — always create a feature branch and open a PR.

---

## ✅ Your Tasks

---

### TASK S0-05: Rename & Restructure Spring Boot Project (5 pts)

**Priority:** 🔴 Do this FIRST — everything else depends on it.
**Depends on:** Nothing — start immediately.
**Branch:** `feature/S0-05-project-restructure`

#### What You're Doing
The current project is a default Spring Initializr scaffold using `com.example.demo`. You need to transform it into the proper `com.luminai` package structure that matches our architecture doc.

#### Step-by-Step

**Step 1 — Update Gradle config files**

File: `core-backend/settings.gradle`
```gradle
rootProject.name = 'luminai-core'
```

File: `core-backend/build.gradle` — make these changes:
```gradle
plugins {
    id 'java'
    id 'org.springframework.boot' version '3.5.0'
    id 'io.spring.dependency-management' version '1.1.7'
}

group = 'com.luminai'
version = '0.1.0-SNAPSHOT'

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

repositories {
    mavenCentral()
}

dependencies {
    // --- Web & Core ---
    implementation 'org.springframework.boot:spring-boot-starter-web'
    implementation 'org.springframework.boot:spring-boot-starter-actuator'
    implementation 'org.springframework.boot:spring-boot-starter-validation'

    // --- Data ---
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    implementation 'org.flywaydb:flyway-core'
    implementation 'org.flywaydb:flyway-database-postgresql'
    runtimeOnly 'org.postgresql:postgresql'

    // --- Security ---
    implementation 'org.springframework.boot:spring-boot-starter-security'
    implementation 'org.springframework.boot:spring-boot-starter-oauth2-resource-server'

    // --- Kafka (E2 will configure, but dep needed) ---
    implementation 'org.springframework.kafka:spring-kafka'

    // --- Redis ---
    implementation 'org.springframework.boot:spring-boot-starter-data-redis'

    // --- WebSocket ---
    implementation 'org.springframework.boot:spring-boot-starter-websocket'

    // --- API Docs ---
    implementation 'org.springdoc:springdoc-openapi-starter-webmvc-ui:2.8.8'

    // --- Object Storage ---
    implementation 'io.minio:minio:8.5.17'

    // --- Testing ---
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
    testImplementation 'org.springframework.security:spring-security-test'
    testRuntimeOnly 'org.junit.platform:junit-platform-launcher'
}

tasks.named('test') {
    useJUnitPlatform()
}
```

> **Note:** Neo4j and OpenSearch starters are NOT added yet — E2 will add those when they work on Graph and Explorer in Sprint 3. Only add what Sprint 0 needs.

**Step 2 — Create new package structure**

Delete the old directory entirely:
```
core-backend/src/main/java/com/example/    ← DELETE THIS WHOLE FOLDER
core-backend/src/test/java/com/example/    ← DELETE THIS WHOLE FOLDER
```

Create the new main application class at:
```
core-backend/src/main/java/com/luminai/LuminAiApplication.java
```

```java
package com.luminai;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class LuminAiApplication {

    public static void main(String[] args) {
        SpringApplication.run(LuminAiApplication.class, args);
    }
}
```

Create the test class at:
```
core-backend/src/test/java/com/luminai/LuminAiApplicationTests.java
```

```java
package com.luminai;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest
class LuminAiApplicationTests {

    @Test
    void contextLoads() {
    }
}
```

**Step 3 — Create the package directory skeleton**

Create these empty directories (with a placeholder `package-info.java` in each):

```
core-backend/src/main/java/com/luminai/
├── config/
├── common/
│   ├── tenant/
│   ├── security/
│   ├── exception/
│   └── audit/
├── auth/
│   ├── model/
│   └── dto/
├── connection/        ← E2's domain, create directory only
├── ontology/
│   ├── model/
│   └── dto/
├── explorer/          ← E2's domain, create directory only
├── graph/             ← E2's domain, create directory only
├── dashboard/
│   ├── model/
│   └── dto/
└── audit/
    ├── model/
    └── dto/
```

**Step 4 — Replace application.properties with application.yml**

Delete: `core-backend/src/main/resources/application.properties`

Create: `core-backend/src/main/resources/application.yml`
```yaml
spring:
  application:
    name: luminai-core
  profiles:
    active: dev

server:
  port: 8080
  shutdown: graceful

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics
  endpoint:
    health:
      show-details: when-authorized

springdoc:
  api-docs:
    path: /v3/api-docs
  swagger-ui:
    path: /swagger-ui.html
```

Create: `core-backend/src/main/resources/application-dev.yml`
```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/luminai_db
    username: luminai_user
    password: luminai_password
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: true
    properties:
      hibernate:
        dialect: org.hibernate.dialect.PostgreSQLDialect
        format_sql: true
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true
  kafka:
    bootstrap-servers: localhost:9092
  data:
    redis:
      host: localhost
      port: 6379
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: http://localhost:8180/realms/luminai

logging:
  level:
    com.luminai: DEBUG
    org.hibernate.SQL: DEBUG
```

**Step 5 — Verify**

Run from `core-backend/`:
```bash
./gradlew clean build -x test
```
This should compile successfully. Tests may fail until Flyway and DB are configured — that's fine at this stage.

#### Acceptance Criteria
- [x] `com.example.demo` package fully removed
- [x] `com.luminai.LuminAiApplication` exists and compiles
- [x] `build.gradle` has correct group, name, and all Sprint 0 dependencies
- [x] `application.yml` + `application-dev.yml` created with correct configs
- [x] `./gradlew clean build -x test` passes

---

### TASK S0-06: Spring Security + Keycloak OIDC Resource Server (8 pts)

**Priority:** 🟠 High — Frontend login depends on this.
**Depends on:** S0-05 (project restructure), S0-01 (E4's Docker Compose with Keycloak)
**Branch:** `feature/S0-06-spring-security-keycloak`

#### What You're Doing
Configure Spring Boot as an OAuth2 Resource Server that validates JWTs issued by Keycloak. The frontend (React) will redirect users to Keycloak for login, get a JWT, and send it with every API request.

#### Files to Create

**File 1:** `core-backend/src/main/java/com/luminai/config/SecurityConfig.java`
```java
package com.luminai.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable()) // Stateless JWT — no CSRF needed
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/actuator/health",
                    "/actuator/info",
                    "/v3/api-docs/**",
                    "/swagger-ui/**",
                    "/swagger-ui.html"
                ).permitAll()
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 ->
                oauth2.jwt(jwt ->
                    jwt.jwtAuthenticationConverter(jwtAuthenticationConverter())
                )
            )
            .headers(headers -> headers
                .contentSecurityPolicy(csp -> csp.policyDirectives(
                    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
                    "img-src 'self' data: blob:; connect-src 'self' http://localhost:* ws://localhost:*; " +
                    "frame-ancestors 'none';"
                ))
                .frameOptions(frame -> frame.deny())
            );

        return http.build();
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setPrincipalClaimName("preferred_username");
        converter.setJwtGrantedAuthoritiesConverter(new KeycloakRoleConverter());
        return converter;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of("http://localhost:5173"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
```

**File 2:** `core-backend/src/main/java/com/luminai/config/KeycloakRoleConverter.java`
```java
package com.luminai.config;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Extracts roles from Keycloak JWT realm_access.roles claim
 * and converts them to Spring Security GrantedAuthority.
 */
public class KeycloakRoleConverter implements Converter<Jwt, Collection<GrantedAuthority>> {

    @Override
    @SuppressWarnings("unchecked")
    public Collection<GrantedAuthority> convert(Jwt jwt) {
        Map<String, Object> realmAccess = jwt.getClaimAsMap("realm_access");
        if (realmAccess == null || !realmAccess.containsKey("roles")) {
            return Collections.emptyList();
        }

        List<String> roles = (List<String>) realmAccess.get("roles");
        return roles.stream()
            .map(role -> new SimpleGrantedAuthority("ROLE_" + role.toUpperCase()))
            .collect(Collectors.toList());
    }
}
```

**File 3:** `core-backend/src/main/java/com/luminai/common/security/JwtClaimsExtractor.java`
```java
package com.luminai.common.security;

import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * Utility to extract claims from the current JWT in the security context.
 */
@Component
public class JwtClaimsExtractor {

    public Optional<Jwt> getCurrentJwt() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof Jwt jwt) {
            return Optional.of(jwt);
        }
        return Optional.empty();
    }

    public String getCurrentUserId() {
        return getCurrentJwt()
            .map(jwt -> jwt.getClaimAsString("sub"))
            .orElseThrow(() -> new IllegalStateException("No authenticated user"));
    }

    public String getCurrentTenantId() {
        return getCurrentJwt()
            .map(jwt -> jwt.getClaimAsString("tenant_id"))
            .orElseThrow(() -> new IllegalStateException("No tenant_id in JWT"));
    }

    public String getCurrentEmail() {
        return getCurrentJwt()
            .map(jwt -> jwt.getClaimAsString("email"))
            .orElse("unknown");
    }
}
```

**File 4:** `core-backend/src/main/java/com/luminai/auth/AuthController.java`
```java
package com.luminai.auth;

import com.luminai.common.security.JwtClaimsExtractor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final JwtClaimsExtractor claimsExtractor;

    public AuthController(JwtClaimsExtractor claimsExtractor) {
        this.claimsExtractor = claimsExtractor;
    }

    @GetMapping("/me")
    public Map<String, Object> getCurrentUser(@AuthenticationPrincipal Jwt jwt) {
        return Map.of(
            "userId", jwt.getClaimAsString("sub"),
            "email", jwt.getClaimAsString("email"),
            "name", jwt.getClaimAsString("preferred_username"),
            "tenantId", jwt.getClaimAsString("tenant_id"),
            "roles", jwt.getClaimAsMap("realm_access")
        );
    }
}
```

#### Acceptance Criteria
- [x] Unauthenticated requests to `/api/v1/**` return `401`
- [x] `/actuator/health` and `/swagger-ui.html` accessible without auth
- [x] Valid Keycloak JWT grants access to `/api/v1/auth/me`
- [x] Roles from JWT are mapped to Spring `ROLE_*` authorities
- [x] CORS allows `http://localhost:5173`

---

### TASK S0-07: Multi-Tenancy Setup (5 pts)

**Depends on:** S0-05
**Branch:** `feature/S0-07-multi-tenancy`

#### Files to Create

All inside `core-backend/src/main/java/com/luminai/common/tenant/`:

**File 1:** `TenantContext.java`
```java
package com.luminai.common.tenant;

/**
 * ThreadLocal holder for the current tenant ID.
 * Set by TenantFilter on each request, read by Hibernate TenantIdentifierResolver.
 */
public final class TenantContext {

    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();

    private TenantContext() {}

    public static String getCurrentTenant() {
        return CURRENT_TENANT.get();
    }

    public static void setCurrentTenant(String tenantId) {
        CURRENT_TENANT.set(tenantId);
    }

    public static void clear() {
        CURRENT_TENANT.remove();
    }
}
```

**File 2:** `TenantFilter.java` — Servlet filter that extracts `tenant_id` from JWT and sets `TenantContext`.

**File 3:** `TenantIdentifierResolver.java` — Implements `CurrentTenantIdentifierResolver`, returns `TenantContext.getCurrentTenant()`.

**File 4:** `core-backend/src/main/java/com/luminai/config/MultiTenancyConfig.java` — Configures Hibernate `multiTenancy = SCHEMA` property.

Add to `application-dev.yml`:
```yaml
spring:
  jpa:
    properties:
      hibernate:
        multiTenancy: SCHEMA
```

#### Acceptance Criteria
- [x] JWT with `tenant_id: "acme"` routes queries to `tenant_acme` schema
- [x] `TenantContext` is cleared after each request (no leakage)
- [x] Missing `tenant_id` in JWT returns `403`

---

### TASK S0-08: Flyway Initial Migration (3 pts)

**Depends on:** S0-05
**Branch:** `feature/S0-08-flyway-migrations`

#### Files to Create

**File:** `core-backend/src/main/resources/db/migration/V1__init_public_schema.sql`

```sql
-- ============================================
-- LuminAI — V1: Public Schema (shared tables)
-- ============================================

-- Tenant registry
CREATE TABLE IF NOT EXISTS tenants (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    slug        VARCHAR(50) UNIQUE NOT NULL,
    status      VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Users (linked to Keycloak)
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keycloak_id     VARCHAR(255) UNIQUE NOT NULL,
    email           VARCHAR(255) NOT NULL,
    full_name       VARCHAR(255),
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    role            VARCHAR(50) NOT NULL DEFAULT 'VIEWER',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_keycloak ON users(keycloak_id);
CREATE INDEX idx_users_email ON users(email);
```

**File:** `core-backend/src/main/resources/db/migration/V2__create_tenant_template_schema.sql`

This creates a template schema with the entity/ontology tables from `docs/03-data-model.md` Section 8. When a new tenant is provisioned, this template is cloned to `tenant_{slug}`.

#### Acceptance Criteria
- [x] `./gradlew bootRun` runs Flyway migrations on startup
- [x] `tenants` and `users` tables exist in `public` schema
- [x] Tenant template schema is ready for cloning

---

### TASK S0-09: Global Exception Handler + Input Validation (2 pts)

**Depends on:** S0-05
**Branch:** `feature/S0-09-exception-handler`

#### Files to Create

All inside `core-backend/src/main/java/com/luminai/common/exception/`:

**`ApiError.java`** — A Java record:
```java
package com.luminai.common.exception;

import java.time.Instant;
import java.util.List;

public record ApiError(
    Instant timestamp,
    int status,
    String error,
    String message,
    String path,
    List<FieldError> fieldErrors
) {
    public record FieldError(String field, String message) {}
}
```

**`ResourceNotFoundException.java`** — extends `RuntimeException`.

**`GlobalExceptionHandler.java`** — `@ControllerAdvice` that catches:
- `MethodArgumentNotValidException` → 400
- `ResourceNotFoundException` → 404
- `AccessDeniedException` → 403
- `Exception` → 500

#### Acceptance Criteria
- [x] Invalid request body returns structured `ApiError` JSON with field-level errors
- [x] All exceptions return consistent JSON structure (never raw stack traces)

---

## 📋 Task Summary

| Task | Points | Branch | Depends On | Estimated Time |
|---|---|---|---|---|
| S0-05: Restructure project | 5 | `feature/S0-05-project-restructure` | Nothing | Day 1 |
| S0-06: Security + Keycloak | 8 | `feature/S0-06-spring-security-keycloak` | S0-05, E4's Docker | Day 2–3 |
| S0-07: Multi-tenancy | 5 | `feature/S0-07-multi-tenancy` | S0-05 | Day 3–4 |
| S0-08: Flyway migrations | 3 | `feature/S0-08-flyway-migrations` | S0-05 | Day 2 |
| S0-09: Exception handler | 2 | `feature/S0-09-exception-handler` | S0-05 | Day 1 |
| **Total** | **23** | | | |

---

## 🔄 Coordination Notes

- **With E4:** You need Keycloak running in Docker before you can test S0-06. Ping E4 to prioritize Docker Compose task.
- **With E2:** Once S0-05 is merged, notify E2 immediately — they need the new package structure to start their work.
- **With E3:** E3 needs your `/api/v1/auth/me` endpoint working before their login flow works end-to-end.
- **Code Reviews:** You are expected to review PRs from E2 before they merge.
