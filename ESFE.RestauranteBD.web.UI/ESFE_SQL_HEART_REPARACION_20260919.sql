/*
 ESFE.RestauranteBD - REPARACION SQL HEART 2026-09-19
 Base objetivo: db_ace55a_orellana2026001

 Ejecutar en SSMS dentro de la base EXISTENTE.
 NO elimina tablas ni datos.
 Es idempotente.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'db_ace55a_orellana2026001'
    THROW 51000, 'Ejecuta este script dentro de db_ace55a_orellana2026001.', 1;
GO

/* 1. Claves de cifrado. El nombre correcto del DMK es ##MS_DatabaseMasterKey##. */
IF KEY_ID(N'##MS_DatabaseMasterKey##') IS NULL
BEGIN
    CREATE MASTER KEY ENCRYPTION BY PASSWORD = N'ESFE-DBMK-2026-9f7K2mQ8xR4vL6pN3sT5';
END;
GO

IF CERT_ID(N'Cert_RestauranteSensitiveData') IS NULL
BEGIN
    CREATE CERTIFICATE Cert_RestauranteSensitiveData
        WITH SUBJECT = N'ESFE Restaurante - Sensitive Data';
END;
GO

IF KEY_ID(N'SK_RestauranteSensitiveData') IS NULL
BEGIN
    CREATE SYMMETRIC KEY SK_RestauranteSensitiveData
        WITH ALGORITHM = AES_256
        ENCRYPTION BY CERTIFICATE Cert_RestauranteSensitiveData;
END;
GO

/* 2. Estado persistente de interfaz. No es autoridad de pedidos/pagos. */
IF OBJECT_ID(N'dbo.AppUserState', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AppUserState
    (
        AppUserStateId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_AppUserState PRIMARY KEY,
        AccountId int NOT NULL,
        StateKey nvarchar(160) NOT NULL,
        StateJson nvarchar(max) NOT NULL,
        UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_AppUserState_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_AppUserState_Account FOREIGN KEY(AccountId) REFERENCES dbo.Accounts(AccountId) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'UX_AppUserState_Account_Key' AND object_id=OBJECT_ID(N'dbo.AppUserState'))
    CREATE UNIQUE INDEX UX_AppUserState_Account_Key ON dbo.AppUserState(AccountId, StateKey);
GO

IF OBJECT_ID(N'dbo.AppGlobalState', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AppGlobalState
    (
        StateKey nvarchar(160) NOT NULL CONSTRAINT PK_AppGlobalState PRIMARY KEY,
        StateJson nvarchar(max) NOT NULL,
        UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_AppGlobalState_UpdatedAt DEFAULT SYSUTCDATETIME()
    );
END;
GO

/* 3. Alinear EmployeeProfiles con la aplicación. */
IF COL_LENGTH(N'dbo.EmployeeProfiles',N'UpdatedAt') IS NULL
BEGIN
    ALTER TABLE dbo.EmployeeProfiles ADD UpdatedAt datetime2(0) NULL;
END;
GO

UPDATE dbo.EmployeeProfiles
SET UpdatedAt=COALESCE(UpdatedAt,CreatedAt,SYSUTCDATETIME())
WHERE UpdatedAt IS NULL;
GO

/* 4. PaidAt debe permitir NULL mientras un pago está pendiente. */
IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id=OBJECT_ID(N'dbo.Payments')
      AND name=N'PaidAt'
      AND is_nullable=0
)
BEGIN
    ALTER TABLE dbo.Payments ALTER COLUMN PaidAt datetime2(0) NULL;
END;
GO

/* 5. Los estados reales que usan los procedimientos deben estar permitidos. */
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name=N'CK_Customers_Type' AND parent_object_id=OBJECT_ID(N'dbo.Customers'))
    ALTER TABLE dbo.Customers DROP CONSTRAINT CK_Customers_Type;
GO
ALTER TABLE dbo.Customers WITH CHECK ADD CONSTRAINT CK_Customers_Type
    CHECK (CustomerType IN (N'No registrado',N'Registrado',N'Cliente'));
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name=N'CK_Orders_CustomerType' AND parent_object_id=OBJECT_ID(N'dbo.Orders'))
    ALTER TABLE dbo.Orders DROP CONSTRAINT CK_Orders_CustomerType;
GO
ALTER TABLE dbo.Orders WITH CHECK ADD CONSTRAINT CK_Orders_CustomerType
    CHECK (CustomerType IN (N'No registrado',N'Registrado',N'Cliente'));
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name=N'CK_Deliveries_Status' AND parent_object_id=OBJECT_ID(N'dbo.Deliveries'))
    ALTER TABLE dbo.Deliveries DROP CONSTRAINT CK_Deliveries_Status;
GO
ALTER TABLE dbo.Deliveries WITH CHECK ADD CONSTRAINT CK_Deliveries_Status
    CHECK (Status IN (N'Pendiente',N'Asignado',N'Recogido',N'En camino',N'En preparación',N'Entregado',N'Fallido',N'Cancelado'));
GO

/* 6. No permitir dos clientes activos para la misma cuenta. */
;WITH ranked AS
(
    SELECT CustomerId,AccountId,
           ROW_NUMBER() OVER(PARTITION BY AccountId ORDER BY IsActive DESC,CustomerId) AS rn
    FROM dbo.Customers
    WHERE AccountId IS NOT NULL
)
UPDATE c
SET IsActive=0,
    UpdatedAt=SYSUTCDATETIME()
FROM dbo.Customers c
JOIN ranked r ON r.CustomerId=c.CustomerId
WHERE r.rn>1 AND c.IsActive=1;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'UX_Customers_Account_Active' AND object_id=OBJECT_ID(N'dbo.Customers'))
    CREATE UNIQUE INDEX UX_Customers_Account_Active
        ON dbo.Customers(AccountId)
        WHERE IsActive=1 AND AccountId IS NOT NULL;
GO

/* 7. Normalizar cuentas -> cliente / empleado. */
UPDATE c
SET c.IsActive=CASE WHEN r.Name=N'Cliente' AND a.IsActive=1 THEN 1 ELSE 0 END,
    c.CustomerType=CASE WHEN r.Name=N'Cliente' THEN N'Registrado' ELSE c.CustomerType END,
    c.UpdatedAt=SYSUTCDATETIME()
FROM dbo.Customers c
JOIN dbo.Accounts a ON a.AccountId=c.AccountId
JOIN dbo.Roles r ON r.RoleId=a.RoleId;
GO

INSERT dbo.Customers
    (AccountId,FullName,Email,CustomerType,IsActive,CreatedAt,EmailNormalized,EmailLookupHash)
SELECT
    a.AccountId,a.FullName,a.Email,N'Registrado',1,SYSUTCDATETIME(),
    LOWER(LTRIM(RTRIM(a.Email))),
    HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(a.Email)))))
FROM dbo.Accounts a
JOIN dbo.Roles r ON r.RoleId=a.RoleId
WHERE r.Name=N'Cliente'
  AND a.IsActive=1
  AND NOT EXISTS (SELECT 1 FROM dbo.Customers c WHERE c.AccountId=a.AccountId AND c.IsActive=1);
GO

/* 8. Crear/sincronizar perfil laboral para TODA cuenta no Cliente. */
INSERT dbo.EmployeeProfiles(AccountId,PositionTitle,IsActive,CreatedAt,UpdatedAt)
SELECT
    a.AccountId,
    CASE WHEN r.Name=N'Dueno' THEN N'Administrador' ELSE COALESCE(r.DisplayName,r.Name) END,
    a.IsActive,
    SYSUTCDATETIME(),
    SYSUTCDATETIME()
FROM dbo.Accounts a
JOIN dbo.Roles r ON r.RoleId=a.RoleId
WHERE r.Name<>N'Cliente'
  AND NOT EXISTS (SELECT 1 FROM dbo.EmployeeProfiles ep WHERE ep.AccountId=a.AccountId);
GO

UPDATE ep
SET ep.PositionTitle=CASE WHEN r.Name=N'Dueno' THEN N'Administrador' ELSE COALESCE(r.DisplayName,r.Name) END,
    ep.IsActive=CASE WHEN r.Name<>N'Cliente' THEN a.IsActive ELSE 0 END,
    ep.UpdatedAt=SYSUTCDATETIME()
FROM dbo.EmployeeProfiles ep
JOIN dbo.Accounts a ON a.AccountId=ep.AccountId
JOIN dbo.Roles r ON r.RoleId=a.RoleId;
GO

/* 9. Asegurar que los perfiles de cliente nunca queden como empleados activos. */
UPDATE ep
SET IsActive=0,UpdatedAt=SYSUTCDATETIME()
FROM dbo.EmployeeProfiles ep
JOIN dbo.Accounts a ON a.AccountId=ep.AccountId
JOIN dbo.Roles r ON r.RoleId=a.RoleId
WHERE r.Name=N'Cliente';
GO

/* 10. El procedimiento de clientes debe usar el dominio real de la BD por defecto. */
CREATE OR ALTER PROCEDURE dbo.usp_Customer_Save
    @CustomerId int=NULL,
    @AccountId int=NULL,
    @FullName nvarchar(120),
    @Email nvarchar(254)=NULL,
    @Phone nvarchar(40)=NULL,
    @Dui nvarchar(10)=NULL,
    @Address nvarchar(250)=NULL,
    @CustomerType nvarchar(20)=N'Registrado',
    @Notes nvarchar(500)=NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    IF NULLIF(LTRIM(RTRIM(@FullName)),N'') IS NULL
        THROW 52040,N'El nombre del cliente es obligatorio.',1;

    OPEN SYMMETRIC KEY SK_RestauranteSensitiveData
        DECRYPTION BY CERTIFICATE Cert_RestauranteSensitiveData;

    IF @CustomerId IS NULL
    BEGIN
        INSERT dbo.Customers
            (AccountId,FullName,Email,Phone,Dui,Address,CustomerType,IsActive,Notes,CreatedAt,EmailNormalized,EmailLookupHash,PhoneLookupHash,DuiLookupHash,PhoneCipher,DuiCipher,AddressCipher)
        VALUES
            (@AccountId,@FullName,@Email,@Phone,@Dui,@Address,@CustomerType,1,@Notes,SYSUTCDATETIME(),
             LOWER(LTRIM(RTRIM(@Email))),
             CASE WHEN @Email IS NULL THEN NULL ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@Email))))) END,
             CASE WHEN @Phone IS NULL THEN NULL ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@Phone))))) END,
             CASE WHEN @Dui IS NULL THEN NULL ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@Dui))))) END,
             CASE WHEN @Phone IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@Phone)) END,
             CASE WHEN @Dui IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@Dui)) END,
             CASE WHEN @Address IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@Address)) END);
        SET @CustomerId=SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        UPDATE c
        SET AccountId=@AccountId,
            FullName=@FullName,
            Email=@Email,
            Phone=@Phone,
            Dui=@Dui,
            Address=@Address,
            CustomerType=@CustomerType,
            IsActive=1,
            Notes=@Notes,
            UpdatedAt=SYSUTCDATETIME(),
            EmailNormalized=LOWER(LTRIM(RTRIM(@Email))),
            EmailLookupHash=CASE WHEN @Email IS NULL THEN NULL ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@Email))))) END,
            PhoneLookupHash=CASE WHEN @Phone IS NULL THEN NULL ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@Phone))))) END,
            DuiLookupHash=CASE WHEN @Dui IS NULL THEN NULL ELSE HASHBYTES('SHA2_256',CONVERT(varbinary(max),LOWER(LTRIM(RTRIM(@Dui))))) END,
            PhoneCipher=CASE WHEN @Phone IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@Phone)) END,
            DuiCipher=CASE WHEN @Dui IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@Dui)) END,
            AddressCipher=CASE WHEN @Address IS NULL THEN NULL ELSE EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),@Address)) END
        FROM dbo.Customers c
        WHERE c.CustomerId=@CustomerId;
    END

    CLOSE SYMMETRIC KEY SK_RestauranteSensitiveData;
    SELECT @CustomerId AS CustomerId;
END;
GO

/* 11. Health check reutilizable desde SSMS/API. */
CREATE OR ALTER PROCEDURE dbo.usp_System_HealthCheck
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @MasterKey bit=CASE WHEN KEY_ID(N'##MS_DatabaseMasterKey##') IS NOT NULL THEN 1 ELSE 0 END;
    DECLARE @Certificate bit=CASE WHEN CERT_ID(N'Cert_RestauranteSensitiveData') IS NOT NULL THEN 1 ELSE 0 END;
    DECLARE @SymmetricKey bit=CASE WHEN KEY_ID(N'SK_RestauranteSensitiveData') IS NOT NULL THEN 1 ELSE 0 END;
    DECLARE @EmployeeUpdatedAt bit=CASE WHEN COL_LENGTH(N'dbo.EmployeeProfiles',N'UpdatedAt') IS NOT NULL THEN 1 ELSE 0 END;
    DECLARE @PaidAtNullable bit=CASE WHEN EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID(N'dbo.Payments') AND name=N'PaidAt' AND is_nullable=1) THEN 1 ELSE 0 END;

    DECLARE @EncryptionWorks bit=0;
    IF @Certificate=1 AND @SymmetricKey=1
    BEGIN
        BEGIN TRY
            OPEN SYMMETRIC KEY SK_RestauranteSensitiveData
                DECRYPTION BY CERTIFICATE Cert_RestauranteSensitiveData;
            DECLARE @Probe varbinary(max)=EncryptByKey(Key_GUID(N'SK_RestauranteSensitiveData'),CONVERT(varbinary(max),N'ESFE-HEALTH'));
            IF @Probe IS NOT NULL AND CONVERT(nvarchar(50),DecryptByKey(@Probe))=N'ESFE-HEALTH'
                SET @EncryptionWorks=1;
            CLOSE SYMMETRIC KEY SK_RestauranteSensitiveData;
        END TRY
        BEGIN CATCH
            IF EXISTS(SELECT 1 FROM sys.openkeys WHERE key_name=N'SK_RestauranteSensitiveData')
                CLOSE SYMMETRIC KEY SK_RestauranteSensitiveData;
            SET @EncryptionWorks=0;
        END CATCH
    END;

    SELECT
        DB_NAME() AS BaseDatos,
        @MasterKey AS MasterKey,
        @Certificate AS Certificate,
        @SymmetricKey AS SymmetricKey,
        @EncryptionWorks AS EncryptionWorks,
        @EmployeeUpdatedAt AS EmployeeUpdatedAt,
        @PaidAtNullable AS PaidAtNullable;

    SELECT
        (SELECT COUNT(*) FROM dbo.Accounts) AS Accounts,
        (SELECT COUNT(*) FROM dbo.Customers) AS Customers,
        (SELECT COUNT(*) FROM dbo.EmployeeProfiles) AS EmployeeProfiles,
        (SELECT COUNT(*) FROM dbo.Products) AS Products,
        (SELECT COUNT(*) FROM dbo.Orders) AS Orders,
        (SELECT COUNT(*) FROM dbo.Reservations) AS Reservations,
        (SELECT COUNT(*) FROM dbo.Payments) AS Payments,
        (SELECT COUNT(*) FROM dbo.Deliveries) AS Deliveries,
        (SELECT COUNT(*) FROM dbo.MediaAssets) AS MediaAssets,
        (SELECT COUNT(*) FROM dbo.ChatSessions) AS ChatSessions,
        (SELECT COUNT(*) FROM dbo.ChatMessages) AS ChatMessages;

    SELECT N'Clientes con empleado activo' AS Problema, COUNT(*) AS Total
    FROM dbo.Accounts a
    JOIN dbo.Roles r ON r.RoleId=a.RoleId
    JOIN dbo.EmployeeProfiles ep ON ep.AccountId=a.AccountId
    WHERE r.Name=N'Cliente' AND ep.IsActive=1;

    SELECT N'Trabajadores sin perfil empleado' AS Problema, COUNT(*) AS Total
    FROM dbo.Accounts a
    JOIN dbo.Roles r ON r.RoleId=a.RoleId
    LEFT JOIN dbo.EmployeeProfiles ep ON ep.AccountId=a.AccountId
    WHERE r.Name<>N'Cliente' AND (ep.EmployeeId IS NULL OR ep.IsActive<>a.IsActive);
END;
GO

/* 12. Registrar esta reparación. */
IF OBJECT_ID(N'dbo.SchemaMigrations',N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.SchemaMigrations WHERE Version=N'2026.09.19-SQL-HEART-REPAIR')
    BEGIN
        INSERT dbo.SchemaMigrations(Version,Description,AppliedAt,AppliedBy)
        VALUES(N'2026.09.19-SQL-HEART-REPAIR',N'Correccion de cifrado, empleados/clientes, pagos y estados para SQL Heart.',SYSUTCDATETIME(),SUSER_SNAME());
    END;
END;
GO

EXEC dbo.usp_System_HealthCheck;
GO
