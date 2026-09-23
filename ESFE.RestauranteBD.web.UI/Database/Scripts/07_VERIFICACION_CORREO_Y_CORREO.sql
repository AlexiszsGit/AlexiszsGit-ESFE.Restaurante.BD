/*
    Verificación de correo y correo interno de RestauranteBD.
    Este script crea las tablas nuevas si todavía no existen.
    La aplicación también las crea automáticamente al iniciar.
*/

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

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_AppAuthCodes_Email_Purpose' AND object_id=OBJECT_ID(N'dbo.AppAuthCodes'))
    CREATE INDEX IX_AppAuthCodes_Email_Purpose ON dbo.AppAuthCodes(Email,Purpose,CreatedAt DESC);

IF OBJECT_ID(N'dbo.AppMailMessages', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AppMailMessages
    (
        AppMailMessageId bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_AppMailMessages PRIMARY KEY,
        SenderAccountId int NULL,
        SenderEmail nvarchar(254) NOT NULL,
        SenderName nvarchar(120) NOT NULL,
        RecipientAccountId int NULL,
        RecipientEmail nvarchar(254) NOT NULL,
        RecipientName nvarchar(120) NULL,
        CcJson nvarchar(max) NULL,
        BccJson nvarchar(max) NULL,
        Subject nvarchar(120) NOT NULL,
        Body nvarchar(max) NOT NULL,
        AttachmentsJson nvarchar(max) NULL,
        IsRead bit NOT NULL CONSTRAINT DF_AppMailMessages_IsRead DEFAULT 0,
        IsStarred bit NOT NULL CONSTRAINT DF_AppMailMessages_IsStarred DEFAULT 0,
        IsArchived bit NOT NULL CONSTRAINT DF_AppMailMessages_IsArchived DEFAULT 0,
        SentAt datetime2(3) NOT NULL CONSTRAINT DF_AppMailMessages_SentAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_AppMailMessages_Sender FOREIGN KEY(SenderAccountId) REFERENCES dbo.Accounts(AccountId),
        CONSTRAINT FK_AppMailMessages_Recipient FOREIGN KEY(RecipientAccountId) REFERENCES dbo.Accounts(AccountId)
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name=N'IX_AppMailMessages_Recipient' AND object_id=OBJECT_ID(N'dbo.AppMailMessages'))
    CREATE INDEX IX_AppMailMessages_Recipient ON dbo.AppMailMessages(RecipientAccountId,SentAt DESC);

SELECT
    DB_NAME() AS BaseDeDatos,
    @@SERVERNAME AS Servidor,
    (SELECT COUNT(*) FROM dbo.Accounts) AS Cuentas,
    (SELECT COUNT(*) FROM dbo.Products WHERE IsDeleted=0) AS Productos,
    (SELECT COUNT(*) FROM dbo.Orders) AS Pedidos,
    (SELECT COUNT(*) FROM dbo.Reservations) AS Reservas,
    (SELECT COUNT(*) FROM dbo.Payments) AS Pagos,
    (SELECT COUNT(*) FROM dbo.AppUserState) AS EstadosPorUsuario,
    (SELECT COUNT(*) FROM dbo.AppGlobalState) AS EstadosGenerales,
    (SELECT COUNT(*) FROM dbo.AppMailMessages) AS CorreosInternos;
