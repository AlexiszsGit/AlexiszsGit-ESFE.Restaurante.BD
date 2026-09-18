# Reparación puntual

Esta copia parte del proyecto original. Se conservaron las pantallas, rutas y estructura existentes.

Correcciones aplicadas después de la última compilación reportada:
- Se corrigió la interpolación condicional de `RestaurantDb.BuildAssistantContext`.
- Se suprime `NU1900`/auditoría de NuGet cuando el entorno no puede acceder a `api.nuget.org`; esto no desactiva la descarga normal de paquetes.
- Se eliminó `bin/obj` para forzar una recompilación limpia.
- `UserStore.NormalizeEmail` y `UserStore.Create(..., rol, password)` están definidos en el proyecto.
- No se cambió la ruta de inicio del proyecto respecto a la copia base.

Configuración de ejecución:
- SQL Server: appsettings.json -> ConnectionStrings:RestaurantDb
- Gemini: appsettings.json -> Gemini:ApiKey
