# Sistema de Solicitud de Productos entre Sedes

## Descripción General

Este módulo permite a las sedes de una organización solicitar productos (porciones y productos de almacén) a otras sedes, típicamente al almacén central. El sistema incluye:

- **Sugerencias inteligentes** con semaforización por nivel de stock
- **Gestión completa** del ciclo de vida de solicitudes
- **Seguimiento de estados**: enviado → visto → atendido → despachado
- **Búsqueda avanzada** de productos y porciones

## Arquitectura del Sistema

### Base de Datos

#### Tablas Principales

1. **`solicitud_producto`**: Almacena las solicitudes principales
   - Estados: enviado, visto, atendido, despachado, cancelado
   - Registra fechas de cada cambio de estado
   - Relaciona sede solicitante y sede destino

2. **`solicitud_producto_detalle`**: Detalles de cada solicitud
   - Soporta porciones (por código único) y productos de almacén
   - Registra cantidades solicitadas y despachadas
   - Guarda el stock al momento de la solicitud

3. **`solicitud_producto_historial`**: Auditoría de cambios
   - Registra todos los cambios de estado
   - Incluye usuario responsable y observaciones

#### Procedimientos Almacenados

- **`sp_crear_solicitud_producto`**: Crea solicitud con detalles en una transacción
- **`sp_cambiar_estado_solicitud`**: Actualiza estado y registra en historial

### Backend (PHP)

**Archivo**: `bdphp/log_011.php`

#### Endpoints Disponibles

| OP | Descripción | Método |
|----|-------------|--------|
| 1 | Obtener sugerencias (stock bajo) | POST |
| 2 | Listar sedes disponibles | POST |
| 3 | Crear nueva solicitud | POST |
| 4 | Listar solicitudes enviadas | POST |
| 5 | Listar solicitudes recibidas | POST |
| 6 | Obtener detalle de solicitud | POST |
| 7 | Cambiar estado de solicitud | POST |
| 8 | Obtener historial de cambios | POST |
| 9 | Actualizar cantidades despachadas | POST |
| 10 | Buscar productos/porciones | POST |
| 11 | Cancelar solicitud | POST |
| 12 | Obtener estadísticas | POST |

### Frontend (Polymer 1.0)

#### Componentes

1. **`x-solicitar-producto-main`**: Componente principal
   - Lista de solicitudes enviadas y recibidas
   - Sistema de pestañas (tabs)
   - Vista de detalle de solicitudes

2. **`x-solicitar-producto`**: Formulario de nueva solicitud
   - Sugerencias con semaforización
   - Búsqueda en tiempo real
   - Gestión de lista de productos

## Sistema de Semaforización

El sistema clasifica productos por nivel de stock:

- 🔴 **Rojo (Crítico)**: Stock < 10
- 🟡 **Amarillo (Bajo)**: Stock entre 10 y 30
- 🟢 **Verde (Normal)**: Stock > 30

### Implementación

```javascript
CASE 
    WHEN stock < 10 THEN 'rojo'
    WHEN stock >= 10 AND stock < 30 THEN 'amarillo'
    ELSE 'verde'
END AS semaforo
```

## Flujo de Trabajo

### 1. Crear Solicitud

```javascript
// Sede A solicita productos a Sede B (almacén)
const data = {
    idsede_destino: 2,
    nota: "Productos para fin de semana",
    detalle: [
        {
            tipo: "porcion",
            idporcion_codigo_unico: 5,
            descripcion: "Bistec 100gr",
            cantidad: 50,
            stock: 8,
            unidad: "unidades"
        },
        {
            tipo: "almacen",
            idproducto: 15,
            descripcion: "Aceite vegetal",
            cantidad: 5,
            stock: 3,
            unidad: "litros"
        }
    ]
};
```

### 2. Estados de la Solicitud

```
ENVIADO → VISTO → ATENDIDO → DESPACHADO
    ↓
CANCELADO (en cualquier momento)
```

### 3. Cambiar Estado

```javascript
// Marcar como vista
await httpFecht.postJson('log_011.php?op=7', {
    idsolicitud_producto: 123,
    estado: 'visto',
    observacion: 'Solicitud revisada'
});
```

## Características Principales

### Sugerencias Inteligentes

- Detecta automáticamente productos con stock bajo
- Ordena por criticidad (rojo → amarillo → verde)
- Muestra stock actual en tiempo real

### Búsqueda Avanzada

- Búsqueda en tiempo real (debounce 300ms)
- Busca en porciones y productos de almacén
- Filtra por nombre y código único

### Validaciones

- No permite duplicados en la lista
- Valida cantidades mínimas (> 0)
- Requiere selección de sede destino
- Verifica que haya al menos un producto

## Principios SOLID Aplicados

### Single Responsibility Principle (SRP)
- Cada función tiene una responsabilidad única
- Separación clara entre lógica de negocio y presentación

### Open/Closed Principle (OCP)
- Sistema extensible para nuevos tipos de productos
- Fácil agregar nuevos estados sin modificar código existente

### Liskov Substitution Principle (LSP)
- Productos y porciones se manejan de forma polimórfica
- Interfaz común para diferentes tipos de items

### Interface Segregation Principle (ISP)
- Endpoints específicos para cada operación
- No se fuerza a usar funcionalidades innecesarias

### Dependency Inversion Principle (DIP)
- Componentes dependen de abstracciones (httpFecht)
- Fácil cambiar implementación de backend

## Instalación

### 1. Ejecutar Migración de Base de Datos

```sql
SOURCE bdphp/MIGRACION_SOLICITUD_PRODUCTOS.sql;
```

### 2. Verificar Tablas Creadas

```sql
SHOW TABLES LIKE 'solicitud_producto%';
```

### 3. Importar Componentes en la Aplicación

```html
<link rel="import" href="app/page/x-solicitar-producto/x-solcitar-producto-main.html">
```

## Uso

### Acceder al Módulo

```javascript
// En el menú principal
<x-solicitar-producto-main></x-solicitar-producto-main>
```

### Crear Nueva Solicitud

1. Click en "Nueva Solicitud"
2. Seleccionar sede destino
3. Agregar productos desde sugerencias o búsqueda
4. Especificar cantidades
5. Agregar nota (opcional)
6. Click en "Enviar Solicitud"

### Ver Solicitudes

- **Mis Solicitudes**: Solicitudes que esta sede ha enviado
- **Solicitudes Recibidas**: Solicitudes que otras sedes han enviado a esta sede

### Gestionar Estados

```javascript
// Desde solicitudes recibidas
// Click en solicitud → Ver detalle → Cambiar estado
```

## Próximas Funcionalidades

- [ ] Módulo de recepción de productos
- [ ] Impresión de guías de despacho
- [ ] Notificaciones en tiempo real (Socket.IO)
- [ ] Dashboard de estadísticas
- [ ] Exportación a Excel/PDF
- [ ] Integración con sistema de inventario

## Notas Técnicas

### Compatibilidad
- Polymer 1.0
- MySQL 5.7+
- PHP 7.0+

### Rendimiento
- Índices optimizados en tablas
- Consultas con LIMIT para evitar sobrecarga
- Debounce en búsquedas

### Seguridad
- Validación de sesión (SecurityGuard)
- Prevención de inyección SQL
- Validación de permisos por sede

## Soporte

Para reportar problemas o sugerencias, contactar al equipo de desarrollo.

---

**Versión**: 1.0.0  
**Fecha**: Enero 2026  
**Autor**: Sistema RestoBar
