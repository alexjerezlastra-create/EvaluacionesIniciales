/* Alpha 0.8.2 - ajustes localizados del modulo de evaluaciones */
(() => {
  'use strict';

  const DEFAULT_AP_OPTIONS = [
    'Adulto de referencia',
    'Otro adulto',
    'Igual/compañero',
    'Apoyo del entorno/material',
    'Otro'
  ];

  // Solo afecta a indicadores nuevos. Los apoyos existentes se conservan.
  window.makeAP = function makeAP082() {
    return {
      options: DEFAULT_AP_OPTIONS.map(text => apOption(text)),
      what: '',
      how: '',
      when: '',
      detail: ''
    };
  };

  function comboId(kind, pi, ri) {
    return `combo_${kind}_${pi}_${ri}`;
  }

  function uniqueOptions(values) {
    return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))];
  }

  function routineOptions() {
    return ['Bienvenida', 'Desayuno'];
  }

  function facilitatorOptions(participation) {
    return uniqueOptions((participation.options || []).map(option => option.text));
  }

  function comboHTML({ kind, pi, ri, value, options, placeholder }) {
    const id = comboId(kind, pi, ri);
    const safeValue = esc(value || '');
    const optionRows = uniqueOptions(options).map(option => `
      <button type="button" class="evalComboOption${option === value ? ' selected' : ''}"
              data-value="${esc(option)}"
              onclick="selectEvaluationCombo('${kind}',${pi},${ri},this.dataset.value)">
        ${esc(option)}
      </button>`).join('');

    return `<div class="evalCombo" id="${id}">
      <div class="evalComboControl">
        <input type="text" value="${safeValue}" placeholder="${esc(placeholder)}"
               autocomplete="off"
               onfocus="openEvaluationCombo('${kind}',${pi},${ri})"
               oninput="inputEvaluationCombo('${kind}',${pi},${ri},this.value)">
        <button type="button" class="evalComboToggle" aria-label="Mostrar opciones"
                onclick="toggleEvaluationCombo('${kind}',${pi},${ri})">▼</button>
      </div>
      <div class="evalComboMenu" role="listbox">
        ${optionRows}
        <div class="evalComboFree">También puedes escribir un valor distinto.</div>
      </div>
    </div>`;
  }

  window.participationHTML = function participationHTML082(d) {
    d = normalizeEvaluationData(d);
    return `<section id="part" class="card section">
      <div class="head">
        <div>
          <h2>Participación y contexto</h2>
          <div class="muted">Añade una fila por rutina e indica el facilitador, condición o barrera correspondiente.</div>
        </div>
      </div>
      ${d.participation.map((p, pi) => `
        <div class="participationBlock">
          <div class="head">
            <h3>${esc(p.title)}</h3>
            <button type="button" class="btn sm noprint" onclick="addParticipationRow(${pi})">+ Fila</button>
          </div>
          <div class="participationRows">
            <div class="participationHeader">
              <span>Rutina</span>
              <span>${participationSecondLabel(p.title)}</span>
              <span class="noprint"></span>
            </div>
            ${(p.rows || []).map((row, ri) => `
              <div class="participationRow">
                ${comboHTML({kind:'routine', pi, ri, value:row.routine, options:routineOptions(), placeholder:'Selecciona o escribe una rutina'})}
                ${comboHTML({kind:'facilitator', pi, ri, value:row.facilitator, options:facilitatorOptions(p), placeholder:'Selecciona o escribe libremente'})}
                <button type="button" class="btn sm danger noprint" onclick="deleteParticipationRow(${pi},${ri})">Eliminar</button>
              </div>`).join('') || '<div class="participationEmpty">No hay filas. Pulsa “+ Fila”.</div>'}
          </div>
        </div>`).join('')}
    </section>`;
  };

  window.openEvaluationCombo = function(kind, pi, ri) {
    closeAllEvaluationCombos();
    document.getElementById(comboId(kind, pi, ri))?.classList.add('open');
  };

  window.toggleEvaluationCombo = function(kind, pi, ri) {
    const combo = document.getElementById(comboId(kind, pi, ri));
    if (!combo) return;
    const shouldOpen = !combo.classList.contains('open');
    closeAllEvaluationCombos();
    if (shouldOpen) {
      combo.classList.add('open');
      combo.querySelector('input')?.focus();
    }
  };

  window.closeAllEvaluationCombos = function() {
    document.querySelectorAll('.evalCombo.open').forEach(el => el.classList.remove('open'));
  };

  window.inputEvaluationCombo = function(kind, pi, ri, value) {
    const key = kind === 'routine' ? 'routine' : 'facilitator';
    updateParticipationRow(pi, ri, key, value);
    const combo = document.getElementById(comboId(kind, pi, ri));
    if (!combo) return;
    combo.classList.add('open');
    const query = value.trim().toLocaleLowerCase('es');
    combo.querySelectorAll('.evalComboOption').forEach(option => {
      option.hidden = Boolean(query) && !option.dataset.value.toLocaleLowerCase('es').includes(query);
    });
  };

  window.selectEvaluationCombo = function(kind, pi, ri, value) {
    const key = kind === 'routine' ? 'routine' : 'facilitator';
    updateParticipationRow(pi, ri, key, value);
    const combo = document.getElementById(comboId(kind, pi, ri));
    if (combo) combo.querySelector('input').value = value;
    closeAllEvaluationCombos();
  };

  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('.evalCombo')) closeAllEvaluationCombos();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeAllEvaluationCombos();
  });
})();
