-- Guarda la moneda general que comparte todo el restaurante.
-- Si la tabla ya existe, solo deja USD como valor inicial cuando todavía no hay moneda.

IF OBJECT_ID(N'dbo.AppGlobalState', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.AppGlobalState
    (
        StateKey nvarchar(160) NOT NULL CONSTRAINT PK_AppGlobalState PRIMARY KEY,
        StateJson nvarchar(max) NOT NULL,
        UpdatedAt datetime2(3) NOT NULL CONSTRAINT DF_AppGlobalState_UpdatedAt DEFAULT SYSUTCDATETIME()
    );
END;

IF NOT EXISTS
(
    SELECT 1
    FROM dbo.AppGlobalState
    WHERE StateKey = N'restaurantebd_global_currency'
)
BEGIN
    INSERT dbo.AppGlobalState(StateKey, StateJson)
    VALUES(N'restaurantebd_global_currency', N'"USD"');
END;
GO

SELECT StateKey, StateJson, UpdatedAt
FROM dbo.AppGlobalState
WHERE StateKey = N'restaurantebd_global_currency';
GO
