# 08. LICENSE AND REUSE MATRIX — Conservative Legal & IP Compliance

This matrix evaluates the **legal reuse, copyright, database protection, and contractual terms** for all technical information sources analyzed for BibendIA.

---

## 1. Core Legal Framework & Compliance Principles

1. **Sui Generis Database Rights vs. Fact Derivation**:
   - Individual technical facts (e.g. "Engine CLHA uses oil specification VW 507 00") are **not protected** individually by sui generis database rights under EU Directive 96/9/EC.
   - Legitimate web users may extract and utilize insubstantial parts of publicly accessible data under applicable legal frameworks.
2. **Prohibition of Systematic Database Replication**:
   - BibendIA **MUST NEVER** perform repeated, systematic web extraction intended to substantially copy or reconstruct proprietary databases (such as TecDoc, REPXPERT, or OEM parts catalogs).
   - BibendIA **derives technical knowledge rules and maintains explicit provenance links**; BibendIA **does NOT replicate manufacturer databases**.
3. **Contractual Terms & Web Terms of Service**:
   - Web Terms of Service (ToS) and API usage contracts apply. Where API terms restrict commercial bulk scraping or caching, BibendIA adheres strictly to permitted operational limits.
4. **Handling Legal Uncertainty**:
   - Whenever legal reuse permissions or contractual terms cannot be explicitly proven:
     `reuse_status = UNKNOWN`
   - Data flagged with `reuse_status = UNKNOWN` is treated conservatively and stored as external provenance links rather than internal database records.

---

## 2. Source-by-Source Legal Matrix

| Source Name | Free View | Free API | Open Data | Commercial Reuse Permission | Bulk Extraction Allowed | Attribution Required | License Type | Terms URL | Risk Level | Preserved `reuse_status` |
|---|---|---|---|---|---|---|---|---|---|---|
| **SKF Automotive** | YES | NO | NO | RESTRICTED | NO | YES | Proprietary Copyright | `https://vsm.skf.com/terms` | MEDIUM | `ALLOW_FACT_DERIVATION` |
| **Gates TechZone** | YES | NO | NO | RESTRICTED | NO | YES | Proprietary Copyright | `https://www.gates.com/us/en/legal/terms-of-use.html` | MEDIUM | `ALLOW_FACT_DERIVATION` |
| **Continental PIC** | YES | NO | NO | RESTRICTED | NO | YES | Proprietary Copyright | `https://www.continental-engineparts.com/terms` | MEDIUM | `ALLOW_FACT_DERIVATION` |
| **Schaeffler REPXPERT** | PARTIAL | UNKNOWN | NO | RESTRICTED | NO | YES | Proprietary Copyright | `https://www.repxpert.com/en/terms-and-conditions` | HIGH | `UNKNOWN` |
| **febi bilstein PartsFinder** | YES | UNKNOWN | NO | RESTRICTED | NO | YES | Proprietary Copyright | `https://partsfinder.bilsteingroup.com/en/terms` | MEDIUM | `ALLOW_FACT_DERIVATION` |
| **Elring Das Original** | YES | NO | NO | RESTRICTED | NO | YES | Proprietary Copyright | `https://www.elring.com/terms` | MEDIUM | `ALLOW_FACT_DERIVATION` |
| **HELLA Tech World** | YES | NO | NO | RESTRICTED | NO | YES | Proprietary Copyright | `https://www.hella.com/legal` | LOW-MEDIUM | `ALLOW_FACT_DERIVATION` |
| **MANN-FILTER** | YES | NO | NO | RESTRICTED | NO | YES | Proprietary Copyright | `https://catalog.mann-filter.com/terms` | MEDIUM | `ALLOW_FACT_DERIVATION` |
| **7zap** | YES | UNKNOWN | NO | RESTRICTED | NO | YES | Copyrighted OEM Diagrams | `https://7zap.com/en/terms/` | HIGH | `UNKNOWN` |
| **Open Labor Project** | YES | YES (Hobbyist) | NO (Crowdsourced/AI) | RESTRICTED (API Terms & Attribution) | NO (Scraping Banned; Caching Limited) | YES | Custom Community Terms | `https://openlaborproject.com/terms` | MEDIUM (Requires Confidence Filtering) | `ALLOW_FACT_DERIVATION_WITH_ATTRIBUTION` |
| **data.europa.eu** | YES | YES | YES | ALLOWED | YES | YES | CC-BY 4.0 | `https://data.europa.eu/en/legal-notice` | VERY LOW | `OPEN_REUSE_ALLOWED` |
| **NHTSA vPIC API** | YES | YES | YES | ALLOWED | YES | NO | US Public Domain | `https://api.nhtsa.gov/` | VERY LOW (US Market Platform Scope) | `OPEN_REUSE_ALLOWED` |
