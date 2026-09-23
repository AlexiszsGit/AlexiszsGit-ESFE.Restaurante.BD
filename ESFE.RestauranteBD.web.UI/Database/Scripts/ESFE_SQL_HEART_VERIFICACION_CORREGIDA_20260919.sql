
SET NOCOUNT ON;
IF DB_NAME() <> N'db_ace55a_orellana2026001'
    THROW 51100,'Base de datos incorrecta.',1;

-- Ejecuta el procedimiento de validación correspondiente.
EXEC dbo.usp_System_HealthCheck;

SELECT
    a.AccountId,
    a.Email,
    r.Name AS Rol,
    a.IsActive,
    c.CustomerId,
    c.IsActive AS CustomerActivo,
    c.CustomerType,
    ep.EmployeeId,
    ep.IsActive AS EmployeeActivo,
    ep.PositionTitle
FROM dbo.Accounts a
JOIN dbo.Roles r ON r.RoleId=a.RoleId
LEFT JOIN dbo.Customers c ON c.AccountId=a.AccountId AND c.IsActive=1
LEFT JOIN dbo.EmployeeProfiles ep ON ep.AccountId=a.AccountId
ORDER BY a.AccountId;

SELECT N'Clientes con empleado activo' AS Problema,COUNT(*) AS Total
FROM dbo.Accounts a
JOIN dbo.Roles r ON r.RoleId=a.RoleId
JOIN dbo.EmployeeProfiles ep ON ep.AccountId=a.AccountId AND ep.IsActive=1
WHERE r.Name=N'Cliente';

SELECT N'Trabajadores sin perfil empleado' AS Problema,COUNT(*) AS Total
FROM dbo.Accounts a
JOIN dbo.Roles r ON r.RoleId=a.RoleId
LEFT JOIN dbo.EmployeeProfiles ep ON ep.AccountId=a.AccountId
WHERE r.Name<>N'Cliente' AND (ep.EmployeeId IS NULL OR ep.IsActive<>a.IsActive);

SELECT N'Pedidos con CustomerType invalido' AS Problema,COUNT(*) AS Total
FROM dbo.Orders
WHERE CustomerType NOT IN(N'No registrado',N'Registrado',N'Cliente');

SELECT N'Pagos confirmados sin PaidAt' AS Problema,COUNT(*) AS Total
FROM dbo.Payments
WHERE Status IN(N'Confirmado','Pagado') AND PaidAt IS NULL;

SELECT N'Delivery con estado invalido' AS Problema,COUNT(*) AS Total
FROM dbo.Deliveries
WHERE Status NOT IN(N'Pendiente',N'Asignado',N'Recogido',N'En camino',N'En preparación',N'Entregado',N'Fallido',N'Cancelado');
