-- Script para agregar soporte de mesas alfanuméricas a la tabla area_mesa
-- Ejecutar este script en la base de datos restobar

ALTER TABLE area_mesa 
ADD COLUMN tipo_mesa VARCHAR(20) DEFAULT 'numerica' COMMENT 'numerica o alfanumerica' AFTER estado,
ADD COLUMN prefijo_mesa VARCHAR(10) DEFAULT '' COMMENT 'Prefijo para mesas alfanuméricas (ej: S1-, PISO1-)' AFTER tipo_mesa;

-- Actualizar registros existentes como numéricos
UPDATE area_mesa SET tipo_mesa = 'numerica' WHERE tipo_mesa IS NULL OR tipo_mesa = '';
