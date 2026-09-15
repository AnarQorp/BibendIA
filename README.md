# ⚡ BibendIA — Recepción Digital Inteligente para Talleres

> **"Tú arreglas coches. La IA se ocupa de la recepción y del trabajo administrativo."**

[![Build & Deploy to GitHub Pages](https://github.com/baituman420/BibendIA/actions/workflows/deploy.yml/badge.svg)](https://github.com/baituman420/BibendIA/actions/workflows/deploy.yml)
[![Demo en vivo](https://img.shields.io/badge/Demo%20en%20vivo-GitHub%20Pages-orange?style=flat-square&logo=github)](https://baituman420.github.io/BibendIA/)
[![Licencia](https://img.shields.io/badge/Licencia-Propietaria-blue?style=flat-square)](#)

---

## 🚘 Visión del Producto

**BibendIA** no intenta ser otro ERP ni software completo de gestión de talleres (DMS). Los pequeños talleres ya disponen de programas para facturar, llevar la contabilidad o gestionar su inventario.

BibendIA se sitúa **por delante y por encima** del software existente actuando como un **recepcionista y administrativo digital autónomo**.

```
CLIENTE (WhatsApp / Teléfono / Web)
  ↓
ASISTENTE IA BIBENDIA
  ↓
INTERPRETA LA NECESIDAD (Revisión / Avería / Kilometraje)
  ↓
CITA / PRESUPUESTO / CONSULTA
  ↓
APROBACIÓN HUMANA EN 1 CLIC
  ↓
SEGUIMIENTO Y TRABAJO REALIZADO
  ↓
[ENVIAR A GESTIÓN] 🟢 (Sincronización con ERP/DMS)
```

### 🎯 Cliente Objetivo
- **Pequeños talleres de automoción** (1 a 5 personas).
- Propietario que también trabaja activamente como mecánico.
- Recibe llamadas mientras trabaja debajo de los coches.
- Utiliza WhatsApp constantemente para atender a sus clientes.
- Pierde horas semanales haciendo presupuestos y recordando citas.

---

## 🔑 Principio Fundamental: Recepción por Excepción

> **No queremos ganar por tener más funcionalidades. Queremos ganar porque el dueño del taller tenga que hacer menos.**

La IA realiza las tareas rutinarias y presenta al profesional **únicamente las decisiones importantes** para que las autorice con 1 solo clic.

---

## 🌟 Funcionalidades Principales

### 1. ☀️ Inicio — "Mi Día en el Taller"
- **Saludo Sintético**: *"Buenos días, Jon · Mientras estabas trabajando: 5 consultas atendidas, 3 citas gestionadas, 2 presupuestos preparados"*.
- **Necesita Tu Atención**: Muestra las decisiones prioritarias con botones directos `[Aprobar y enviar]`.
- **Hoy en la Agenda**: Calendario operativo diario con opción de dictar la finalización del trabajo para los mecánicos.

### 2. 💬 Bandeja Inteligente Multicanal
- Centraliza comunicaciones de WhatsApp, teléfono y formulario web.
- **Interpretación IA en Tiempo Real**: Detecta la avería/mantenimiento (*Seat León: Revisión 80k km + Ruido de frenos*), solicita automáticamente datos faltantes (kilometraje) y presenta la mejor opción de cita a 1 clic.

### 3. 📅 Agenda de Disponibilidad
- Responde directamente a la pregunta clave del mecánico: **"¿Puedo coger este coche y cuándo?"**
- Calcula duraciones estimadas y carga del taller para ofrecer los mejores huecos sin sobrecargar el flujo de trabajo.

### 4. 📄 Presupuestos por Lenguaje Natural
- Entrada por dictado de voz o texto: *"Prepárame presupuesto para discos y pastillas delanteras del BMW de Ander"*.
- La IA desglosa automáticamente recambios OEM, tiempos de catálogo, mano de obra taller (50 €/h) e IVA (21%), con botón `[Aprobar y Enviar WhatsApp]`.

### 5. 📈 Seguimientos & Retención de Clientes
- Detecta oportunidades de ingresos: presupuestos sin respuesta (Peugeot 308 - 462,22 €), reparaciones preventivas recomendadas en visitas pasadas y mantenimientos caducados.
- Permite enviar recordatorios redactados por la IA en 1 clic.

### 6. ✨ "Lo que BibendIA ha hecho por ti" (Impacto & ROI)
- Visualización clara del valor tangible de la suscripción:
  - ⏱️ **4 h 48 min** de tiempo administrativo ahorrado.
  - 💶 **1.180,00 €** de trabajo e ingresos recuperados.
  - Historial cronológico detallado con marcas de tiempo.

### 7. 🔌 Configuración e Integraciones ERP / DMS
- Muestra el estado del **Software de gestión del taller 🟢 Conectado** (*SolucionTaller, GT Estimate, GestTaller, Holded*).
- Permite exportar los partes de trabajo terminados mediante la acción `[Enviar a gestión]`.

### 8. 🎙️ Asistente Global & Dictado por Voz
- Accesible en toda la app vía `⌘K` o botón de micrófono. Simula la secuencia *"Escuchando..."* -> transcripción -> interpretación -> acción propuesta.

### 9. 🎬 Modo Demo Guiado Discreto (10 Pasos)
- Modo de presentación comercial activable discretamente con `Ctrl+Shift+D` o desde el menú secundario.
- Permite realizar una presentación del flujo completo del taller en 3 minutos.

---

## 🚀 Tecnologías Utilizadas

- **Core**: React 18 + Vite + TypeScript.
- **Estilos & UI**: Tailwind CSS + Lucide React Icons + Glassmorphism + Estética de automoción de alto contraste.
- **Despliegue**: GitHub Actions + GitHub Pages (`base: './'`).

---

## 💻 Instalación y Desarrollo Local

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/baituman420/BibendIA.git
   cd BibendIA
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Iniciar servidor de desarrollo**:
   ```bash
   npm run dev
   ```
   Abrir en el navegador: `http://localhost:3000`

4. **Compilar para producción**:
   ```bash
   npm run build
   ```

---

## 📜 Licencia

Desarrollado para **BibendIA** — Todos los derechos reservados.
