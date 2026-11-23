# Publicar MOSS Boutique en Hostinger

Cada vez que se sube un cambio a la rama `main` de GitHub:

1. GitHub compila la tienda (`.github/workflows/deploy.yml`) y publica el resultado en la rama `deploy`.
2. Hostinger recibe el aviso (webhook) y descarga la rama `deploy` en `public_html`.

Los datos (productos, pedidos, clientes y usuarios) se guardan en la base de datos **MySQL de Hostinger**, a través de la API en `api/`.

---

## Configuración (se hace una sola vez)

### 1. Base de datos en Hostinger
1. hPanel → **Bases de datos → Administración** → crea una base de datos MySQL con su usuario y contraseña.
2. Anota el nombre de la base, el usuario y la contraseña.

### 2. Archivo de configuración (fuera de `public_html`)
1. hPanel → **Archivos → Administrador de archivos**.
2. Entra a la carpeta del dominio. Es la que **contiene** `public_html`, por ejemplo `domains/tudominio.com/`.
3. Crea ahí el archivo `moss-config.php` con este contenido, poniendo tus datos:

```php
<?php
return [
    'db_host' => 'localhost',
    'db_port' => 3306,
    'db_name' => 'u123456789_moss',
    'db_user' => 'u123456789_moss',
    'db_pass' => 'la-contraseña-de-la-base',
];
```

Este archivo **nunca** se sube a GitHub. Al quedar fuera de `public_html`, no se puede abrir desde internet.

### 3. Versión de PHP
hPanel → **Avanzado → Configuración de PHP** → elige **PHP 8.2** o superior.

### 4. Conectar GitHub con Hostinger
1. Espera a que termine la primera publicación en GitHub (pestaña **Actions**, debe quedar en verde). Así se crea la rama `deploy`.
2. Si el repositorio es **privado**: hPanel → **Avanzado → Git** → copia la **clave SSH**. Luego en GitHub ve a **Settings → Deploy keys → Add deploy key**, pégala y guárdala (no hace falta permiso de escritura).
3. Vacía la carpeta `public_html`: borra `default.php` y cualquier otro archivo que tenga.
4. hPanel → **Avanzado → Git → Crear un nuevo repositorio**:
   - **Repositorio:** `git@github.com:USUARIO/moss-boutique.git` (privado) o `https://github.com/USUARIO/moss-boutique.git` (público)
   - **Rama:** `deploy`
   - **Directorio:** déjalo vacío (se instala en `public_html`)
5. En el repositorio creado, activa **Implementación automática** y copia la **URL del webhook**.
6. En GitHub → **Settings → Webhooks → Add webhook**:
   - **Payload URL:** la URL que copiaste
   - **Content type:** `application/json`
   - **Eventos:** *Just the push event*

### 5. Primer ingreso
Abre tu dominio. La primera vez, el sistema pide **crear la cuenta de administrador**. No hay usuarios ni contraseñas de prueba.

El catálogo inicial queda con **stock y costo en 0**. Cárgalos desde **Inventario**.

---

## Día a día
- Haz el cambio, súbelo a `main` y en uno o dos minutos queda publicado.
- En **Configuración → Datos y respaldo** puedes descargar una copia de seguridad completa.

## Desarrollo local
- Crea `api/config.local.php` con los datos de un MySQL local. Ese archivo no se sube a GitHub.
- Abre dos terminales:
  - Terminal 1: `php -S 127.0.0.1:8000 -t .`
  - Terminal 2: `npm run dev`. Vite envía las peticiones de `/api` al PHP local.
