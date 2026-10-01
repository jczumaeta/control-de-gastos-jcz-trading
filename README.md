# Control de Gastos JCZ Trading

Aplicación para registrar gastos, compartir comprobantes y sincronizar los datos de la cuenta con Supabase.

- Fecha actual precargada y editable.
- Navegación por pestañas diarias; las semanas incluyen lunes a domingo.
- Ficha detallada por gasto, con imagen o PDF de comprobante, descarga y reenvío.
- Selección múltiple para compartir gastos por WhatsApp, correo u otras aplicaciones.
- Exportación XLSX con una hoja por fecha, resumen semanal y resumen mensual.
- Archivos con nombre `gastos-jcz-trading-al-DD-MM-YY`.
- Icono JCZ Trading en la PWA; al crear una cuenta se puede añadir un icono de perfil opcional.

## Desarrollo

Ejecuta `npm install` y luego `npm run web:dev` para iniciar el servidor web local.

Para generar recursos y compilar Android, configura Java 17 y Android SDK, y ejecuta `npm run android:build`. Para Windows usa `npm run desktop:build`.

La tabla Supabase y sus políticas de acceso están en [supabase-schema.sql](supabase-schema.sql).
