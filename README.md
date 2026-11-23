# Evaluaciones Iniciales Alpha 0.8 Modular

Baseline: Alpha 0.7.

## Ejecución
Publicar la carpeta completa en GitHub Pages. No abrir `index.html` como `file://` para Google Drive.

## Carga
1. `core.js` - modelo, estado y utilidades.
2. `ui.js` - navegación, cursos, aulas, alumnos y profesionales.
3. `storage/drive.js` - cifrado y proveedores Drive / File System Access.
4. `evaluations.js` - motor completo de evaluación.
5. `app.js` - arranque.

Los archivos fachada documentan la arquitectura objetivo. En esta primera modularización conservadora no se han aislado más símbolos para evitar regresiones por orden de carga.
