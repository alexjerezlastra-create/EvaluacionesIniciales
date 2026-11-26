# Actualización Alpha 0.8.2 - Evaluaciones

Copiar:
- `js/evaluations-0.8.2.js`
- `css/evaluation-0.8.2.css`

En `index.html`, después de `css/evaluation.css`:
```html
<link rel="stylesheet" href="css/evaluation-0.8.2.css">
```

Y después de `js/evaluations.js`, antes de `js/app.js`:
```html
<script src="js/evaluations-0.8.2.js"></script>
```

Cambios:
- Combobox propio para Rutina y Facilitador/Barrera: siempre muestra todas las opciones y admite texto libre.
- Tooltips hacia abajo.
- Nuevos indicadores AP con cinco opciones por defecto:
  Adulto de referencia, Otro adulto, Igual/compañero, Apoyo del entorno/material y Otro.
- Los apoyos ya guardados no se modifican.
