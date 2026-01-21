# Seguridad del Sistema

Este documento describe las medidas de seguridad implementadas en el sistema.

## Protección de Datos Sensibles

### 1. Carpetas Protegidas con .htaccess

Las siguientes carpetas están protegidas contra acceso directo vía web:

- **`/data/`** - Contiene archivos de configuración (config.json, categories.json, photos.json)
  - ❌ Antes: Accesible vía `https://tudominio.com/data/config.json`
  - ✅ Ahora: HTTP 403 Forbidden

- **`/backups/`** - Contiene backups del sistema
  - ❌ Antes: Descargables vía URL directa
  - ✅ Ahora: HTTP 403 Forbidden

**Archivos de protección:**
- `data/.htaccess` - Bloquea acceso a todos los archivos JSON
- `backups/.htaccess` - Bloquea descarga directa de backups

### 2. Hashing de Contraseñas

Las contraseñas del administrador ya NO se almacenan en texto plano.

#### Sistema Actual (Seguro)

- **Almacenamiento**: Contraseñas hasheadas con bcrypt (PHP `password_hash()`)
- **Verificación**: PHP `password_verify()`
- **Costo**: Algoritmo bcrypt con costo 10 (por defecto)
- **Formato**: `$2y$10$...` (60 caracteres)

#### Migración Automática

El sistema detecta automáticamente contraseñas en texto plano y las migra:

1. Usuario inicia sesión con contraseña plaintext (legacy)
2. Sistema verifica credenciales
3. Si la contraseña actual es plaintext, se convierte automáticamente a hash
4. Próximo login ya usa el hash

**No se requiere acción manual** - La migración es transparente.

#### Cambio de Contraseña

Al cambiar la contraseña desde el panel admin:
- La nueva contraseña se hashea automáticamente con bcrypt
- Nunca se almacena en texto plano

## Mejores Prácticas

### Para Instalaciones Nuevas

1. **Cambiar credenciales por defecto** inmediatamente después de instalar
2. **Usar contraseñas fuertes** (mínimo 12 caracteres, mezcla de letras, números y símbolos)
3. **Verificar permisos**:
   ```bash
   chmod 755 data/
   chmod 644 data/.htaccess
   chmod 755 backups/
   chmod 644 backups/.htaccess
   ```

### Para Instalaciones Existentes

Si ya tienes el sistema instalado:

1. ✅ La migración de contraseñas es automática (al próximo login)
2. ✅ Los archivos `.htaccess` se desplegarán automáticamente
3. ⚠️ **IMPORTANTE**: Verifica que tu hosting soporte archivos `.htaccess`
   - La mayoría de hostings cPanel lo soportan
   - Si usas Nginx, necesitarás configuración equivalente

