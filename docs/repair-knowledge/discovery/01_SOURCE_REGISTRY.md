# 01. SOURCE REGISTRY — Technical Inventory & Analysis

This document registers and evaluates technical information sources for building the **BibendIA Technical Repair Knowledge Base**.

---

## Priority Tier Classification
- **P1 (Direct Repair Knowledge)**: Sourced repair manuals, procedure BOMs, technical rules, consumable specs.
- **P2 (Manufacturer Repair Kits)**: Kit BOMs, part role mappings, kit-level vehicle application.
- **P3 (Fitment & Part Compatibility Catalogs)**: Vehicle-to-part cross-referencing and fitment.
- **P4 (Auxiliary Technical Specs)**: Fluids, quantities, labor times, torque values.
- **P5 (Community & Open Datasets)**: Public GitHub repositories, open web catalogs, community maintenance logs.

---

## 1. Tier-1 & Aftermarket Manufacturers

### SKF Automotive (Vehicle Aftermarket)
- **SOURCE_NAME**: SKF Automotive Vehicle Aftermarket Catalog & Technical Portal
- **COMPANY**: SKF Group
- **URL_OFFICIAL**: `https://vsm.skf.com`
- **SOURCE_TYPE**: Kit Catalogue / Web Search / Technical Product Portal
- **PRIORITY_TIER**: P2 (Kits) & P3 (Fitment)
- **FREE_ACCESS**: YES
- **REGISTRATION_REQUIRED**: NO (for basic catalog search); YES (for extended technical bulletins)
- **API_AVAILABLE**: UNKNOWN (No public developer API endpoint exposed; web search interface only)
- **API_DOCUMENTATION_URL**: N/A
- **API_AUTH_METHOD**: N/A
- **FREE_API_LIMITS**: N/A
- **COVERAGE**: Global (Europe priority); all major passenger cars and light commercial vehicles; 1980–present.
- **DATA_AVAILABLE**:
  - `VIN`: NO (Search by KBA/Make-Model-Engine)
  - `matrícula`: NO
  - `fabricante`: YES
  - `modelo`: YES
  - `generación`: YES
  - `motor / engine_code`: YES
  - `caja_de_cambios`: YES (where relevant to wheel bearing or drive shaft kits)
  - `referencia_OEM`: YES
  - `referencias_aftermarket`: YES (SKF reference)
  - `equivalencias`: YES
  - `fitment`: YES
  - `exploded_diagrams`: PARTIAL (Assembly instructions included in specific kit references)
  - `repair_procedures`: PARTIAL (Technical installation instructions available as PDF per kit)
  - `repair_kits`: YES (VKMA, VKMC, VKPC, VKBA series)
  - `kit_contents`: YES (Detailed list of belt, tensioner, idlers, water pump, studs/washers/seals)
  - `required_parts`: YES (within kit scope)
  - `recommended_parts`: YES (e.g. water pumpVKMC recommended over belt-only VKMA)
  - `conditional_parts`: YES
  - `single_use_bolts`: YES (included in premium VKMC / VKBA kits)
  - `seals/gaskets`: YES
  - `fluids`: NO
  - `fluid_specifications`: NO
  - `fluid_quantities`: NO
  - `torque_specifications`: PARTIAL (Specified in PDF technical instructions for critical bolts)
  - `labour_operations`: NO
  - `labour_times`: NO
  - `maintenance_intervals`: PARTIAL
  - `technical_bulletins`: YES
  - `installation_instructions`: YES
  - `superseded_references`: YES
- **DATA_FORMAT**: HTML / PDF
- **MACHINE_READABLE**: PARTIAL (HTML web scraping required)
- **SCRAPING_REQUIRED**: YES
- **TERMS_OF_USE_URL**: `https://vsm.skf.com/terms`
- **LICENSE**: Proprietary Copyright SKF
- **COMMERCIAL_REUSE**: RESTRICTED (Web data copy prohibited without license)
- **DATABASE_EXTRACTION_ALLOWED**: NO
- **ATTRIBUTION_REQUIRED**: YES
- **RELIABILITY**: Tier-1 manufacturer
- **USEFULNESS_FOR_BIBENDIA**: Critical for timing belt kit BOMs (`VKMC` series containing belt + tensioner + rollers + water pump + hardware) and wheel bearing kit BOMs (`VKBA`).
- **LIMITATIONS**: No public REST API; lacks labor times and fluid capacities.
- **NOTES**: High evidence value for `DERIVED_FROM_KIT` relations.

---

### Gates / Gates TechZone
- **SOURCE_NAME**: Gates TechZone & Gates AutoCat
- **COMPANY**: Gates Corporation
- **URL_OFFICIAL**: `https://www.gatestechzone.com` / `https://www.gatesautocat.com`
- **SOURCE_TYPE**: Technical Portal / Kit Catalogue / Web Search
- **PRIORITY_TIER**: P1 (Technical Bulletins/Rules) & P2 (Kits)
- **FREE_ACCESS**: YES
- **REGISTRATION_REQUIRED**: NO
- **API_AVAILABLE**: UNKNOWN
- **API_DOCUMENTATION_URL**: N/A
- **API_AUTH_METHOD**: N/A
- **FREE_API_LIMITS**: N/A
- **COVERAGE**: Global; passenger & LCV; 1970–present.
- **DATA_AVAILABLE**:
  - `engine_code`: YES
  - `referencia_OEM`: YES
  - `fitment`: YES
  - `repair_kits`: YES (PowerGrip® KP series with water pump, K series without)
  - `kit_contents`: YES (Belt, tensioners, dampers, water pump, thermostat in select kits, bolts)
  - `required_parts`: YES
  - `recommended_parts`: YES (Explicit recommendation to replace water pump with timing belt)
  - `single_use_bolts`: YES (Included in KP kits)
  - `technical_bulletins`: YES (Detailed technical warnings on specific engine quirks)
  - `installation_instructions`: YES
- **DATA_FORMAT**: HTML / PDF
- **MACHINE_READABLE**: PARTIAL
- **SCRAPING_REQUIRED**: YES
- **TERMS_OF_USE_URL**: `https://www.gates.com/us/en/legal/terms-of-use.html`
- **LICENSE**: Proprietary Copyright Gates Corp.
- **COMMERCIAL_REUSE**: RESTRICTED
- **DATABASE_EXTRACTION_ALLOWED**: NO
- **ATTRIBUTION_REQUIRED**: YES
- **RELIABILITY**: Tier-1 manufacturer
- **USEFULNESS_FOR_BIBENDIA**: Primary source for timing belt, micro-V auxiliary belt, and cooling hose replacement rules and kit contents.
- **LIMITATIONS**: Web layout requires html scraping or manual curation.

---

### Continental Engineparts (ContiTech)
- **SOURCE_NAME**: Continental Product Information Center (PIC)
- **COMPANY**: Continental AG
- **URL_OFFICIAL**: `https://www.continental-engineparts.com/pic`
- **SOURCE_TYPE**: Product Portal / Technical Manuals / Kit Catalog
- **PRIORITY_TIER**: P1 & P2
- **FREE_ACCESS**: YES
- **REGISTRATION_REQUIRED**: NO
- **API_AVAILABLE**: NO
- **API_DOCUMENTATION_URL**: N/A
- **API_AUTH_METHOD**: N/A
- **FREE_API_LIMITS**: N/A
- **COVERAGE**: European vehicles focus; comprehensive.
- **DATA_AVAILABLE**:
  - `engine_code`: YES
  - `repair_kits`: YES (CT kits, PRO kits with water pump & bolts)
  - `kit_contents`: YES (Belts, tensioner, idlers, water pump, mounting bolts)
  - `torque_specifications`: YES (PIC provides exact torque values for timing belt tensioners)
  - `technical_bulletins`: YES
- **DATA_FORMAT**: HTML / PDF
- **MACHINE_READABLE**: PARTIAL
- **SCRAPING_REQUIRED**: YES
- **TERMS_OF_USE_URL**: `https://www.continental-engineparts.com/terms`
- **LICENSE**: Proprietary
- **COMMERCIAL_REUSE**: RESTRICTED
- **DATABASE_EXTRACTION_ALLOWED**: NO
- **ATTRIBUTION_REQUIRED**: YES
- **RELIABILITY**: Tier-1 OEM & Aftermarket supplier.
- **USEFULNESS_FOR_BIBENDIA**: PIC portal delivers exact BOM content, torque specs, and installation tips for timing belt and auxiliary belt systems.

---

### Schaeffler REPXPERT & Developer Portal
- **SOURCE_NAME**: Schaeffler REPXPERT Portal / Schaeffler Catalog
- **COMPANY**: Schaeffler Automotive Aftermarket GmbH & Co. KG
- **URL_OFFICIAL**: `https://www.repxpert.com`
- **SOURCE_TYPE**: RMI Portal / Repair Manual / Kit Catalog (LuK, INA, FAG, Ruville)
- **PRIORITY_TIER**: P1, P2 & P4
- **FREE_ACCESS**: PARTIAL (Catalog is free; full RMI TecRMI procedures require registration/points)
- **REGISTRATION_REQUIRED**: YES (For full RMI and torque values)
- **API_AVAILABLE**: UNKNOWN (Developer portal exists for business partners; public REST API unconfirmed)
- **API_DOCUMENTATION_URL**: N/A
- **API_AUTH_METHOD**: OAuth2 / API Key (Business portal)
- **FREE_API_LIMITS**: N/A
- **COVERAGE**: Global; all major brands.
- **DATA_AVAILABLE**:
  - `repair_kits`: YES (LuK RepSet, LuK RepSet DMF, INA Timing Kit, FAG Wheel Set)
  - `kit_contents`: YES (Clutch disc, pressure plate, release bearing/CSC, dual-mass flywheel, flywheel bolts, alignment tool)
  - `torque_specifications`: YES (Flywheel and clutch pressure plate torques)
  - `single_use_bolts`: YES (Flywheel stretch bolts highlighted)
- **DATA_FORMAT**: HTML / PDF
- **MACHINE_READABLE**: PARTIAL
- **SCRAPING_REQUIRED**: YES
- **TERMS_OF_USE_URL**: `https://www.repxpert.com/en/terms-and-conditions`
- **LICENSE**: Proprietary
- **COMMERCIAL_REUSE**: RESTRICTED
- **DATABASE_EXTRACTION_ALLOWED**: NO
- **ATTRIBUTION_REQUIRED**: YES
- **RELIABILITY**: Tier-1 OEM / Manufacturer.
- **USEFULNESS_FOR_BIBENDIA**: Industry gold standard for Clutch + DMF (`LuK RepSet DMF`) and Timing Belt/Chain (`INA`) kit deconstruction.

---

### febi / Bilstein Group PartsFinder
- **SOURCE_NAME**: bilstein group partsfinder
- **COMPANY**: Ferdinand Bilstein GmbH + Co. KG
- **URL_OFFICIAL**: `https://partsfinder.bilsteingroup.com`
- **SOURCE_TYPE**: Online Parts & Kit Catalog
- **PRIORITY_TIER**: P2 & P3
- **FREE_ACCESS**: YES
- **REGISTRATION_REQUIRED**: NO
- **API_AVAILABLE**: UNKNOWN
- **API_DOCUMENTATION_URL**: N/A
- **API_AUTH_METHOD**: N/A
- **FREE_API_LIMITS**: N/A
- **COVERAGE**: Global; 45,000+ repair articles for passenger and LCV.
- **DATA_AVAILABLE**:
  - `repair_kits`: YES (ProKit series)
  - `kit_contents`: YES (Includes all required auxiliary hardware such as nuts, split pins, grease, and bolts)
  - `fluids`: YES (febi fluid finder links exact fluid specifications to vehicle models)
  - `fluid_specifications`: YES (OEM approval standards e.g. VW 507 00, G 13, etc.)
- **DATA_FORMAT**: HTML
- **MACHINE_READABLE**: PARTIAL
- **SCRAPING_REQUIRED**: YES
- **TERMS_OF_USE_URL**: `https://partsfinder.bilsteingroup.com/en/terms`
- **LICENSE**: Proprietary
- **COMMERCIAL_REUSE**: RESTRICTED
- **DATABASE_EXTRACTION_ALLOWED**: NO
- **ATTRIBUTION_REQUIRED**: YES
- **RELIABILITY**: Tier-1 / Aftermarket manufacturer.
- **USEFULNESS_FOR_BIBENDIA**: Excellent for "ProKits" where auxiliary hardware (single-use bolts/nuts for suspension and control arms) is explicitly bundled.

---

### Elring (Das Original)
- **SOURCE_NAME**: Elring Online Catalog & Technical Web
- **COMPANY**: ElringKlinger AG
- **URL_OFFICIAL**: `https://www.elring.com`
- **SOURCE_TYPE**: Gasket & Seal Catalog / Technical Guides
- **PRIORITY_TIER**: P1 & P2
- **FREE_ACCESS**: YES
- **REGISTRATION_REQUIRED**: NO
- **API_AVAILABLE**: NO
- **API_DOCUMENTATION_URL**: N/A
- **API_AUTH_METHOD**: N/A
- **FREE_API_LIMITS**: N/A
- **COVERAGE**: Global engines.
- **DATA_AVAILABLE**:
  - `seals/gaskets`: YES
  - `single_use_bolts`: YES (Cylinder head bolt sets with explicit replacement rules)
  - `torque_specifications`: YES (Tightening sequences and angle torques for cylinder head bolts)
- **DATA_FORMAT**: HTML / PDF
- **MACHINE_READABLE**: PARTIAL
- **SCRAPING_REQUIRED**: YES
- **TERMS_OF_USE_URL**: `https://www.elring.com/terms`
- **LICENSE**: Proprietary
- **COMMERCIAL_REUSE**: RESTRICTED
- **DATABASE_EXTRACTION_ALLOWED**: NO
- **ATTRIBUTION_REQUIRED**: YES
- **RELIABILITY**: OEM Gasket Supplier.
- **USEFULNESS_FOR_BIBENDIA**: Key source for gasket set BOMs (head gasket set, valve cover gasket set, crankshaft radial oil seals) and bolt torque sequences.

---

### HELLA Tech World
- **SOURCE_NAME**: HELLA Tech World Portal
- **COMPANY**: FORVIA HELLA
- **URL_OFFICIAL**: `https://www.hella.com/techworld`
- **SOURCE_TYPE**: Technical Portal / Repair Procedures / Lighting & HVAC Catalog
- **PRIORITY_TIER**: P1 & P4
- **FREE_ACCESS**: YES
- **REGISTRATION_REQUIRED**: NO
- **API_AVAILABLE**: NO
- **API_DOCUMENTATION_URL**: N/A
- **API_AUTH_METHOD**: N/A
- **FREE_API_LIMITS**: N/A
- **COVERAGE**: Global.
- **DATA_AVAILABLE**:
  - `fluids`: YES (Refrigerant R134a / R1234yf and PAG oil filling quantities)
  - `fluid_specifications`: YES
  - `fluid_quantities`: YES
  - `technical_bulletins`: YES (Diagnostic and repair steps for HVAC, lighting, and electronics)
- **DATA_FORMAT**: HTML / PDF
- **MACHINE_READABLE**: PARTIAL
- **SCRAPING_REQUIRED**: YES
- **TERMS_OF_USE_URL**: `https://www.hella.com/legal`
- **LICENSE**: Proprietary
- **COMMERCIAL_REUSE**: RESTRICTED
- **DATABASE_EXTRACTION_ALLOWED**: NO
- **ATTRIBUTION_REQUIRED**: YES
- **RELIABILITY**: Tier-1 OEM Supplier.
- **USEFULNESS_FOR_BIBENDIA**: Best free technical source for HVAC refrigerant fill quantities and oil types per vehicle model.

---

### MANN-FILTER
- **SOURCE_NAME**: MANN-FILTER Online Catalog
- **COMPANY**: MANN+HUMMEL
- **URL_OFFICIAL**: `https://catalog.mann-filter.com`
- **SOURCE_TYPE**: Product Catalog
- **PRIORITY_TIER**: P3 (Fitment)
- **FREE_ACCESS**: YES
- **REGISTRATION_REQUIRED**: NO
- **API_AVAILABLE**: NO
- **API_DOCUMENTATION_URL**: N/A
- **API_AUTH_METHOD**: N/A
- **FREE_API_LIMITS**: N/A
- **COVERAGE**: Global automotive filtration.
- **DATA_AVAILABLE**:
  - `fitment`: YES (Oil, Air, Fuel, Cabin filters linked to vehicle engine codes)
  - `referencia_OEM`: YES
  - `installation_instructions`: YES (PDF guides for cabin filter replacement location)
- **DATA_FORMAT**: HTML / PDF
- **MACHINE_READABLE**: PARTIAL
- **SCRAPING_REQUIRED**: YES
- **TERMS_OF_USE_URL**: `https://catalog.mann-filter.com/terms`
- **LICENSE**: Proprietary
- **COMMERCIAL_REUSE**: RESTRICTED
- **DATABASE_EXTRACTION_ALLOWED**: NO
- **ATTRIBUTION_REQUIRED**: YES
- **RELIABILITY**: Tier-1 OEM Filter Supplier.
- **USEFULNESS_FOR_BIBENDIA**: Verifying exact maintenance filter BOM per engine code.

---

## 2. Industry Databases & Community Platforms

### 7zap (OEM Parts Catalog Viewer)
- **SOURCE_NAME**: 7zap OEM Catalog
- **COMPANY**: 7zap / Independent
- **URL_OFFICIAL**: `https://7zap.com`
- **SOURCE_TYPE**: Exploded OEM Diagrams / Part Catalog Search
- **PRIORITY_TIER**: P1 (Exploded BOMs) & P3 (OEM Fitment)
- **FREE_ACCESS**: YES (Web view)
- **REGISTRATION_REQUIRED**: NO
- **API_AVAILABLE**: UNKNOWN (Commercial API available via request)
- **API_DOCUMENTATION_URL**: N/A
- **API_AUTH_METHOD**: API Key
- **FREE_API_LIMITS**: N/A
- **COVERAGE**: Multi-brand (VAG, BMW, Mercedes, Renault, PSA, Ford, Toyota, etc.)
- **DATA_AVAILABLE**:
  - `exploded_diagrams`: YES (Full OEM parts diagrams with sub-assembly callouts)
  - `referencia_OEM`: YES (Exact 9-11 digit OEM reference numbers)
  - `single_use_bolts`: YES (Diagrams explicitly label individual screws, washers, seals, O-rings)
  - `superseded_references`: YES
- **DATA_FORMAT**: HTML / SVG
- **MACHINE_READABLE**: PARTIAL
- **SCRAPING_REQUIRED**: YES
- **TERMS_OF_USE_URL**: `https://7zap.com/en/terms/`
- **LICENSE**: Proprietary / Copyrighted OEM diagram indexing
- **COMMERCIAL_REUSE**: RESTRICTED / HIGH RISK
- **DATABASE_EXTRACTION_ALLOWED**: NO
- **ATTRIBUTION_REQUIRED**: YES
- **RELIABILITY**: Industry database (Indexes OEM catalog structures)
- **USEFULNESS_FOR_BIBENDIA**: Identifying OEM bolt references and hidden O-rings/gaskets required for an intervention.

---

### Open Labor Project (OLP)
- **SOURCE_NAME**: Open Labor Project
- **COMPANY**: Community / Open Community Project
- **URL_OFFICIAL**: `https://openlaborproject.com`
- **SOURCE_TYPE**: Open Dataset / Web Portal / Community API
- **PRIORITY_TIER**: P1 & P4
- **FREE_ACCESS**: YES
- **REGISTRATION_REQUIRED**: NO
- **API_AVAILABLE**: YES
- **API_DOCUMENTATION_URL**: `https://openlaborproject.com/api`
- **API_AUTH_METHOD**: Free API Key / Open
- **FREE_API_LIMITS**: Generous / Open Access
- **COVERAGE**: Focus on US market initially; expanding to European models.
- **DATA_AVAILABLE**:
  - `labour_times`: YES (Estimated shop labor hours)
  - `torque_specifications`: YES
  - `fluid_specifications`: YES
  - `fluid_quantities`: YES
- **DATA_FORMAT**: JSON / HTML
- **MACHINE_READABLE**: YES
- **SCRAPING_REQUIRED**: NO
- **TERMS_OF_USE_URL**: `https://openlaborproject.com/terms`
- **LICENSE**: Open Data / Community Open License
- **COMMERCIAL_REUSE**: ALLOWED
- **DATABASE_EXTRACTION_ALLOWED**: YES
- **ATTRIBUTION_REQUIRED**: YES
- **RELIABILITY**: Community dataset / Crowdsourced & Verified.
- **USEFULNESS_FOR_BIBENDIA**: Primary candidate for open labor time estimates and torque specs without paywalls.

---

### MechanicDB / Ignite Auto Repair Engine
- **SOURCE_NAME**: MechanicDB
- **COMPANY**: Ignite Auto Repair
- **URL_OFFICIAL**: `https://ignitecarsrepair.com`
- **SOURCE_TYPE**: Diagnostic & Repair Estimation Database
- **PRIORITY_TIER**: P5
- **FREE_ACCESS**: PARTIAL (Search interface)
- **REGISTRATION_REQUIRED**: YES
- **API_AVAILABLE**: NO
- **API_DOCUMENTATION_URL**: N/A
- **API_AUTH_METHOD**: N/A
- **FREE_API_LIMITS**: N/A
- **COVERAGE**: US & European vehicles.
- **DATA_AVAILABLE**:
  - `repair_procedures`: YES
  - `required_parts`: YES
- **DATA_FORMAT**: HTML
- **MACHINE_READABLE**: NO
- **SCRAPING_REQUIRED**: YES
- **TERMS_OF_USE_URL**: N/A
- **LICENSE**: Proprietary
- **COMMERCIAL_REUSE**: RESTRICTED
- **DATABASE_EXTRACTION_ALLOWED**: NO
- **ATTRIBUTION_REQUIRED**: YES
- **RELIABILITY**: Industry database.
- **USEFULNESS_FOR_BIBENDIA**: Reference validation for common repair symptom-to-job mappings.
