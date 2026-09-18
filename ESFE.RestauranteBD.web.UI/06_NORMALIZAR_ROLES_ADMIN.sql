/* NORMALIZACION DE ROLES ADMINISTRATIVOS
   Base: db_ace55a_orellana2026001
   - Elimina un rol Administrador personalizado si existiera.
   - Reasigna sus cuentas al rol Dueno antes de eliminarlo.
   - Crea/normaliza Administrador como rol del sistema.
   - Dueno y Administrador reciben los mismos 15 permisos.
*/
USE [db_ace55a_orellana2026001];
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE LTRIM(RTRIM(Name))=N'Dueno')
    INSERT dbo.Roles(Name,DisplayName,Description,IsSystemRole,IsActive,CreatedAt)
    VALUES(N'Dueno',N'Administrador',N'Administrador principal',1,1,SYSUTCDATETIME());
ELSE
    UPDATE dbo.Roles
       SET IsSystemRole=1,IsActive=1,DisplayName=N'Administrador',Description=N'Administrador principal'
     WHERE LTRIM(RTRIM(Name))=N'Dueno';
GO

IF EXISTS (SELECT 1 FROM dbo.Roles WHERE LTRIM(RTRIM(Name))=N'Administrador' AND IsSystemRole=0)
BEGIN
    UPDATE a
       SET a.RoleId=(SELECT TOP(1) RoleId FROM dbo.Roles WHERE Name=N'Dueno' AND IsActive=1)
      FROM dbo.Accounts a
      JOIN dbo.Roles oldRole ON oldRole.RoleId=a.RoleId
     WHERE LTRIM(RTRIM(oldRole.Name))=N'Administrador' AND oldRole.IsSystemRole=0;

    DELETE rp
      FROM dbo.RolePermissions rp
      JOIN dbo.Roles oldRole ON oldRole.RoleId=rp.RoleId
     WHERE LTRIM(RTRIM(oldRole.Name))=N'Administrador' AND oldRole.IsSystemRole=0;

    DELETE FROM dbo.Roles
     WHERE LTRIM(RTRIM(Name))=N'Administrador' AND IsSystemRole=0;
END;
GO

/* Elimina cualquier variante con espacios alrededor del nombre Administrador
   que no sea el rol canónico ya normalizado. */
IF EXISTS (SELECT 1 FROM dbo.Roles WHERE Name<>LTRIM(RTRIM(Name)) AND LTRIM(RTRIM(Name))=N'Administrador')
BEGIN
    DECLARE @CanonicalAdminId int=(SELECT TOP(1) RoleId FROM dbo.Roles WHERE Name=N'Administrador' AND IsSystemRole=1 ORDER BY RoleId);
    IF @CanonicalAdminId IS NOT NULL
    BEGIN
        UPDATE a SET RoleId=@CanonicalAdminId
        FROM dbo.Accounts a
        JOIN dbo.Roles r ON r.RoleId=a.RoleId
        WHERE LTRIM(RTRIM(r.Name))=N'Administrador' AND r.RoleId<>@CanonicalAdminId;
        DELETE rp FROM dbo.RolePermissions rp JOIN dbo.Roles r ON r.RoleId=rp.RoleId WHERE LTRIM(RTRIM(r.Name))=N'Administrador' AND r.RoleId<>@CanonicalAdminId;
        DELETE FROM dbo.Roles WHERE Name<>LTRIM(RTRIM(Name)) AND LTRIM(RTRIM(Name))=N'Administrador';
    END
END;

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE LTRIM(RTRIM(Name))=N'Administrador')
    INSERT dbo.Roles(Name,DisplayName,Description,IsSystemRole,IsActive,CreatedAt)
    VALUES(N'Administrador',N'Administrador',N'Administrador del sistema',1,1,SYSUTCDATETIME());
ELSE
    UPDATE dbo.Roles
       SET IsSystemRole=1,IsActive=1,DisplayName=N'Administrador',Description=N'Administrador del sistema'
     WHERE LTRIM(RTRIM(Name))=N'Administrador';
GO

DECLARE @all TABLE(PermissionKey nvarchar(50) NOT NULL PRIMARY KEY);
INSERT @all(PermissionKey) VALUES
(N'Dashboard'),(N'Menu'),(N'Orders'),(N'Kitchen'),(N'Delivery'),(N'Reservations'),
(N'Customers'),(N'Notifications'),(N'Reports'),(N'Payments'),(N'Profile'),
(N'LocalOrders'),(N'Workers'),(N'Ratings'),(N'Information');

INSERT dbo.RolePermissions(RoleId,PermissionId,GrantedAt)
SELECT r.RoleId,p.PermissionId,SYSUTCDATETIME()
FROM dbo.Roles r
JOIN @all a ON 1=1
JOIN dbo.Permissions p ON p.PermissionKey=a.PermissionKey
WHERE LTRIM(RTRIM(r.Name)) IN(N'Dueno',N'Administrador')
  AND p.IsActive=1
  AND NOT EXISTS (SELECT 1 FROM dbo.RolePermissions rp WHERE rp.RoleId=r.RoleId AND rp.PermissionId=p.PermissionId);
GO

SELECT r.RoleId,r.Name,r.DisplayName,r.IsSystemRole,r.IsActive,
       (SELECT COUNT(*) FROM dbo.RolePermissions rp WHERE rp.RoleId=r.RoleId) AS PermissionCount
FROM dbo.Roles r
WHERE LTRIM(RTRIM(r.Name)) IN(N'Dueno',N'Administrador')
ORDER BY r.Name;
GO
