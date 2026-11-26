/* Alpha 0.9.11 - dueño definitivo del menú lateral. CARGAR DESPUÉS de professionals.js */
function openCourseProfessionalsRoot(){
  selectedProfessionalId=null;
  selectCourse(db.selected.courseId);
  requestAnimationFrame(()=>document.querySelector('.courseProfessionalsCard')?.scrollIntoView({behavior:'smooth',block:'start'}));
}
renderTree=function(){
  const c=course();
  const courseSelected=!!c&&!db.selected.cycleId&&!db.selected.classId&&!db.selected.studentId&&!db.selected.evaluationId;
  courseSelect.innerHTML=db.courses.map(x=>`<option value="${x.id}" ${x.id===db.selected.courseId?'selected':''}>${esc(x.name)}</option>`).join('');
  if(!c){tree.innerHTML='';return}
  const professionals=`<button type="button" class="navProfessionals" onclick="openCourseProfessionalsRoot()"><span class="navProfessionalsIcon">P</span><span>Profesionales</span></button>`;
  const cycles=db.cycles.filter(x=>x.courseId===c.id).map(cy=>`<div class="treeCycle"><div class="cycleRow"><button class="cycleToggle" title="${cy.open?'Colapsar':'Expandir'}" onclick="event.stopPropagation();toggleCycle('${cy.id}')">${cy.open?'−':'+'}</button><button class="cycleName ${cy.id===db.selected.cycleId&&!db.selected.classId?'on':''}" onclick="openCycle('${cy.id}')">${esc(cy.name)}</button></div><div class="rooms ${cy.open?'':'hidden'}">${db.classes.filter(x=>x.cycleId===cy.id).map(r=>{const rows=studentsInClass(r.id),opened=r.id===db.selected.classId;return`<div class="treeRoom"><div class="roomRow"><button class="roomToggle" title="${opened?'Ocultar alumnos':'Mostrar alumnos'}" onclick="event.stopPropagation();toggleRoom('${r.id}')">${opened?'−':'+'}</button><button class="room ${opened&&!db.selected.studentId?'on':''}" onclick="openClass('${r.id}')">${esc(r.name)} <span class="roomCount">${rows.length}</span></button></div><div class="treeStudents ${opened?'':'hidden'}">${rows.map(({student:st,enrollment:en})=>{const promoted=en.status==='completed'&&db.promotions.some(p=>p.fromEnrollmentId===en.id);return`<button class="treeStudent ${st.id===db.selected.studentId?'on':''}" onclick="openStudent('${st.id}')"><span>${esc(st.name)}</span>${promoted?'<small>P</small>':en.status==='active'?'<small>A</small>':''}</button>`}).join('')||'<div class="muted treeEmpty">Sin alumnos</div>'}</div></div>`}).join('')||'<div class="muted treeEmpty">Sin aulas</div>'}</div></div>`).join('');
  tree.innerHTML=`<button type="button" class="navCourse ${courseSelected?'on':''}" onclick="selectCourse('${c.id}')">${esc(c.name)}</button><div class="navCourseChildren">${professionals}${cycles}</div>`;
};
