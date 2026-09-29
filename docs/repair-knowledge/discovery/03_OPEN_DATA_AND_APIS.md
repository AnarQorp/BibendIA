# 03. OPEN DATA AND FREE APIS — Technical & Legal Evaluation

This document evaluates **Open Data, Open Source Projects, Public APIs, and Automotive Knowledge Graphs** that allow legal reuse, programmatic API access, or data ingestion for BibendIA.

---

## 1. Open Source Projects & Community APIs

### Open Labor Project (OLP)
- **URL**: `https://github.com/openlaborproject` / `https://openlaborproject.com`
- **TYPE**: Community Crowdsourced / AI-Estimated Technical Dataset with Public REST API
- **DATA PROVIDED**: Labor operation times, torque specifications, fluid fill capacities, DTC codes.
- **IMPORTANT NUANCE & CONFIDENCE CLASSIFICATION**:
  - Open Labor Project uses **AI-generated estimation** and community submissions alongside verified data. OLP explicitly attaches confidence flags to its records:
    - `oem_verified` $\rightarrow$ Admissible in BibendIA as strong technical evidence.
    - `high` $\rightarrow$ Admissible with explicit provenance.
    - `medium` / `estimated` $\rightarrow$ Auxiliary / Advisory only.
  - **BibendIA Hard Rule**: Data flagged as `estimated` or `inferred` by OLP **MUST NEVER** automatically generate a critical repair specification without manual workshop review.
- **API TERMS, LIMITS & CACHING**:
  - *Free Hobbyist API $\neq$ Unrestricted Open Dataset*.
  - **API Rate Limits**: Standard free tier rate-limited per IP/key.
  - **Caching & Replication Policy**: Bulk database scraping of OLP is prohibited by API terms; local caching is permitted only for operational efficiency with mandatory attribution.
- **LICENSE**: Open Data / Community Terms
- **COMMERCIAL_REUSE**: RESTRICTED / ALLOWED WITH ATTRIBUTION AND CONFIDENCE FILTERING
- **BIBENDIA USEFULNESS**: Secondary benchmark for labor hours and torque values, filtered strictly by `confidence >= high`.

---

### Auto Care ACES & PIES Open Schema Specifications
- **URL**: AutoCare Association Standard Specification (`https://github.com/topics/aces-pies`)
- **TYPE**: Industry Data Standard Schema Definitions
- **DATA PROVIDED**: Open XML/JSON data exchange formats for vehicle application (ACES) and product attributes (PIES).
- **LICENSE**: Standard Specifications (Public Schema Definitions)
- **COMMERCIAL_REUSE**: ALLOWED (The schema models are open standards; individual database feeds remain proprietary)
- **BIBENDIA USEFULNESS**: Standardizing `FITMENT` and `PART_ROLE` attribute mapping to align with global automotive data standards.

---

### Open Source Repositories (MIT / CC-BY)
- **Auto Parts DB (`lifeofcapo/car-api`)**: Baseline taxonomy for vehicle makes and top-level part roles (MIT License).
- **Auto-Parts-Catalog (`catamc90`)**: Schema reference for cross-referencing OEM references and vehicle applications (MIT License).

---

## 2. Institutional & Public Government Data

### NHTSA / vPIC API (US Department of Transportation)
- **URL**: `https://api.nhtsa.gov/`
- **TYPE**: Public Government REST API
- **SCOPE & GEOGRAPHY**: **PRIMARILY US-FOCUSED MARKET DATA**.
- **BIBENDIA USAGE**:
  - **NO** a primary source for identifying European / Spanish domestic fleet vehicles.
  - **YES** as a complementary source for global platform VIN decoding (e.g. Ford, VW, PSA models shared globally), standardization of vehicle attributes, and safety recall normalization.
- **LICENSE**: Public Domain (US Federal Government)
- **COMMERCIAL_REUSE**: ALLOWED

---

### data.europa.eu (European Data Portal)
- **URL**: `https://data.europa.eu`
- **TYPE**: Official European Union Open Data Portal
- **DATA PROVIDED**: EC Whole Vehicle Type Approval (ECWVTA), Certificate of Conformity (CoC) engine power, displacement, and Euro emissions data.
- **LICENSE**: CC-BY 4.0 / EU Open Data Directive
- **COMMERCIAL_REUSE**: ALLOWED
- **BIBENDIA USEFULNESS**: Authoritative vehicle taxonomy mapping (Make, Model, Engine Code, kW, Euro Standard).

---

## 3. Open Data Summary Matrix

| Resource | Data Type | Geographical Focus | Confidence / Precision | Commercial License | Integration Risk |
|---|---|---|---|---|---|
| **Open Labor Project** | Labor & Torque Specs | US / Expanding | Mixed (`oem_verified` to `estimated`) | Restricted (Requires Attribution & Confidence Filtering) | Medium (Must filter AI estimates) |
| **data.europa.eu** | Type Approval & Engine Specs | Europe | High (Official CoC) | CC-BY 4.0 | Very Low |
| **NHTSA vPIC API** | VIN Decoding & Recalls | US Primary | High (US Market) | Public Domain | Low (Shared platforms only) |
| **Schema.org Auto** | Vehicle Class Taxonomy | Global | High (W3C Standard) | CC-BY-SA | Very Low |
