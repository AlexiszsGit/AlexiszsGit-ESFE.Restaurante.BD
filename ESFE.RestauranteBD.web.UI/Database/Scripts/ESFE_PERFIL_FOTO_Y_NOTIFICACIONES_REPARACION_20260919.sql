
/*
   Reparación segura para el perfil y el centro de notificaciones.
   No elimina cuentas ni pedidos. Ejecutar sobre la base existente.
*/
SET NOCOUNT ON;

/* 1) Confirmar que la infraestructura de foto de perfil existe. */
SELECT
    DB_NAME() AS DatabaseName,
    CASE WHEN COL_LENGTH(N'dbo.Accounts', N'ProfilePhotoMediaAssetId') IS NOT NULL THEN 1 ELSE 0 END AS HasProfilePhotoMediaAssetId,
    CASE WHEN COL_LENGTH(N'dbo.Accounts', N'ProfilePhotoContent') IS NOT NULL THEN 1 ELSE 0 END AS HasProfilePhotoContent,
    CASE WHEN COL_LENGTH(N'dbo.MediaAssets', N'Content') IS NOT NULL THEN 1 ELSE 0 END AS HasMediaContent,
    CASE WHEN COL_LENGTH(N'dbo.MediaAssets', N'ContentCipher') IS NOT NULL THEN 1 ELSE 0 END AS HasMediaContentCipher;

/* 2) Mostrar las referencias de fotos actuales para detectar residuos. */
SELECT
    a.AccountId,
    a.Email,
    a.ProfilePhotoMediaAssetId,
    m.IsActive,
    m.IsPrimary,
    m.IsSensitive,
    m.ContentType,
    CASE WHEN m.Content IS NULL THEN 0 ELSE DATALENGTH(m.Content) END AS PlainBytes,
    CASE WHEN m.ContentCipher IS NULL THEN 0 ELSE DATALENGTH(m.ContentCipher) END AS CipherBytes
FROM dbo.Accounts a
LEFT JOIN dbo.MediaAssets m ON m.MediaAssetId=a.ProfilePhotoMediaAssetId
ORDER BY a.AccountId;

/* 3) Limpieza de referencias que apunten a assets inexistentes. */
-- Actualiza los datos que cumplen la condición indicada.
UPDATE a
SET ProfilePhotoMediaAssetId=NULL,
    ProfilePhotoContent=NULL,
    ProfilePhotoContentType=NULL,
    ProfilePhotoFileName=NULL,
    UpdatedAt=SYSUTCDATETIME()
FROM dbo.Accounts a
LEFT JOIN dbo.MediaAssets m ON m.MediaAssetId=a.ProfilePhotoMediaAssetId
WHERE a.ProfilePhotoMediaAssetId IS NOT NULL
  AND m.MediaAssetId IS NULL;

/* 4) Estado de notificaciones guardadas por cuenta. */
SELECT AccountId,StateKey,UpdatedAt,DATALENGTH(StateJson) AS StateBytes
FROM dbo.AppUserState
WHERE StateKey=N'restaurantebd_notificaciones'
ORDER BY AccountId;
