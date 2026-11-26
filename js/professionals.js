/* Alpha 0.9 - Profesionales por curso y asignaciones a aulas */

const PROFESSIONAL_SPECIALTIES = [
  'PT',
  'AL',
  'Fisioterapeuta',
  'Orientación',
  'Técnico/a Educativo/a',
  'Enfermera',
  'Música',
  'Educación Física',
  'Religión',
  'TSIS (Técnico Superior en Integración Social)'
];

let selectedProfessionalId = null;

function ensureProfessionalModel(){
