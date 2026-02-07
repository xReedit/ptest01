# Configuración de Mesas Alfanuméricas

## Descripción
Se ha implementado la funcionalidad para configurar mesas con códigos alfanuméricos, además del sistema numérico correlativo existente.

## Características

### Mesas Numéricas (Correlativas)
- Sistema original que ya estaba implementado
- Las mesas son números correlativos (ej: 1-20, 21-35)
- No pueden haber superposiciones de rangos

### Mesas Alfanuméricas (NUEVO)
- Permite usar prefijos personalizados para identificar áreas
- Formato: `PREFIJO + NÚMERO` (ej: S1-01, S1-02, PISO1-01, VIP-01)
- Los números se formatean automáticamente con ceros a la izquierda
- Cada área puede tener su propio prefijo único

## Ejemplos de Uso

### Ejemplo 1: Salones
- **Salón 1**: Prefijo `S1-`, mesas del 01 al 20 → S1-01, S1-02, ..., S1-20
- **Salón 2**: Prefijo `S2-`, mesas del 01 al 15 → S2-01, S2-02, ..., S2-15

### Ejemplo 2: Pisos
- **Piso 1**: Prefijo `PISO1-`, mesas del 01 al 10 → PISO1-01, PISO1-02, ..., PISO1-10
- **Piso 2**: Prefijo `PISO2-`, mesas del 01 al 08 → PISO2-01, PISO2-02, ..., PISO2-08

### Ejemplo 3: Áreas VIP
- **Terraza**: Prefijo `T-`, mesas del 1 al 12 → T-01, T-02, ..., T-12
- **VIP**: Prefijo `VIP-`, mesas del 1 al 6 → VIP-01, VIP-02, ..., VIP-06
- **Bar**: Prefijo `BAR-`, mesas del 1 al 8 → BAR-01, BAR-02, ..., BAR-08

## Cómo Usar

1. **Acceder al módulo**: Ir a Configuraciones > Áreas y Mesas
2. **Seleccionar tipo**: Usar los botones superiores para elegir entre "Numéricas (Correlativas)" o "Alfanuméricas"
3. **Configurar área alfanumérica**:
   - Título del Área: Nombre descriptivo (ej: "Salón Principal")
   - Prefijo: Código identificador (ej: "S1-", "PISO1-", "VIP-")
   - Desde: Número inicial (ej: 1)
   - Hasta: Número final (ej: 20)
   - Vista Previa: Muestra cómo se verán las mesas (ej: "S1-01 al S1-20")
4. **Agregar**: Click en "+ Agregar"
5. **Guardar**: Click en "Guardar Cambios"

## Validaciones

- El título del área es obligatorio
- El prefijo es obligatorio
- Los números deben ser mayores a 0
- El número "hasta" debe ser mayor o igual que "desde"
- No puede haber superposición de rangos con el mismo prefijo

## Archivos Modificados/Creados

### Frontend
- `x-areas-mesas.html` - Componente principal con selector de modo
- `x-areas-mesas-alfanumericas.html` - Nuevo componente para mesas alfanuméricas

### Backend
- `log_009.php` - Agregados casos:
  - `op: 51` - Guardar áreas alfanuméricas
  - `op: 5101` - Cargar áreas alfanuméricas

### Base de Datos
- Tabla `area_mesa` - Agregados campos:
  - `tipo_mesa` VARCHAR(20) - Indica si es 'numerica' o 'alfanumerica'
  - `prefijo_mesa` VARCHAR(10) - Almacena el prefijo para mesas alfanuméricas

## Notas Técnicas

- Los dos sistemas (numérico y alfanumérico) son independientes
- Cada uno guarda y carga sus propias configuraciones
- El sistema numérico no se ve afectado por el alfanumérico
- Los registros existentes se marcan automáticamente como 'numerica'
