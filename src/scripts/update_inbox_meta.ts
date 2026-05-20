import fs from 'fs';
import path from 'path';

const filePath = path.resolve('d:\\esden-dashboard\\src\\components\\agents\\AIAgentInbox.tsx');

function main() {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Find start and end markers
  const startMarker = `{/* Build unified list: all metadata keys + pending tracked vars */}`;
  const endMarker = `const hasAnything = capturedKeys.length > 0 || pendingVars.length > 0;`;
  
  const startIndex = content.indexOf(startMarker);
  const endIndex = content.indexOf(endMarker);
  
  if (startIndex === -1 || endIndex === -1) {
    console.error('Start or End marker not found in AIAgentInbox.tsx');
    return;
  }
  
  const prefix = content.substring(0, startIndex + startMarker.length);
  const suffix = content.substring(endIndex);
  
  const replacement = `
                                 {(() => {
                                     // 1. Create a normalized copy of metadata (uppercase keys, internal spaces removed)
                                     const meta: Record<string, any> = {};
                                     if (selectedLead.metadata) {
                                         Object.entries(selectedLead.metadata).forEach(([k, val]) => {
                                             const normKey = k.replace(/\\s+/g, '').toUpperCase();
                                             
                                             // If we already have a value for this key, prioritize clean relative days over hallucinated ISO dates
                                             if (meta[normKey]) {
                                                 const currentVal = String(meta[normKey]).trim();
                                                 const newVal = String(val).trim();
                                                 
                                                 // List of human-friendly days/dates to preserve
                                                 const isHumanDate = (s: string) => {
                                                     const l = s.toLowerCase();
                                                     return l.includes('lunes') || l.includes('martes') || 
                                                            l.includes('miércoles') || l.includes('jueves') || 
                                                            l.includes('viernes') || l.includes('sábado') || 
                                                            l.includes('domingo') || (!s.includes('2023-10-10') && s.length < 20);
                                                 };

                                                 if (isHumanDate(currentVal) && newVal.includes('2023-10-10')) {
                                                     return; // Preserve the human selected day (e.g., "Martes")
                                                 }
                                                 if (newVal.includes('2023-10-10') && !currentVal.includes('2023-10-10')) {
                                                     return; // Prevent overwriting with hallucinated date
                                                 }
                                             }
                                             meta[normKey] = val;
                                         });
                                     }

                                     // 2. Map known equivalents
                                     if (meta.ESTADO_CONVERSACION && !meta.CONVERSATION_STATUS) {
                                         meta.CONVERSATION_STATUS = meta.ESTADO_CONVERSACION;
                                     }
                                     if (meta.MOTIVOS_DESCARTE && !meta.MOTIVO_DESCARTE) {
                                         meta.MOTIVO_DESCARTE = meta.MOTIVOS_DESCARTE;
                                     }
                                     if (meta.FECHA_DE_AGENDA && !meta.FECHA_AGENDA) {
                                         meta.FECHA_AGENDA = meta.FECHA_DE_AGENDA;
                                     }

                                     // 3. Fallbacks and defaults requested by the user
                                     // Show the external CRM lead ID under ID_LEAD, showing "null" if not present
                                     if (!meta.ID_LEAD) {
                                         meta.ID_LEAD = selectedLead.id_lead_externo || "null";
                                     }
                                     // If there is no discard reason, show "null"
                                     if (!meta.MOTIVO_DESCARTE) {
                                         meta.MOTIVO_DESCARTE = "null";
                                     }
                                     // If no Q&A topic, show "null"
                                     if (!meta.QA_TOPIC) {
                                         meta.QA_TOPIC = "null";
                                     }

                                     // Exclude system keys and redundant original keys to avoid duplicate green boxes
                                     const SKIP_KEYS = new Set([
                                         'LAST_FACT_UPDATE', 
                                         'META_ID', 
                                         'RAW', 
                                         'MEDIA_URL', 
                                         'ESTADO_CONVERSACION', 
                                         'MOTIVOS_DESCARTE', 
                                         'FECHA_DE_AGENDA',
                                         'DATE_TIME_PREFERRED',
                                         'SCHEDULED_CALL_CONFIRMED'
                                     ]);
                                     
                                     // 4. All captured keys from normalized metadata (excluding system keys)
                                     const rawKeys = Object.keys(meta).filter(k => 
                                         !SKIP_KEYS.has(k) && String(meta[k]).trim() !== ''
                                     );
                                     
                                     const capturedKeys: string[] = [];
                                     const seenKeys = new Set<string>();
                                     rawKeys.forEach(k => {
                                         if (!seenKeys.has(k.toUpperCase())) {
                                             capturedKeys.push(k.toUpperCase());
                                             seenKeys.add(k.toUpperCase());
                                         }
                                     });

                                     // 5. Pending tracked vars (those NOT already in normalized metadata)
                                     const pendingVars = trackedVariables
                                         .map(v => v.replace(/^{{|\}}$/g, '').trim().toUpperCase())
                                         .filter(k => {
                                             const value = meta[k];
                                             return !value || String(value).trim() === '' || String(value).toLowerCase() === 'pendiente...';
                                         });

                                     console.log("[DEBUG SIDEBAR DETAILED] Selected Lead:", selectedLead.nombre, {
                                         metaKeys: Object.keys(meta),
                                         metaValues: Object.values(meta),
                                         trackedVariables,
                                         capturedKeys,
                                         pendingVars
                                     });

                                     `;
                                     
  const newContent = prefix + replacement + suffix;
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log('Successfully adjusted AIAgentInbox.tsx to prioritize human-friendly selected dates over post-analysis hallucinations!');
}

main();
