# Resumen de Errores y Correcciones - Wiki AI

Este documento resume los problemas técnicos críticos identificados y resueltos recientemente en la aplicación.

## 1. Botón "Publish" Inoperativo
**Problema:** Al hacer clic en el botón "Publish" o "Save Draft" en el editor, no ocurría ninguna acción.
- **Causa Raíz:** El script `editor-client.js` no se estaba cargando en el navegador. Esto se debía a que la plantilla `layout_end.ejs` incluía el script condicionalmente basado en la variable `title`, la cual no estaba siendo enviada por las rutas de creación y edición en `src/routes/wiki.js`.
- **Solución:** 
    - Se actualizaron las rutas `/create` y `/wiki/:slug/edit` para pasar siempre la variable `title`.
    - Se refactorizó `editor-client.js` con guardas de seguridad (`if (element)`) y encadenamiento opcional para evitar que fallos en un componente detuvieran la ejecución del resto del script.
    - Se eliminaron manejadores `onclick` inline para cumplir plenamente con la política CSP.

## 2. Error 500 en "All Pages" (/indice)
**Problema:** Al acceder al índice alfabético de páginas, el servidor devolvía un error interno (500).
- **Causa Raíz:** Un error de sintaxis en la plantilla EJS `src/views/index_list.ejs`. Un comentario de JavaScript (`//`) dentro de un bloque `<% ... %>` estaba en la misma línea que la declaración de variables, lo que causaba que Node.js ignorara el resto de la lógica de agrupación en esa línea.
- **Solución:**
    - Se corrigió el formato del bloque EJS, separando los comentarios del código funcional.
    - Se añadió una validación para manejar casos donde una página pudiera no tener título (`p.title || 'Untitled'`), evitando fallos al intentar usar `.charAt(0)`.

---
*Estado: Ambos errores han sido verificados y corregidos en el entorno local.*
