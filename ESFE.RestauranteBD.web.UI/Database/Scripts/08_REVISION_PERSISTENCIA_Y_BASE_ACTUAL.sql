/*
    Revisión rápida para confirmar que la aplicación está usando
    la misma base de datos donde se hicieron las pruebas.
*/

SELECT
    DB_NAME() AS BaseDeDatos,
    @@SERVERNAME AS Servidor;

SELECT 'Accounts' AS Tabla, COUNT(*) AS Registros FROM dbo.Accounts
UNION ALL SELECT 'Products', COUNT(*) FROM dbo.Products WHERE IsDeleted=0
UNION ALL SELECT 'Orders', COUNT(*) FROM dbo.Orders
UNION ALL SELECT 'Reservations', COUNT(*) FROM dbo.Reservations
UNION ALL SELECT 'Payments', COUNT(*) FROM dbo.Payments
UNION ALL SELECT 'AppUserState', COUNT(*) FROM dbo.AppUserState
UNION ALL SELECT 'AppGlobalState', COUNT(*) FROM dbo.AppGlobalState
UNION ALL SELECT 'AppMailMessages', COUNT(*) FROM dbo.AppMailMessages;

SELECT TOP (20)
    StateKey,
    UpdatedAt
FROM dbo.AppGlobalState
ORDER BY UpdatedAt DESC;
