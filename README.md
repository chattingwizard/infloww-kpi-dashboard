# Dashboard KPIs (Infloww + Hubstaff)

Página que calcula KPIs a partir de **Infloww** (Marketing Analytics) y **Hubstaff** (horas trabajadas). Infloww puede actualizarse solo vía Google Sheets; las horas de Hubstaff se actualizan al subir un nuevo export.

## Cómo usar

1. **Abrir la página**  
   Abre `index.html` en el navegador (doble clic o arrastra a Chrome/Edge).

2. **Subir los dos archivos**
   - **Infloww:** Marketing Analytics → exportar a CSV (o Excel). En la página: **"1. Infloww"** → Subir CSV/Excel.
   - **Hubstaff:** Timesheets → Ver y editar → descargar CSV, o Reports → Time & Activity → Export CSV. En la página: **"2. Hubstaff"** → Subir CSV/Excel.
   - Los KPIs se calculan al momento y se guardan en el navegador. Puedes subir solo uno y luego el otro.

3. **Actualización automática (solo Infloww)**
   - Si conectas una **Google Sheet** con los datos de Infloww (Conectar Google Sheets), la página leerá esa hoja cada 5 minutos.
   - Las **horas de Hubstaff** no se actualizan solas: hay que exportar de nuevo desde Hubstaff y subir el CSV cuando quieras refrescar (por ejemplo cada semana).

## KPIs que calcula

**De Infloww:** Ingresos totales, Suscripciones, Clicks, Claims, Conversión, Tasa de claims.  
**De Hubstaff:** Horas totales, Pago total (si el export incluye esa columna).  
**Combinado:** Ingresos por hora (ingresos Infloww ÷ horas Hubstaff) cuando subes ambos archivos.

## Formato Hubstaff

El CSV de Hubstaff debe tener una columna de tiempo (por ejemplo *Hours*, *Time*, *Duration*, *Time tracked*). Si tiene *Pay* o *Amount*, se usará para "Pago total". Se aceptan horas en formato decimal (1.5) o "1:30".

## Requisitos

- Navegador moderno (Chrome, Edge, Firefox).
- Para Google Sheets: la hoja debe estar **publicada en la web**.
