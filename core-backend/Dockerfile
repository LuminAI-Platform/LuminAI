# ---- Stage 1: Build ----
FROM gradle:8-jdk21 AS build
WORKDIR /app
COPY . .
RUN gradle bootJar --no-daemon

# ---- Stage 2: Run ----
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/build/libs/luminai-core-*.jar app.jar
EXPOSE 8080 10000
ENTRYPOINT ["sh", "-c", "java ${JAVA_OPTS:--XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:TieredStopAtLevel=1 -Djava.security.egd=file:/dev/./urandom} -Dserver.port=${PORT:-8080} -Dserver.address=0.0.0.0 -jar app.jar"]

