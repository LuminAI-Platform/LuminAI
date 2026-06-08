# LuminAI Developer Setup Guide

Welcome to the LuminAI project! This guide outlines the folder structure and provides the necessary steps for each team to set up their local development environment.

## 📁 Repository Structure Overview

- `core-backend/` - Spring Boot (Java 21) backend application.
- `frontend/` - React (Vite + Tailwind CSS v4) web application.
- `data-engine/` - Python-based data processing and pipelines.
- `infra/` - Infrastructure as Code and deployment configurations.
- `docs/` - Project documentation.
- `docker-compose.yml` - Global services (PostgreSQL, Kafka, etc.) for local development.

---

## 🐳 Step 1: Global Dependencies (All Developers)

Before starting your specific service, make sure you have the foundational data stores running via Docker.

**Prerequisites:**
- [Docker](https://www.docker.com/products/docker-desktop/) installed and running.

**Setup Steps:**
1. Open a terminal at the project root.
2. Start the shared infrastructure:
   ```bash
   docker-compose up -d
   ```
   *(This starts PostgreSQL, Kafka, and any other shared services.)*

---

## ☕ Core Backend Team (`/core-backend`)

The Core Backend is built with **Spring Boot 3.5.x** using **Java 21** and **Gradle**. It uses PostgreSQL for data persistence and Flyway for database migrations.

**Prerequisites:**
- JDK 21 installed.
- (Optional) IntelliJ IDEA or VS Code.

**Setup Steps:**
1. Navigate to the backend directory:
   ```bash
   cd core-backend
   ```
2. Build the project (this will download dependencies and compile):
   ```bash
   ./gradlew build
   ```
3. Run the application:
   ```bash
   ./gradlew bootRun
   ```
*The application should start on `http://localhost:8080`. Flyway will automatically run database migrations on startup if configured.*

---

## ⚛️ Frontend Team (`/frontend`)

The Frontend is a modern **React 19** Single Page Application built with **Vite**, **TypeScript**, and **Tailwind CSS v4**.

**Prerequisites:**
- [Node.js](https://nodejs.org/) (v22 or v24 recommended).
- `npm` (or `yarn`/`pnpm` if preferred).

**Setup Steps:**
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install the required Node modules:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
*The frontend should start on `http://localhost:5173`. Open this URL in your browser.*

---

## 🐍 Data Engineering Team (`/data-engine`)

The Data Engine handles pipelines and data tasks using **Python 3.12+**, featuring `FastAPI`, `DuckDB`, `Polars`, and `Dagster`.

**Prerequisites:**
- Python 3.12 or newer.
- `uv` package manager (recommended) or standard `pip`.

**Setup Steps (using `uv`):**
1. Navigate to the data-engine directory:
   ```bash
   cd data-engine
   ```
2. Create a virtual environment and sync dependencies:
   ```bash
   uv venv
   uv sync
   ```
3. Activate the virtual environment:
   - **macOS/Linux:** `source .venv/bin/activate`
   - **Windows:** `.venv\Scripts\activate`
4. Start the application (assuming FastAPI via Uvicorn):
   ```bash
   uv run uvicorn main:app --reload
   ```

---

## ☁️ Infra & DevOps Team (`/infra`)

This folder contains the Infrastructure as Code (IaC) and deployment manifests.

**Prerequisites:**
- Appropriate cloud CLI tools (AWS CLI, GCP, etc.).
- `terraform` and/or `kubectl`.

*(Detailed deployment workflows will be documented inside `infra/README.md`)*
