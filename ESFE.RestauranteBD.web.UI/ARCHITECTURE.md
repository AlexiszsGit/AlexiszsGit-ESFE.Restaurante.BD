# RestauranteBD web UI

Proyecto web preparado para Visual Studio 2026 y .NET 10.

## Estructura principal

- `Controllers/`: reglas de acceso y acciones HTTP. Cada pantalla tiene su controlador.
- `Models/`: modelos de cuenta y almacenamiento temporal mientras la base de datos permanezca desconectada.
- `Views/`: una carpeta por pantalla para que las vistas sean fáciles de localizar.
- `wwwroot/css/`: estilos globales.
- `wwwroot/js/site.js`: lógica existente del sistema que se conserva para no romper funcionalidades anteriores.
- `wwwroot/js/modules/`: mejoras separadas por responsabilidad.
  - `auth.js`: inicio de sesión, creación de cuenta y contraseña.
  - `validation.js`: nombres, DUI, números, fechas y teléfonos por país.
  - `chatbot.js`: asistente conversacional y acciones guiadas.
  - `payment.js`: interfaz y validación de pago con tarjeta.
  - `cart.js`: ajustes de teléfono de domicilio.
  - `reservations.js`: reservas presenciales para Barra y Administrador.
  - `workers.js`: búsqueda y alta de trabajadores desde una cuenta Cliente.

## Roles

- Administrador: operación y administración completa.
- Cocina: solo cocina.
- Barra: pedidos, reservas, entregas y clientes.
- Repartidor: entregas.
- Cliente: menú, carrito, pedidos, reservas, calificaciones, notificaciones e información.

## Flujo de incorporación de trabajadores

1. La persona crea una cuenta normal como Cliente.
2. El administrador abre `Trabajadores`.
3. Busca el correo de la cuenta Cliente.
4. Selecciona Cocina, Barra o Repartidor.
5. Asigna la nueva contraseña de trabajador.
6. La cuenta conserva sus datos personales, pero el servidor aplica el nuevo rol y sus permisos.

## Base de datos

Actualmente el proyecto conserva el almacenamiento temporal de demostración existente. La conexión con la base de datos puede incorporarse posteriormente sin mezclar la lógica de interfaz con el acceso a datos.
