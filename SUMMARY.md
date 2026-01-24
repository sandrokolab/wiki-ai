# Proyecto: Wiki AI - Resumen de Arquitectura y Estado

Este documento proporciona una visión general técnica de la arquitectura actual, la configuración de infraestructura en Railway y el estado del desarrollo del proyecto Wiki AI.

## 1. Arquitectura del Sistema

El proyecto sigue un patrón **MVC (Model-View-Controller)** monolítico, optimizado para simplicidad y rendimiento.

*   **Backend:** Node.js con el framework **Express**.
*   **Frontend:** Plantillas **EJS** (Embedded JavaScript) para el renderizado del lado del servidor, con componentes dinámicos en JavaScript vanilla integrados en un sistema de clientes distribuidos (`src/public/*.js`).
*   **Base de Datos:** **PostgreSQL** administrado a través de `pg` (node-postgres). El esquema incluye tablas para:
    *   `users`: Gestión de cuentas y autenticación.
    *   `pages`: Artículos de la wiki (títulos, slugs, contenido en Markdown).
    *   `topics`: Categorización jerárquica de páginas.
    *   `page_revisions`: Historial de versiones para cada página.
    *   `activity_log`: Registro de acciones globales.
    *   `favorites`: Relación de seguimiento entre usuarios, temas y páginas.
*   **Autenticación:** Basada en sesiones nativas (`express-session`) con contraseñas cifradas mediante `bcrypt`.
*   **Seguridad:** Implementación de cabeceras **Helmet**, protección XSS y Content Security Policy (CSP) para prevenir ataques de inyección.

## 2. Variables de Entorno (Railway)

Para que el proyecto funcione correctamente en el entorno de Railway, se deben configurar las siguientes variables:

| Variable | Descripción | Ejemplo / Notas |
|---|---|---|
| `DATABASE_URL` | URL de conexión principal a PostgreSQL. | `postgres://user:pass@host:port/db` |
| `DB_URL` | Alias alternativo para la base de datos (usado en `database.js`). | Igual a `DATABASE_URL` |
| `SESSION_SECRET` | Clave secreta para firmar las cookies de sesión. | `un-string-aleatorio-y-seguro` |
| `PORT` | Puerto en el que escucha el servidor (Railway lo asigna automáticamente). | `3000` |
| `NODE_ENV` | Define si el entorno es de desarrollo o producción. | `production` o `development` |

## 3. Estado del Desarrollo

### Funcionalidades Completadas:
*   Sistema de creación y edición de páginas con soporte para Markdown.
*   Gestión de revisiones y capacidad de restauración de versiones anteriores.
*   Navegación por categorías y temas (topics).
*   Búsqueda dinámica de contenidos.
*   Registro y login de usuarios con perfiles básicos.
*   Feed de actividad reciente.

### Trabajo Reciente y en Curso:
*   **Refactorización de Seguridad (CSP):** Se han eliminado los manejadores de eventos inline (`onclick`) en todo el editor para cumplir con políticas de seguridad estrictas. El editor ahora usa listeners de eventos puramente en el cliente.
*   **Bypass de Desarrollo Local:** Se añadió un mecanismo temporal en el middleware de autenticación para facilitar pruebas en local cuando la base de datos no es accesible.
*   **Depuración del Editor:** Actualmente se está resolviendo un problema de carga del script `editor-client.js`. Se han añadido logs de diagnóstico para rastrear la ejecución en el navegador y asegurar que el servidor envíe las variables correctas a las plantillas.

### Próximos Pasos:
1.  Verificar la carga correcta de scripts tras la actualización de las rutas (`wiki.js`).
2.  Validar el flujo completo de "Publish" (Publicar) una vez que los listeners se activen.
3.  Limpiar el código de bypass local antes del despliegue final a producción.
