# 09. GAPS — Technical & Legal Data Limitations Audit

This document details technical data elements that **CANNOT be reliably or legally obtained in bulk from free/open sources**, explaining their operational impact on BibendIA and proposed mitigation strategies.

---

## 1. Audit of Data Gaps

### GAP 1: European RMI Labor Times (Standard Operation Hours / AW)
- **Status**: **MISSING IN FREE OPEN DATA**
- **Detail**: Official European OEM labor operation hours (AW values) are proprietary assets licensed via TecRMI, Eurotax, or Autodata.
- **Open Labor Project (OLP) Limitation**: While OLP provides labor hours, a significant portion of its entries are **AI-estimated or community-submitted** (`confidence: medium` or `estimated`). Per BibendIA rules, estimated entries cannot generate automated quotes.
- **Mitigation**: Filter OLP for `confidence = oem_verified` or `high`. Build BibendIA internal historical workshop labor estimation models, with a commercial TecRMI API fallback for unverified operations.

---

### GAP 2: License Plate / VIN to Engine Code Resolution (Spain & EU)
- **Status**: **COMMERCIAL / REGULATORY API REQUIRED**
- **Detail**: Resolving a Spanish license plate or European VIN to exact Engine Code (`CLHA`, `CRMB`, `K9K 872`) requires DGT (Dirección General de Tráfico) API access or commercial vehicle data providers (Carfax, TecAlliance).
- **Mitigation**: Allow manual workshop selection of Engine Code / kW when plate lookup is ambiguous, or integrate a licensed DGT lookup provider.

---

### GAP 3: Complete Torque-to-Yield Angle Sequences
- **Status**: **PARTIAL**
- **Detail**: basic tightening torques (Nm) are available from Tier-1 manufacturers (Elring, Continental PIC). However, obscure multi-stage angle torque sequences (`30 Nm + 90° + 90°`) for secondary engine brackets are restricted in OEM RMI manuals.
- **Mitigation**: Populate high-risk fasteners (head bolts, flywheel, timing tensioner, wheel hub) from Elring/LuK/Conti technical guides.

---

### GAP 4: Vector OEM Exploded Assembly Diagrams
- **Status**: **COPYRIGHT RESTRICTED**
- **Detail**: Exploded CAD illustrations are copyrighted OEM property. Systematic scraping or displaying vector SVG diagrams from sites like 7zap carries high IP risk.
- **Mitigation**: BibendIA will render dynamic interactive graph trees (BOM nodes and edges) instead of reproducing copyrighted OEM CAD drawings.

---

## 2. Gap Summary Matrix

| Data Element | Free/Open Availability | BibendIA Impact | Mitigation Strategy |
|---|---|---|---|
| **Component BOM (Parts/Kits)** | High (SKF, Gates, Conti, LuK, febi) | Low | Derived from Tier-1 Kits + Fact Indexing |
| **Consumables & Specifications** | High (febi, HELLA, MANN, Castrol) | Low | Fluid specification rule engine |
| **European Labor Times (AW)** | Very Low (OLP AI estimates filtered out) | High | Open Labor (`oem_verified` only) + Workshop learning |
| **Matrícula / VIN $\rightarrow$ Engine Code** | Unavailable for free | High | Workshop manual input / DGT API integration |
| **Tightening Angle Sequences** | Partial (Elring, Continental PIC) | Medium | Populate top 20% high-risk fasteners |
| **Exploded Graphics** | Restricted / Copyrighted | Low | Structured HTML/SVG Repair BOM graphs |
