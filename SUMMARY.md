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

### Trabajo Reciente y Completado:
*   **Corrección del Editor (Publicar/Guardar):** Se resolvió el problema de carga del script `editor-client.js` asegurando que las rutas envíen las variables de título necesarias. El editor es ahora robusto y compatible con CSP.
*   **Arreglo del Índice Alfabético:** Se corrigió un Error 500 en `/indice` causado por errores de sintaxis en la plantilla EJS y se añadieron validaciones de nulidad para títulos de página.
*   **Robustez de Scripts:** Se implementaron guardas de seguridad en todos los scripts del cliente (`search-client.js`, `activity-client.js`, `editor-client.js`) para prevenir fallos en cascada.

### Próximos Pasos:
1.  Realizar una prueba de regresión completa en las funciones de edición.
2.  Limpiar el código de bypass de autenticación local antes del despliegue a producción.
