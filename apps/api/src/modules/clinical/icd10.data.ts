// Common ICD-10 codes for searchable diagnosis entry (US-CLIN-002).
// This is a curated subset for clinic use; in production this would be a
// full reference table or external terminology service.
export interface Icd10Code {
  code: string;
  description: string;
  category: string;
}

export const ICD10_CODES: Icd10Code[] = [
  // Symptoms & signs
  { code: 'R51', description: 'Headache', category: 'Symptoms' },
  { code: 'R51.9', description: 'Headache, unspecified', category: 'Symptoms' },
  { code: 'R05', description: 'Cough', category: 'Symptoms' },
  { code: 'R50.9', description: 'Fever, unspecified', category: 'Symptoms' },
  { code: 'R42', description: 'Dizziness and giddiness', category: 'Symptoms' },
  { code: 'R10.4', description: 'Other and unspecified abdominal pain', category: 'Symptoms' },
  { code: 'R07.4', description: 'Chest pain, unspecified', category: 'Symptoms' },
  { code: 'R53.83', description: 'Other fatigue', category: 'Symptoms' },
  { code: 'R06.02', description: 'Shortness of breath', category: 'Symptoms' },
  { code: 'R00.2', description: 'Palpitations', category: 'Symptoms' },
  { code: 'R11.10', description: 'Vomiting, unspecified', category: 'Symptoms' },
  { code: 'R19.7', description: 'Diarrhea, unspecified', category: 'Symptoms' },
  { code: 'R61.0', description: 'Generalized hyperhidrosis', category: 'Symptoms' },
  { code: 'R63.0', description: 'Anorexia', category: 'Symptoms' },
  { code: 'R63.4', description: 'Abnormal weight loss', category: 'Symptoms' },
  { code: 'R41.82', description: 'Altered mental status, unspecified', category: 'Symptoms' },
  { code: 'R41.0', description: 'Disorientation, unspecified', category: 'Symptoms' },
  { code: 'R44.0', description: 'Auditory hallucinations', category: 'Symptoms' },
  { code: 'R44.1', description: 'Visual hallucinations', category: 'Symptoms' },
  { code: 'R48.8', description: 'Other specified speech and language disturbances', category: 'Symptoms' },

  // Respiratory
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified', category: 'Respiratory' },
  { code: 'J02.9', description: 'Acute pharyngitis, unspecified', category: 'Respiratory' },
  { code: 'J03.90', description: 'Acute tonsillitis, unspecified', category: 'Respiratory' },
  { code: 'J11.1', description: 'Influenza with other respiratory manifestations', category: 'Respiratory' },
  { code: 'J45.901', description: 'Unspecified asthma with (acute) exacerbation', category: 'Respiratory' },
  { code: 'J44.9', description: 'Chronic obstructive pulmonary disease, unspecified', category: 'Respiratory' },
  { code: 'J20.9', description: 'Acute bronchitis, unspecified', category: 'Respiratory' },
  { code: 'J18.9', description: 'Pneumonia, unspecified organism', category: 'Respiratory' },

  // Infectious & parasitic
  { code: 'A09', description: 'Infectious gastroenteritis and colitis, unspecified', category: 'Infections' },
  { code: 'B34.9', description: 'Viral infection, unspecified', category: 'Infections' },
  { code: 'A49.9', description: 'Bacterial infection, unspecified', category: 'Infections' },

  // Circulatory
  { code: 'I10', description: 'Essential (primary) hypertension', category: 'Circulatory' },
  { code: 'I95.9', description: 'Hypotension, unspecified', category: 'Circulatory' },
  { code: 'I49.9', description: 'Cardiac arrhythmia, unspecified', category: 'Circulatory' },
  { code: 'I20.9', description: 'Angina pectoris, unspecified', category: 'Circulatory' },

  // Endocrine & metabolic
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', category: 'Endocrine' },
  { code: 'E66.9', description: 'Obesity, unspecified', category: 'Endocrine' },
  { code: 'E03.9', description: 'Hypothyroidism, unspecified', category: 'Endocrine' },
  { code: 'E78.5', description: 'Hyperlipidemia, unspecified', category: 'Endocrine' },

  // Mental & behavioural
  { code: 'F41.1', description: 'Generalized anxiety disorder', category: 'Mental health' },
  { code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified', category: 'Mental health' },
  { code: 'F43.10', description: 'Post-traumatic stress disorder, unspecified', category: 'Mental health' },
  { code: 'F90.9', description: 'Attention-deficit hyperactivity disorder, unspecified', category: 'Mental health' },
  { code: 'F84.0', description: 'Autistic disorder', category: 'Mental health' },

  // Nervous system
  { code: 'G40.909', description: 'Epilepsy, unspecified, not intractable', category: 'Nervous system' },
  { code: 'G35', description: 'Multiple sclerosis', category: 'Nervous system' },
  { code: 'G43.909', description: 'Migraine, unspecified, not intractable', category: 'Nervous system' },
  { code: 'G20', description: "Parkinson's disease", category: 'Nervous system' },

  // Genitourinary
  { code: 'N39.0', description: 'Urinary tract infection, site not specified', category: 'Genitourinary' },
  { code: 'N17.9', description: 'Acute kidney failure, unspecified', category: 'Genitourinary' },

  // Injuries
  { code: 'S09.90XA', description: 'Unspecified injury of head, initial encounter', category: 'Injury' },
  { code: 'T78.40XA', description: 'Allergy, unspecified, initial encounter', category: 'Injury' },
];

export function searchIcd10(query: string, limit = 20): Icd10Code[] {
  const q = query.trim().toLowerCase();
  if (!q) return ICD10_CODES.slice(0, limit);

  return ICD10_CODES.filter(
    (c) => c.code.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
  ).slice(0, limit);
}
