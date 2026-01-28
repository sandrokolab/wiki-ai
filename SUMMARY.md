# Proyecto: Wiki AI - Resumen de Arquitectura y Estado

Este documento proporciona una visión general técnica de la arquitectura actual, la configuración de infraestructura en Railway y el estado del desarrollo del proyecto Wiki AI.

## 1. Arquitectura del Sistema

El proyecto sigue un patrón **MVC (Model-View-Controller)** monolítico, optimizado para simplicidad y rendimiento.

*   **Backend:** Node.js con el framework **Express**.
*   **Frontend:** Plantillas **EJS** (Embedded JavaScript) para el renderizado del lado del servidor, con componentes dinámicos en JavaScript vanilla integrados en un sistema de clientes distribuidos (`src/public/*.js`).
*   **Base de Datos:** **PostgreSQL** (Servicio: `Postgres-VQvv` en Railway). El esquema está diseñado para **soporte multi-wiki**, permitiendo múltiples instancias independientes en la misma base de datos. Incluye tablas para:
    *   `wikis`: Registro de las wikis independientes (slug, nombre, configuración).
    *   `users`: Gestión de cuentas y autenticación.
    *   `pages`: Artículos de la wiki (títulos, slugs, contenido en Markdown).
    *   `topics`: Categorización jerárquica de páginas.
    *   `page_revisions`: Historial de versiones para cada página.
    *   `activity_log`: Registro de acciones globales y específicas de página.
    *   `favorites`: Relación de seguimiento entre usuarios, temas y páginas.
    *   `comments`: Hilos de conversación en páginas con soporte para adjuntos e interacción.
    *   `notifications`: Registro de alertas para menciones de usuarios y actividades relevantes.
    *   `comment_reactions`: Almacenamiento de reacciones (like, love, etc.) vinculadas a usuarios y comentarios.
    *   *Nota:* La mayoría de las tablas (`pages`, `topics`, `activity_log`, `comments`) están vinculadas a `wikis` mediante `wiki_id`.
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
*   Gestión de revisiones y restauración de versiones.
*   Navegación por categorías y temas.
*   Búsqueda dinámica con filtrado avanzado.
*   Registro y login de usuarios con perfiles.
*   Feed de actividad global y por página.
*   Sistema de comentarios con archivos, menciones y reacciones.

### Trabajo Reciente y Completado:
*   **Corrección del Editor (Publicar/Guardar):** Se resolvió el problema de carga del script `editor-client.js`.
*   **Arreglo del Índice Alfabético:** Se corrigió el Error 500 en `/indice` y se añadieron validaciones de nulidad.
*   **Mejora de la UI de Páginas:** Rediseño de cabeceras con metadatos claros y barra de acciones moderna.
*   **Sistema de Comentarios e Interacción:** Implementación de hilo de comentarios con pestañas, emojis, adjuntos y menciones (@).
*   **Corrección de Asociación Topic-Page:** Optimización de `getByCategory` para vinculación precisa de temas y categorías.
*   **Seguridad y Menciones:** Sistema de búsqueda dinámica de usuarios y notificaciones en tiempo real para menciones.
*   **Búsqueda Global Refinada:** Integración de comentarios en los resultados de búsqueda con iconos y snippets contextuales.
*   **Reacciones en Comentarios:** Implementación de un sistema de reacciones (Pulp-style) con persistencia en base de datos y actualización dinámica en la UI.
*   **Filtrado Avanzado de Búsqueda:** Adición de un panel de filtros en la barra de búsqueda que permite filtrar por rango de fecha (Hoy, Semana, Mes) y tipo de contenido (Páginas/Comentarios).
*   **Arquitectura Multi-Wiki Scoped:** Refactorización completa para soportar múltiples wikis. Implementación de middleware de resolución de wiki, rutas bajo `/w/:wiki_slug/`, y un sistema global de navegación (`wikiUrl`) que asegura que todos los enlaces y llamadas a la API estén restringidos a la wiki actual.
*   **Panel de Administración Centralizado:** Implementación de una suite administrativa protegida por middleware de autorización (`role: admin`). Incluye dashboards de estadísticas globales y gestión masiva de usuarios, wikis y páginas.
*   **Perfiles de Usuario Dinámicos:** Rediseño de perfiles con estadísticas en tiempo real (páginas, ediciones, comentarios) y una línea de tiempo de actividad personalizada y filtrada por usuario.
*   **Resolución Definitiva de Inicialización de DB:** Migración exitosa a una base de datos limpia (`Postgres-VQvv`) tras detectar corrupción en el servicio original. Se implementó una lógica de inicialización en 4 fases desacopladas que garantiza la creación de columnas `wiki_id` y restricciones en el orden correcto, logrando un despliegue 100% estable.
*   **Seeding Temprano y Resiliencia de Wiki:** Refactorización de `database.js` para crear la wiki por defecto "general" en la Fase 1.5 de inicialización. Esto garantiza que la plataforma esté operativa inmediatamente después del arranque, incluso si las tareas de indexación complejas aún están en proceso.
*   **Fortalecimiento del Motor de Vistas (EJS):** Implementación de una configuración robusta con rutas absolutas resueltas (`path.resolve`) y registros redundantes para eliminar errores de renderizado en entornos de producción (Railway).
*   **Diagnóstico Integrado en Producción:** Adición de logs de depuración dinámica en las rutas principales para monitorear el estado de las variables de aplicación (`view engine`, `views`) en tiempo real durante las peticiones en vivo.

### Próximos Pasos:
1.  Añadir soporte para exportación de páginas en formato PDF.
2.  Implementar un sistema de badges/logros basado en las estadísticas de contribución.
3.  Finalizar la migración de la gestión de sesiones de memoria RAM a PostgreSQL (`connect-pg-simple`) para evitar desconexiones accidentales tras reinicios del servidor.

