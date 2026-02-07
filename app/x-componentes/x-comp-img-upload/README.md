# Componente de Carga de Imágenes con Búsqueda Múltiple

Componente mejorado para subir y editar imágenes de platos, con búsqueda de imágenes profesionales en **Pexels + Unsplash**.

## 🎯 Características

### Modo 1: Subir Foto
- **Drag & Drop**: Arrastra imágenes directamente al área de carga
- **Cropper.js**: Editor profesional de imágenes
  - ✂️ Recortar con proporción automática
  - 🔄 Rotar (izquierda/derecha)
  - 🔃 Voltear (horizontal/vertical)
  - 🎯 Zoom y reposicionamiento
  - ↩️ Resetear cambios
- **Optimización automática**: Redimensiona a las medidas configuradas
- **Alta calidad**: Exporta en JPEG con calidad 90%

### Modo 2: Buscar Imagen
- **Búsqueda combinada**: Resultados de **Pexels + Unsplash** simultáneamente
- **Más variedad**: Hasta 15 imágenes mezcladas de ambas fuentes
- **Indicador de fuente**: Cada imagen muestra si viene de Pexels o Unsplash
- **Alta calidad**: Fotos profesionales de alta resolución
- **100% Gratis**: Ambas APIs sin costo
  - Pexels: 200 requests/hora
  - Unsplash: 50 requests/hora
- **Uso comercial**: Todas las fotos permiten uso comercial
- **Edición integrada**: Las imágenes seleccionadas se cargan en Cropper para ajustar

## 📦 Uso del Componente

### En tu HTML:
```html
<x-comp-img-upload id="compImgItem" medidasimg="[[medidaImgCarta]]"></x-comp-img-upload>
```

### Configurar medidas:
```javascript
// En tu componente Polymer
xThisCarta.medidaImgCarta = {
    width: 365,
    height: 210
}
```

### Obtener la imagen:
```javascript
const compImgItem = document.getElementById('compImgItem');

// Obtener imagen en base64
const imagenBase64 = compImgItem.getImgBase64();

// Verificar si se estableció una imagen
const seEstablecio = compImgItem.getIsEstablecioImg();

// Verificar si es imagen subida (vs generada con IA)
const esSubida = compImgItem.getIsUploadImg();
```

### Establecer imagen desde ruta:
```javascript
compImgItem.setImgPathFile('../../file/platos/ceviche.jpg');
```

### Resetear el componente:
```javascript
compImgItem.resetControl();
```

## ⚙️ Configuración de APIs

### Archivo: `bdphp/pexels_config.php`

**API 1: Pexels (REQUERIDA)**
1. Visita https://www.pexels.com/api/
2. Haz clic en "Get Started"
3. Crea una cuenta o inicia sesión
4. Completa el formulario describiendo tu proyecto
5. Acepta los términos de servicio
6. Recibirás tu API key inmediatamente
7. Configura:
```php
define('PEXELS_API_KEY', 'tu-api-key-aqui');
```

**API 2: Unsplash (OPCIONAL pero recomendada)**
1. Visita https://unsplash.com/developers
2. Haz clic en "Register as a developer"
3. Crea una cuenta o inicia sesión
4. Crea una nueva aplicación
5. Copia tu "Access Key"
6. Configura:
```php
define('UNSPLASH_ACCESS_KEY', 'tu-access-key-aqui');
```

### Límites del plan gratuito:
**Pexels:**
- ✅ 200 requests por hora
- ✅ Sin límite mensual
- ✅ Atribución recomendada pero no obligatoria

**Unsplash:**
- ✅ 50 requests por hora
- ✅ Fotos de muy alta calidad
- ⚠️ Atribución REQUERIDA (ya incluida automáticamente)

**Combinadas:**
- 🎯 Hasta 250 búsquedas por hora
- 🎯 Mayor variedad de resultados
- 🎯 Todas permiten uso comercial

## 🔍 Ejemplos de Búsquedas

### Buenos términos para platos peruanos:
```
"ceviche fish dish"
"peruvian food"
"lomo saltado beef"
"causa potato"
"anticuchos grilled"
"arroz con mariscos seafood rice"
"aji de gallina chicken"
"tacu tacu beans rice"
```

### Términos generales:
```
"pasta dish"
"pizza food"
"burger meal"
"salad bowl"
"dessert cake"
"soup bowl"
"grilled chicken vegetables"
"seafood platter"
```

### Consejos para mejores resultados:
- ✅ Usa términos en **inglés** (mejores resultados)
- ✅ Sé específico con los ingredientes
- ✅ Combina términos: "grilled fish lemon"
- ✅ Usa la orientación "Horizontal" para platos
- ❌ Evita términos muy específicos de tu región

## 🔧 Métodos del Componente

| Método | Descripción | Retorno |
|--------|-------------|---------|
| `getImgBase64()` | Obtiene la imagen en formato base64 | String |
| `getIsEstablecioImg()` | Verifica si se estableció una imagen | Boolean |
| `getIsUploadImg()` | Verifica si es imagen subida (vs IA) | Boolean |
| `setImgPathFile(path)` | Establece imagen desde ruta | void |
| `resetControl()` | Resetea el componente | void |
| `setMedidas(medida)` | Cambia las medidas del recorte | void |

## 📁 Estructura de Archivos

```
app/x-componentes/x-comp-img-upload/
├── x-comp-img-upload.html          # Componente principal
└── README.md                        # Esta documentación

bdphp/
├── pexels_search.php               # Backend para búsqueda en Pexels
└── pexels_config.php               # Configuración de API key
```

## 🚀 Ventajas sobre el componente anterior

| Característica | Antes (Croppie) | Ahora (Cropper.js + Pexels) |
|----------------|-----------------|------------------------------|
| Interfaz | Básica | Moderna y profesional |
| Drag & Drop | ❌ | ✅ |
| Controles | Limitados | Completos (rotar, flip, reset) |
| Búsqueda de imágenes | ❌ | ✅ Millones de fotos |
| Calidad imagen | Media | Alta (profesional) |
| UX | Confusa | Intuitiva |
| Costo | - | Gratis |

## 💡 Casos de Uso

### 1. Plato con foto disponible
1. Click en "📤 Subir Foto"
2. Arrastra la imagen o selecciona archivo
3. Ajusta el recorte, rota si es necesario
4. Click en "Establecer"

### 2. Plato sin foto disponible
1. Click en "🔍 Buscar Imagen"
2. Escribe el nombre del plato (en inglés preferiblemente)
3. Selecciona la orientación (Horizontal recomendado)
4. Click en "🔍 Buscar" o presiona Enter
5. Espera unos segundos
6. Selecciona la imagen que más te guste de la galería

## ⚠️ Notas Importantes

- **Pexels es 100% gratuito** con 200 requests/hora
- Las fotos son **profesionales** y de alta calidad
- **Uso comercial permitido** sin restricciones
- Atribución al fotógrafo es **recomendada** (ya incluida automáticamente)
- Las API keys deben mantenerse **privadas** (no subir a Git)
- El componente es **compatible** con el código existente
- Búsquedas en **inglés** dan mejores resultados

## 🐛 Solución de Problemas

### La búsqueda no funciona
- Verifica que `bdphp/pexels_search.php` exista
- Revisa que hayas configurado tu API key en `bdphp/pexels_config.php`
- Comprueba la consola del navegador para errores
- Verifica que el servidor tenga acceso a internet
- Asegúrate de no haber excedido el límite de 200 requests/hora

### No se encuentran imágenes
- Intenta con términos en **inglés**
- Usa términos más generales: "fish dish" en lugar de "ceviche peruano"
- Prueba diferentes combinaciones de palabras
- Cambia la orientación a "Todas"

### Las imágenes se ven distorsionadas
- Ajusta las medidas en `medidasimg`
- Usa el botón "Resetear" en el cropper
- Verifica que las proporciones sean correctas

### El drag & drop no funciona
- Verifica que uses un navegador moderno
- Comprueba que no haya conflictos con otros scripts
- Revisa la consola para errores JavaScript

### Error 429 (Too Many Requests)
- Has excedido el límite de 200 requests/hora
- Espera una hora para que se resetee el contador
- Considera crear múltiples API keys si necesitas más requests

## 📞 Soporte

Para más información:
- Pexels API: https://www.pexels.com/api/documentation/
- Cropper.js: https://github.com/fengyuanchen/cropperjs
- Términos de Pexels: https://www.pexels.com/license/
