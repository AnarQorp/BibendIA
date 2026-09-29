# 05. REPAIR JOB CATALOG — Normalized Interventions

This catalog normalizes **60 high-frequency automotive repair interventions** for independent repair shops. Each job defines its system, subsystem, standard title, expected BOM roles, and primary Tier-1 manufacturers publishing corresponding kits or technical documentation.

---

## 1. MANTENIMIENTO (Maintenance)

| Job Code | Intervention Title | System / Subsystem | Standard BOM Part Roles | Primary Manufacturers / Kit Sources |
|---|---|---|---|---|
| `JOB_MAINT_OIL_FILTER` | Sustitución Aceite y Filtro de Aceite | MANTENIMIENTO / ACEITE | `oil_filter`, `drain_plug_gasket`, `engine_oil` | MANN-FILTER, Mahle, Bosch, febi, Castrol |
| `JOB_MAINT_AIR_FILTER` | Sustitución Filtro de Aire | MANTENIMIENTO / FILTROS | `air_filter` | MANN-FILTER, Mahle, Hengst |
| `JOB_MAINT_FUEL_FILTER` | Sustitución Filtro de Combustible | MANTENIMIENTO / FILTROS | `fuel_filter`, `fuel_line_o_rings` | MANN-FILTER, Mahle, Purflux, Delphi |
| `JOB_MAINT_CABIN_FILTER` | Sustitución Filtro de Habitáculo | MANTENIMIENTO / FILTROS | `cabin_filter` | MANN-FILTER, Corteco, Valeo |
| `JOB_MAINT_SPARK_PLUGS` | Sustitución Bujías de Encendido | MANTENIMIENTO / ENCENDIDO | `spark_plug` | NGK/NTK, Bosch, Denso, Champion |
| `JOB_MAINT_GLOW_PLUGS` | Sustitución Calentadores de Diésel | MANTENIMIENTO / ENCENDIDO | `glow_plug` | NGK/NTK, Beru, Bosch, Denso |
| `JOB_MAINT_BRAKE_FLUID` | Sustitución / Purgado Líquido de Frenos | MANTENIMIENTO / FLUIDOS | `brake_fluid_dot4_dot51` | Brembo, ATE, febi, Motul |
| `JOB_MAINT_COOLANT` | Sustitución Líquido Refrigerante | MANTENIMIENTO / FLUIDOS | `coolant_antifreeze` | febi, Motul, Total, Valeo |
| `JOB_MAINT_TRANSMISSION_OIL` | Sustitución Aceite Caja de Cambios (Manual/DSG) | MANTENIMIENTO / TRANSMISION | `transmission_fluid`, `filter_kit_dsg`, `drain_plug` | febi, ZF Aftermarket, Motul, Ravenol |

---

## 2. FRENOS (Braking System)

| Job Code | Intervention Title | System / Subsystem | Standard BOM Part Roles | Primary Manufacturers / Kit Sources |
|---|---|---|---|---|
| `JOB_BRAKE_PADS_FRONT` | Sustitución Pastillas Freno Delanteras | FRENOS / DELANTERO | `brake_pad_front`, `wear_sensor`, `anti_squeal_grease` | Brembo, ATE, TRW, Ferodo, Bosch |
| `JOB_BRAKE_DISCS_PADS_FRONT` | Sustitución Discos y Pastillas Delanteras | FRENOS / DELANTERO | `brake_pad_front`, `brake_disc_front`, `wear_sensor`, `caliper_carrier_bolts` | Brembo, ATE, TRW, Zimmermann, Textar |
| `JOB_BRAKE_PADS_REAR` | Sustitución Pastillas Freno Traseras | FRENOS / TRASERO | `brake_pad_rear`, `wear_sensor` | Brembo, ATE, TRW, Bosch |
| `JOB_BRAKE_DISCS_PADS_REAR` | Sustitución Discos y Pastillas Traseras | FRENOS / TRASERO | `brake_pad_rear`, `brake_disc_rear`, `wheel_bearing_integrated_disc` (if applicable) | Brembo, ATE, TRW, SNR |
| `JOB_BRAKE_HOSES` | Sustitución Latiguillos de Freno | FRENOS / HIDRAULICO | `brake_hose`, `copper_washers`, `brake_fluid` | TRW, ATE, Corteco |
| `JOB_BRAKE_CALIPER` | Sustitución Pinza de Freno | FRENOS / HIDRAULICO | `brake_caliper`, `copper_washers`, `brake_fluid` | TRW, Brembo, Budweg, ATE |

---

## 3. DISTRIBUCIÓN (Timing System)

| Job Code | Intervention Title | System / Subsystem | Standard BOM Part Roles | Primary Manufacturers / Kit Sources |
|---|---|---|---|---|
| `JOB_TIMING_BELT_KIT` | Sustitución Kit Correa Distribución | DISTRIBUCION / CORREA | `timing_belt`, `tensioner_pulley`, `idler_pulley`, `hardware_bolts` | Gates, Continental, SKF, INA (Schaeffler), Dayco |
| `JOB_TIMING_BELT_WATER_PUMP` | Sustitución Kit Distribución + Bomba de Agua | DISTRIBUCION / CORREA | `timing_belt`, `tensioner_pulley`, `idler_pulley`, `water_pump`, `gasket_water_pump`, `coolant`, `crankshaft_stretch_bolt` | Gates (KP series), Continental (WP series), SKF (VKMC series), INA |
| `JOB_TIMING_CHAIN_KIT` | Sustitución Kit Cadena de Distribución | DISTRIBUCION / CADENA | `timing_chain`, `hydraulic_tensioner`, `guide_rails`, `sprockets`, `crankshaft_seal`, `engine_oil`, `oil_filter` | INA (Schaeffler), febi, Dayco, FAI |
| `JOB_WATER_PUMP_ONLY` | Sustitución Bomba de Agua (Independiente) | DISTRIBUCION / REFRIGERACION | `water_pump`, `gasket_water_pump`, `coolant` | SKF, Saleri, Dolz, Airtex, HELLA |

---

## 4. ACCESORIOS (Auxiliary / Serpentine Belt System)

| Job Code | Intervention Title | System / Subsystem | Standard BOM Part Roles | Primary Manufacturers / Kit Sources |
|---|---|---|---|---|
| `JOB_AUX_BELT_KIT` | Sustitución Kit Correa Auxiliar / Serpentina | ACCESORIOS / CORREA | `auxiliary_belt`, `automatic_tensioner`, `idler_pulley` | Gates (Micro-V Kit), SKF (VKMA series), Continental |
| `JOB_ALTERNATOR_PULLEY` | Sustitución Polea Libre del Alternador (OAP) | ACCESORIOS / ALTERNADOR | `overrunning_alternator_pulley`, `auxiliary_belt` | INA (Schaeffler), SKF, Gates |
| `JOB_CRANKSHAFT_DAMPER` | Sustitución Polea Damper del Cigüeñal | ACCESORIOS / CIGUENAL | `crankshaft_damper_pulley`, `stretch_bolts`, `auxiliary_belt` | Corteco, Dayco, febi, Continental |

---

## 5. EMBRAGUE / TRANSMISIÓN (Clutch & Transmission)

| Job Code | Intervention Title | System / Subsystem | Standard BOM Part Roles | Primary Manufacturers / Kit Sources |
|---|---|---|---|---|
| `JOB_CLUTCH_KIT` | Sustitución Kit de Embrague | EMBRAGUE / EMBRAGUE | `clutch_disc`, `pressure_plate`, `release_bearing` | LuK (Schaeffler), Sachs (ZF), Valeo |
| `JOB_CLUTCH_DMF_KIT` | Sustitución Kit Embrague + Volante Bimasa | EMBRAGUE / BIMASA | `clutch_disc`, `pressure_plate`, `release_bearing_csc`, `dual_mass_flywheel`, `flywheel_stretch_bolts` | LuK (RepSet DMF), Sachs (ZF), Valeo |
| `JOB_DRIVE_SHAFT` | Sustitución Transmisión / Palier | TRANSMISION / PALIER | `drive_shaft_assembly`, `axle_nut`, `gearbox_oil_seal`, `transmission_oil` | SKF, Spidan, GSP, Meyle |
| `JOB_CV_JOINT_BOOT` | Sustitución Fuelle / Guardapolvos Homocinética | TRANSMISION / HOMOCINETICA | `cv_joint_boot`, `grease_pack`, `retaining_clamps`, `circlip` | SKF, Spidan, febi |

---

## 6. SUSPENSIÓN / DIRECCIÓN (Suspension & Steering)

| Job Code | Intervention Title | System / Subsystem | Standard BOM Part Roles | Primary Manufacturers / Kit Sources |
|---|---|---|---|---|
| `JOB_SHOCK_ABSORBER_FRONT` | Sustitución Amortiguadores Delanteros | SUSPENSION / AMORTIGUACION | `shock_absorber_front`, `strut_mount_bearing_kit`, `dust_cover_protection_kit` | Sachs, KYB, Monroe, Bilstein, SKF |
| `JOB_WHEEL_BEARING` | Sustitución Rodamiento de Rueda | SUSPENSION / RODAMIENTO | `wheel_bearing_kit`, `axle_nut`, `circlip`, `abs_sensor_ring` | SKF (VKBA series), FAG (Schaeffler), SNR, febi |
| `JOB_CONTROL_ARM` | Sustitución Brazo de Suspensión | SUSPENSION / BRAZOS | `control_arm`, `ball_joint`, `silentblocks`, `stretch_nuts_bolts` | febi (ProKit), TRW, Lemförder, Meyle |
| `JOB_TRACK_ROD_END` | Sustitución Rótula de Dirección | DIRECCION / ROTULAS | `track_rod_end`, `lock_nut` | Lemförder, TRW, febi, Moog |

---

## 7. MOTOR (Engine Components)

| Job Code | Intervention Title | System / Subsystem | Standard BOM Part Roles | Primary Manufacturers / Kit Sources |
|---|---|---|---|---|
| `JOB_VALVE_COVER_GASKET` | Sustitución Junta Tapa de Balancines | MOTOR / JUNTAS | `valve_cover_gasket`, `spark_plug_tube_seals` | Elring, Corteco, Victor Reinz |
| `JOB_THERMOSTAT_HOUSING` | Sustitución Termostato y Caja Termostática | MOTOR / REFRIGERACION | `thermostat_assembly`, `gasket_o_ring`, `coolant` | HELLA, Gates, Mahle, Vernet |
| `JOB_RADIATOR_ENGINE` | Sustitución Radiador de Motor | MOTOR / REFRIGERACION | `engine_radiator`, `o_rings`, `coolant` | NRF, Valeo, Nissens, Mahle |
| `JOB_TURBOCHARGER` | Sustitución Turbocompresor | MOTOR / SOBREALIMENTACION | `turbocharger`, `turbo_mounting_gasket_kit`, `oil_feed_pipe`, `engine_oil`, `oil_filter` | Garrett, BorgWarner, Nissens, Elring |

---

## 8. ESCAPE / EMISIONES (Exhaust & Emissions)

| Job Code | Intervention Title | System / Subsystem | Standard BOM Part Roles | Primary Manufacturers / Kit Sources |
|---|---|---|---|---|
| `JOB_LAMBDA_SENSOR` | Sustitución Sonda Lambda | EMISIONES / SENSORES | `lambda_sensor` | NGK/NTK, Bosch, Denso |
| `JOB_EGR_VALVE` | Sustitución Válvula EGR | EMISIONES / RECIRCULACION | `egr_valve`, `egr_gaskets`, `coolant` (if liquid-cooled) | Pierburg, Valeo, Delphi, Wahler |
| `JOB_DPF_CLEANING_REPLACE` | Sustitución / Filtro de Partículas (DPF) | EMISIONES / DPF | `dpf_filter`, `mounting_clamps`, `differential_pressure_sensor` | Walker, BM Catalysts, HJS |

---

## 9. ELECTRICIDAD (Electrical System)

| Job Code | Intervention Title | System / Subsystem | Standard BOM Part Roles | Primary Manufacturers / Kit Sources |
|---|---|---|---|---|
| `JOB_BATTERY_REPLACEMENT` | Sustitución Batería de Arranque (AGM/EFB) | ELECTRICIDAD / BATERIA | `starter_battery` | Varta, Bosch, Exide, Yuasa |
| `JOB_ALTERNATOR` | Sustitución Alternador | ELECTRICIDAD / CARGA | `alternator`, `auxiliary_belt` | Bosch, Valeo, Hella, Denso |
| `JOB_STARTER_MOTOR` | Sustitución Motor de Arranque | ELECTRICIDAD / ARRANQUE | `starter_motor` | Bosch, Valeo, Denso, Hella |

---

## 10. CLIMATIZACIÓN (HVAC / Air Conditioning)

| Job Code | Intervention Title | System / Subsystem | Standard BOM Part Roles | Primary Manufacturers / Kit Sources |
|---|---|---|---|---|
| `JOB_AC_COMPRESSOR` | Sustitución Compresor de Aire Acondicionado | CLIMATIZACION / COMPRESOR | `ac_compressor`, `dryer_filter`, `expansion_valve`, `o_ring_kit`, `refrigerant_r134a_r1234yf`, `pag_oil` | Sanden, Denso, Mahle, Nissens, HELLA |
| `JOB_AC_CONDENSER` | Sustitución Condensador de Aire Acondicionado | CLIMATIZACION / CONDENSADOR | `ac_condenser`, `dryer_filter`, `o_rings`, `refrigerant` | Nissens, NRF, Mahle, Valeo |
