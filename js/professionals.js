/* Alpha 0.9.1 - acceso directo a la vista general del curso */
const originalRenderTreeWithProfessionals = renderTree;
renderTree = function renderTreeCourseHome(){
  originalRenderTreeWithProfessionals();
  const nav=document.getElementById('tree');
  if(!nav||!db.selected.courseId)return;
  const currentIsCourse=!db.selected.cycleId&&!db.selected.classId&&!db.selected.studentId&&!db.selected.evaluationId;
  const home=document.createElement('button');
  home.type='button';
  home.className='courseHomeNav'+(currentIsCourse?' on':'');
  home.innerHTML='<span class="courseHomeIcon">⌂</span><span><b>Vista general del curso</b><small>Ciclos y profesionales</small></span>';
  home.onclick=()=>selectCourse(db.selected.courseId);
  nav.prepend(home);
};

/* Alpha 0.9 - Profesionales por curso y asignaciones a aulas */
const PROFESSIONAL_SPECIALTIES=[
  'PT','AL','Fisioterapeuta','Orientación','Técnico/a Educativo/a','Enfermera',
  'Música','Educación Física','Religión','TSIS (Técnico Superior en Integración Social)'
];
let selectedProfessionalId=null;

function ensureProfessionalModel(){
  db.professionals=Array.isArray(db.professionals)?db.professionals:[];
  db.classProfessionals=Array.isArray(db.classProfessionals)?db.classProfessionals:[];
  db.classes.forEach(classroom=>{
    const cy=byId(db.cycles,classroom.cycleId),courseId=cy?.courseId;
    if(!courseId)return;
    if(!classroom.professionalsMigrated){
      (classroom.professionalList||[]).forEach(item=>{
        const name=String(item.name||'').trim();if(!name)return;
        let specialty=normalizeProfessionalSpecialty(item.role);
        let professional=db.professionals.find(p=>p.courseId===courseId&&p.name.toLowerCase()===name.toLowerCase()&&p.specialty===specialty);
        if(!professional){professional={id:id(),courseId,name,specialty};db.professionals.push(professional)}
        if(!db.classProfessionals.some(a=>a.classId===classroom.id&&a.professionalId===professional.id))db.classProfessionals.push({id:id(),classId:classroom.id,professionalId:professional.id,isTutor:item.role==='Tutor/a'});
      });
      const tutor=String(classroom.tutor||'').trim();
      if(tutor){
        let professional=db.professionals.find(p=>p.courseId===courseId&&p.name.toLowerCase()===tutor.toLowerCase());
        if(!professional){professional={id:id(),courseId,name:tutor,specialty:'PT'};db.professionals.push(professional)}
        db.classProfessionals.filter(a=>a.classId===classroom.id).forEach(a=>a.isTutor=false);
        let assignment=db.classProfessionals.find(a=>a.classId===classroom.id&&a.professionalId===professional.id);
        if(!assignment){assignment={id:id(),classId:classroom.id,professionalId:professional.id,isTutor:true};db.classProfessionals.push(assignment)}else assignment.isTutor=true;
      }
      classroom.professionalsMigrated=true;
    }
  });
  syncTutorFields();
}
function normalizeProfessionalSpecialty(value){const v=String(value||'').trim();if(PROFESSIONAL_SPECIALTIES.includes(v))return v;if(v==='Técnico/a educativo/a')return'Técnico/a Educativo/a';if(v==='Enfermería')return'Enfermera';if(v==='Tutor/a')return'PT';return PROFESSIONAL_SPECIALTIES.includes(v)?v:'PT'}
function professionalCourseId(classroom){return byId(db.cycles,classroom?.cycleId)?.courseId||null}
function courseProfessionals(courseId=db.selected.courseId){ensureProfessionalModel();return db.professionals.filter(p=>p.courseId===courseId).sort((a,b)=>a.name.localeCompare(b.name,'es'))}
function professionalAssignments(professionalId){ensureProfessionalModel();return db.classProfessionals.filter(a=>a.professionalId===professionalId)}
function assignedClasses(professionalId){return professionalAssignments(professionalId).map(a=>({assignment:a,classroom:byId(db.classes,a.classId)})).filter(x=>x.classroom)}
function classroomProfessionals(classId){ensureProfessionalModel();return db.classProfessionals.filter(a=>a.classId===classId).map(a=>({assignment:a,professional:byId(db.professionals,a.professionalId)})).filter(x=>x.professional)}
function tutorForClass(classId){return classroomProfessionals(classId).find(x=>x.assignment.isTutor)?.professional||null}
function canBeTutor(professional){return professional&&['PT','AL'].includes(professional.specialty)}
function syncTutorFields(){db.classes.forEach(c=>{const tutor=db.classProfessionals?.find(a=>a.classId===c.id&&a.isTutor),professional=tutor&&byId(db.professionals,tutor.professionalId);c.tutor=professional?.name||''})}
function persistProfessionals(){syncTutorFields();changed()}

const originalRenderCourse=renderCourse;
renderCourse=function renderCourseWithProfessionals(c){selectedProfessionalId=null;originalRenderCourse(c);appendCourseProfessionals(c)};
function appendCourseProfessionals(c){ensureProfessionalModel();if(!c)return;const section=document.createElement('section');section.className='card courseProfessionalsCard';section.innerHTML=`<div class="head"><div><h2>Profesionales del curso</h2><div class="muted">Equipo asociado a ${esc(c.name)} y aulas asignadas.</div></div><button class="btn primary" onclick="newProfessionalUI()">+ Nuevo profesional</button></div><div class="professionalFilters"><input id="professionalSearch" placeholder="Buscar por nombre…" oninput="renderProfessionalList()"><select id="professionalSpecialtyFilter" onchange="renderProfessionalList()"><option value="">Todas las especialidades</option>${PROFESSIONAL_SPECIALTIES.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></div><div id="courseProfessionalList"></div>`;content.appendChild(section);renderProfessionalList()}
function renderProfessionalList(){const term=(document.getElementById('professionalSearch')?.value||'').trim().toLowerCase(),specialty=document.getElementById('professionalSpecialtyFilter')?.value||'',list=document.getElementById('courseProfessionalList');if(!list)return;const rows=courseProfessionals().filter(p=>(!term||p.name.toLowerCase().includes(term))&&(!specialty||p.specialty===specialty));list.innerHTML=rows.length?`<div class="professionalCards">${rows.map(professionalCardHTML).join('')}</div>`:'<div class="emptyState">No hay profesionales que coincidan con el filtro.</div>'}
function professionalCardHTML(p){const classes=assignedClasses(p.id);return`<button class="professionalCard" onclick="openProfessional('${p.id}')"><span class="professionalAvatar">${esc(initials(p.name))}</span><span class="professionalCardBody"><b>${esc(p.name)}</b><small>${esc(p.specialty)}</small><span>${classes.length?classes.map(x=>esc(x.classroom.name)+(x.assignment.isTutor?' · Tutor/a':'')).join(' · '):'Sin aulas asignadas'}</span></span><span class="professionalArrow">›</span></button>`}
function initials(name){return String(name||'').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'P'}

function openProfessional(professionalId){selectedProfessionalId=professionalId;renderProfessionalDetail()}
function renderProfessionalDetail(){ensureProfessionalModel();const p=byId(db.professionals,selectedProfessionalId),c=course();if(!p)return renderCourse(c);const rows=assignedClasses(p.id);content.innerHTML=`<button class="btn noprint" onclick="selectedProfessionalId=null;renderCourse(course())">← Volver a profesionales</button><div class="hero viewGap"><div><div class="ey">Profesional · ${esc(c?.name||'')}</div><h1>${esc(p.name)}</h1><span class="tag ok">${esc(p.specialty)}</span></div><div class="actions noprint"><button class="btn" onclick="editProfessionalUI('${p.id}')">Editar</button><button class="btn primary" onclick="assignProfessionalUI('${p.id}')">+ Asignar aula</button><button class="btn danger" onclick="deleteProfessionalCourse('${p.id}')">Eliminar</button></div></div><section class="card"><h2>Datos del profesional</h2><div class="grid"><div class="field"><label>Nombre y apellidos</label><input value="${esc(p.name)}" oninput="updateProfessionalCourse('${p.id}','name',this.value)"></div><div class="field"><label>Especialidad</label><select onchange="updateProfessionalCourse('${p.id}','specialty',this.value)">${PROFESSIONAL_SPECIALTIES.map(v=>`<option value="${esc(v)}" ${p.specialty===v?'selected':''}>${esc(v)}</option>`).join('')}</select></div></div></section><section class="card"><div class="head"><div><h2>Aulas asignadas</h2><div class="muted">${rows.length} aula/s del curso.</div></div><button class="btn primary noprint" onclick="assignProfessionalUI('${p.id}')">+ Asignar aula</button></div><div class="professionalAssignments">${rows.map(x=>assignmentRowHTML(p,x)).join('')||'<div class="emptyState">Este profesional no está asignado a ninguna aula.</div>'}</div></section>`}
function assignmentRowHTML(p,x){const cy=cycleOf(x.classroom);return`<div class="professionalAssignment"><div><b>${esc(x.classroom.name)}</b><span>${esc(cy?.name||'Sin ciclo')}</span></div><label class="tutorCheck ${canBeTutor(p)?'':'disabled'}"><input type="checkbox" ${x.assignment.isTutor?'checked':''} ${canBeTutor(p)?'':'disabled'} onchange="setAssignmentTutor('${x.assignment.id}',this.checked)"> Tutor/a</label><button class="btn sm danger noprint" onclick="removeProfessionalAssignment('${x.assignment.id}')">Quitar</button></div>`}
function updateProfessionalCourse(idValue,key,value){const p=byId(db.professionals,idValue);if(!p)return;p[key]=value;if(key==='specialty'&&!canBeTutor(p))professionalAssignments(p.id).forEach(a=>a.isTutor=false);persistProfessionals()}
function newProfessionalUI(){showModal('Nuevo profesional',professionalFormHTML(null,'createProfessionalCourse()'))}
function editProfessionalUI(idValue){const p=byId(db.professionals,idValue);if(!p)return;showModal('Editar profesional',professionalFormHTML(p,`saveProfessionalCourse('${p.id}')`))}
function professionalFormHTML(p,action){return`<div class="field"><label>Nombre y apellidos</label><input id="professionalNameInput" value="${esc(p?.name||'')}" autofocus></div><div class="field"><label>Especialidad</label><select id="professionalSpecialtyInput">${PROFESSIONAL_SPECIALTIES.map(v=>`<option value="${esc(v)}" ${p?.specialty===v?'selected':''}>${esc(v)}</option>`).join('')}</select></div><div class="modalActions"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="${action}">Guardar</button></div>`}
function createProfessionalCourse(){ensureProfessionalModel();const name=professionalNameInput.value.trim();if(!name)return alert('Escribe el nombre y apellidos.');const duplicate=courseProfessionals().some(p=>p.name.toLowerCase()===name.toLowerCase()&&p.specialty===professionalSpecialtyInput.value);if(duplicate)return alert('Ya existe un profesional con ese nombre y especialidad en el curso.');db.professionals.push({id:id(),courseId:db.selected.courseId,name,specialty:professionalSpecialtyInput.value});closeModal();persistProfessionals();renderCourse(course())}
function saveProfessionalCourse(idValue){const p=byId(db.professionals,idValue),name=professionalNameInput.value.trim();if(!p||!name)return;p.name=name;p.specialty=professionalSpecialtyInput.value;if(!canBeTutor(p))professionalAssignments(p.id).forEach(a=>a.isTutor=false);closeModal();persistProfessionals();selectedProfessionalId=p.id;renderProfessionalDetail()}
function deleteProfessionalCourse(idValue){const p=byId(db.professionals,idValue);if(!p)return;const count=professionalAssignments(idValue).length;if(!confirm(`¿Eliminar a ${p.name}?${count?`\n\nSe eliminarán también ${count} asignación/es a aulas.`:''}`))return;db.classProfessionals=db.classProfessionals.filter(a=>a.professionalId!==idValue);db.professionals=db.professionals.filter(x=>x.id!==idValue);selectedProfessionalId=null;persistProfessionals();renderCourse(course())}
function assignProfessionalUI(idValue){const p=byId(db.professionals,idValue);if(!p)return;const assigned=new Set(professionalAssignments(idValue).map(a=>a.classId)),classes=db.classes.filter(c=>professionalCourseId(c)===p.courseId);showModal('Asignar aulas',`<div class="assignmentPicker">${classes.map(c=>`<label><input type="checkbox" data-class-id="${c.id}" ${assigned.has(c.id)?'checked':''}> <span><b>${esc(c.name)}</b><small>${esc(cycleOf(c)?.name||'Sin ciclo')}</small></span></label>`).join('')||'<div class="emptyState">No hay aulas en este curso.</div>'}</div><div class="modalActions"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveProfessionalAssignments('${p.id}')">Guardar asignaciones</button></div>`)}
function saveProfessionalAssignments(professionalId){const selected=new Set([...document.querySelectorAll('.assignmentPicker input:checked')].map(x=>x.dataset.classId));db.classProfessionals=db.classProfessionals.filter(a=>a.professionalId!==professionalId||selected.has(a.classId));selected.forEach(classId=>{if(!db.classProfessionals.some(a=>a.professionalId===professionalId&&a.classId===classId))db.classProfessionals.push({id:id(),classId,professionalId,isTutor:false})});closeModal();persistProfessionals();selectedProfessionalId=professionalId;renderProfessionalDetail()}
function removeProfessionalAssignment(assignmentId){if(!confirm('¿Quitar este profesional del aula?'))return;db.classProfessionals=db.classProfessionals.filter(a=>a.id!==assignmentId);persistProfessionals();renderProfessionalDetail()}
function setAssignmentTutor(assignmentId,checked){const a=byId(db.classProfessionals,assignmentId),p=a&&byId(db.professionals,a.professionalId);if(!a||!p||!canBeTutor(p))return;if(checked)db.classProfessionals.filter(x=>x.classId===a.classId).forEach(x=>x.isTutor=false);a.isTutor=checked;persistProfessionals();renderProfessionalDetail()}

const originalRenderClass=renderClass;
renderClass=function renderClassWithAssignedProfessionals(classroom){ensureProfessionalModel();originalRenderClass(classroom);document.querySelector('.professionalsWrap')?.remove();appendClassProfessionals(classroom)};
function appendClassProfessionals(classroom){const rows=classroomProfessionals(classroom.id),tutor=rows.find(x=>x.assignment.isTutor);const section=document.createElement('section');section.className='card assignedProfessionalsCard';section.innerHTML=`<div class="head"><div><h2>Profesionales del aula</h2><div class="muted">${tutor?`Tutor/a: ${esc(tutor.professional.name)} · ${esc(tutor.professional.specialty)}`:'Sin tutor/a asignado'}</div></div><button class="btn primary noprint" onclick="assignClassProfessionalsUI('${classroom.id}')">+ Asignar profesional</button></div><div class="classProfessionalList">${rows.map(x=>`<div class="classProfessionalRow"><button onclick="openProfessional('${x.professional.id}')"><span class="professionalAvatar">${esc(initials(x.professional.name))}</span><span><b>${esc(x.professional.name)}</b><small>${esc(x.professional.specialty)}${x.assignment.isTutor?' · Tutor/a':''}</small></span></button><button class="btn sm danger noprint" onclick="removeClassProfessional('${x.assignment.id}','${classroom.id}')">Quitar</button></div>`).join('')||'<div class="emptyState">No hay profesionales asignados.</div>'}</div>`;content.appendChild(section)}
function assignClassProfessionalsUI(classId){const classroom=byId(db.classes,classId),available=courseProfessionals(professionalCourseId(classroom)),assigned=new Set(classroomProfessionals(classId).map(x=>x.professional.id));showModal('Asignar profesionales al aula',`<div class="assignmentPicker">${available.map(p=>`<label><input type="checkbox" data-professional-id="${p.id}" ${assigned.has(p.id)?'checked':''}> <span><b>${esc(p.name)}</b><small>${esc(p.specialty)}</small></span></label>`).join('')||'<div class="emptyState">Primero crea profesionales en la vista del curso.</div>'}</div><div class="modalActions"><button class="btn" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveClassProfessionals('${classId}')">Guardar asignaciones</button></div>`)}
function saveClassProfessionals(classId){const selected=new Set([...document.querySelectorAll('.assignmentPicker input:checked')].map(x=>x.dataset.professionalId));db.classProfessionals=db.classProfessionals.filter(a=>a.classId!==classId||selected.has(a.professionalId));selected.forEach(professionalId=>{if(!db.classProfessionals.some(a=>a.classId===classId&&a.professionalId===professionalId))db.classProfessionals.push({id:id(),classId,professionalId,isTutor:false})});closeModal();persistProfessionals();renderClass(byId(db.classes,classId))}
function removeClassProfessional(assignmentId,classId){if(!confirm('¿Quitar este profesional del aula?'))return;db.classProfessionals=db.classProfessionals.filter(a=>a.id!==assignmentId);persistProfessionals();renderClass(byId(db.classes,classId))}

const originalRenderEvaluation=renderEvaluation;
renderEvaluation=function renderEvaluationWithRelationalTutor(studentValue,evaluationValue){ensureProfessionalModel();const classroom=byId(db.classes,evaluationValue?.classId),tutor=classroom&&tutorForClass(classroom.id);if(classroom)classroom.tutor=tutor?.name||'';return originalRenderEvaluation(studentValue,evaluationValue)};
