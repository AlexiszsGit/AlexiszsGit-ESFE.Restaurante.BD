# Configuración mínima

1. Abre `appsettings.json`.
2. En `ConnectionStrings:RestaurantDb`, cambia `TU_USUARIO_SQL` y `TU_PASSWORD_SQL`. No cambies el servidor ni la base.
3. En `Gemini:ApiKey`, pega tu API key. La clave se usa solo en el servidor; nunca se envía al navegador.
4. Puedes usar variables de entorno en producción: `ConnectionStrings__RestaurantDb` y `Gemini__ApiKey`.

El proyecto conserva el arranque, las vistas y los scripts originales. La conexión a SQL se agrega como capa de persistencia/sincronización y como backend del chatbot. Si SQL no está configurado, las cuentas demo y el comportamiento local original siguen disponibles para desarrollo.
