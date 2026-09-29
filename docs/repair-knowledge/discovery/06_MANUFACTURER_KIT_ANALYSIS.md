# 06. MANUFACTURER KIT ANALYSIS — Deconstructing Implicit BOMs

This document analyzes commercial repair kits published by Tier-1 automotive manufacturers and defines how **BibendIA** extracts implicit Repair BOMs while preserving proper provenance classification (`DERIVED_FROM_KIT` vs `EXPLICIT_BOM`).

---

## 1. Executive Summary & Methodology

Tier-1 manufacturers bundle components into repair kits (e.g. Timing Belt + Water Pump Kits, Clutch + Flywheel Kits, Wheel Bearing Kits with Hardware).
These kits represent a major source of **DERIVED Repair Knowledge**, because manufacturers design them to include the parts that technicians need to perform a complete system service.

### Distinction Rule
- **`EXPLICIT_BOM`**: Sourced from OEM repair manuals or explicit manufacturer service procedures requiring specific component lists.
- **`DERIVED_FROM_KIT`**: Extracted from commercial kit contents. While highly indicative, kit contents must be categorized as `DERIVED_FROM_KIT` because commercial packaging strategies may omit secondary items (e.g. coolant or auxiliary seals) or include redundant fittings for multiple engine sub-variants.

---

## 2. Analysis by Major Manufacturer

### A. SKF Automotive (VKMC / VKMA / VKBA / VKDA Series)
- **Kit Types**:
  - `VKMC Series`: Timing belt + tensioners + rollers + water pump + mounting bolts/washers.
  - `VKMA Series`: Timing belt + tensioners + rollers (no water pump).
  - `VKBA Series`: Wheel bearing + axle nut + circlip + ABS sensor ring + grease.
  - `VKDA Series`: Strut mount + top bearing + spring seat.
- **Derived Repair BOM Capabilities**:
  - High confidence for timing belt system hardware.
  - SKF includes stretch bolts in `VKMC` kits where OEM specifies single-use bolts.
- **BOM Extraction Rule**:
  - `VKMC` kit content $\rightarrow$ `timing_belt` [REQUIRED], `tensioner_pulley` [REQUIRED], `idler_pulley` [REQUIRED], `water_pump` [RECOMMENDED], `stretch_bolt` [REPLACE_ONCE].

---

### B. Gates Corporation (PowerGrip® KP / K Series)
- **Kit Types**:
  - `KP Series` (e.g., KP35678XS): PowerGrip® timing belt + tensioner + idlers + water pump + installation hardware.
  - `K Series` (e.g., 5678XS): Timing belt + pulleys (no water pump).
  - `Micro-V® Kit`: Auxiliary belt + automatic tensioner + idler pulleys.
- **Derived Repair BOM Capabilities**:
  - Gates TechZone explicitly recommends replacing the water pump whenever replacing the timing belt on engines where the pump is driven by the timing belt.
- **Technical Bulletins**:
  - Gates publishes technical bulletins detailing mandatory replacement of specific tensioner mounting studs or dampers.

---

### C. Continental Engineparts (ContiTech CT / WP / PRO Series)
- **Kit Types**:
  - `CT Kit`: Timing belt + pulleys.
  - `WP Kit`: Timing belt + pulleys + water pump.
  - `PRO Kit`: Timing belt + pulleys + water pump + thermostat + central bolt hardware.
- **Derived Repair BOM Capabilities**:
  - Continental PIC provides exact component listings down to individual O-rings and torque values.

---

### D. Schaeffler Group (LuK RepSet DMF / INA Timing Kits / FAG Wheel Sets)
- **Kit Types**:
  - `LuK RepSet DMF`: Dual-mass flywheel + clutch disc + pressure plate + concentric slave cylinder (CSC) / release bearing + flywheel stretch bolts.
  - `INA Timing Kit`: Belt/Chain + tensioner + guide rails + variable valve timing (VVT) sprockets.
  - `FAG WheelSet`: Wheel bearing + hub + axle bolts + dust caps.
- **Derived Repair BOM Capabilities**:
  - Gold standard for clutch replacement BOMs. The presence of flywheel stretch bolts in `LuK RepSet DMF` confirms `REPLACE_ONCE` requirement for flywheel bolts.

---

### E. febi bilstein (ProKit Series)
- **Kit Types**:
  - `ProKit`: Control arms, tie rods, or wheel bearings bundled with all necessary mounting hardware (nuts, bolts, split pins, threadlock).
- **Derived Repair BOM Capabilities**:
  - Solves the gap of identifying single-use locknuts and stretch bolts in suspension work.

---

### F. Elring (Das Original Gasket Sets & Bolt Kits)
- **Kit Types**:
  - `Cylinder Head Gasket Set`: Head gasket + valve stem seals + intake/exhaust manifold gaskets.
  - `Cylinder Head Bolt Kit`: Full set of stretch bolts.
- **Derived Repair BOM Capabilities**:
  - Confirms mandatory `REPLACE_ONCE` stretch bolt requirements and cylinder head tightening angle sequences.

---

## 3. BOM Derivation Rule Matrix

| Tier-1 Kit Series | Sourced Kit Contents | Derived Part Role | Requirement Type | Confidence State |
|---|---|---|---|---|
| SKF VKMC / Gates KP | Belt, Tensioner, Idler, Water Pump, Bolt | `timing_belt`<br>`tensioner_pulley`<br>`idler_pulley`<br>`water_pump`<br>`stretch_bolt` | REQUIRED<br>REQUIRED<br>REQUIRED<br>RECOMMENDED<br>REPLACE_ONCE | `DERIVED_FROM_KIT` |
| LuK RepSet DMF | Clutch Disc, Pressure Plate, CSC, DMF, Bolts | `clutch_disc`<br>`pressure_plate`<br>`release_bearing_csc`<br>`dual_mass_flywheel`<br>`flywheel_bolt` | REQUIRED<br>REQUIRED<br>REQUIRED<br>RECOMMENDED<br>REPLACE_ONCE | `DERIVED_FROM_KIT` |
| febi ProKit Control Arm | Control Arm, Ball Joint, Lock Nuts, Bolts | `control_arm`<br>`ball_joint`<br>`stretch_nut` | REQUIRED<br>REQUIRED<br>REPLACE_ONCE | `DERIVED_FROM_KIT` |
| Elring Head Bolt Kit | Head Bolts (Torque-to-Yield) | `cylinder_head_bolt` | REPLACE_ONCE | `VERIFIED_MANUFACTURER` |
