/*
    Comprueba lo que necesita la aplicación para correo, verificación y estado global.
    No borra datos y se puede ejecutar varias veces.
*/

IF COL_LENGTH(N'dbo.Accounts', N'EmailConfirmed') IS NULL
BEGIN
    ALTER TABLE dbo.Accounts
    ADD EmailConfirmed bit NOT NULL CONSTRAINT DF_Accounts_EmailConfirmed DEFAULT 0;
END;
GO

IF OBJECT_ID(N'dbo.AppAuthCodes', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AppAuthCodes
    (
        AuthCodeId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_AppAuthCodes PRIMARY KEY,
        AccountId int NOT NULL,
        Email nvarchar(254) NOT NULL,
        Purpose nvarchar(40) NOT NULL,
        CodeHash nvarchar(128) NOT NULL,
        ExpiresAt datetime2(3) NOT NULL,
        UsedAt datetime2(3) NULL,
        CreatedAt datetime2(3) NOT NULL CONSTRAINT DF_AppAuthCodes_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_AppAuthCodes_Account FOREIGN KEY(AccountId) REFERENCES dbo.Accounts(AccountId) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE name=N'IX_AppAuthCodes_Email_Purpose'
      AND object_id=OBJECT_ID(N'dbo.AppAuthCodes')
)
BEGIN
    CREATE INDEX IX_AppAuthCodes_Email_Purpose
        ON dbo.AppAuthCodes(Email, Purpose, CreatedAt DESC);
END;
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

SELECT
    DB_NAME() AS BaseDeDatos,
    @@SERVERNAME AS Servidor,
    COL_LENGTH(N'dbo.Accounts',N'EmailConfirmed') AS EmailConfirmedColumn,
    CASE WHEN OBJECT_ID(N'dbo.AppAuthCodes',N'U') IS NULL THEN 0 ELSE 1 END AS AuthCodesReady,
    CASE WHEN OBJECT_ID(N'dbo.AppGlobalState',N'U') IS NULL THEN 0 ELSE 1 END AS GlobalStateReady;
GO
