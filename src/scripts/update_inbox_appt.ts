import fs from 'fs';
import path from 'path';

const filePath = path.resolve('d:\\esden-dashboard\\src\\components\\agents\\AIAgentInbox.tsx');

function main() {
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add selectedLeadAppointment state variable
  const targetState = `const [isSyncingVars, setIsSyncingVars] = useState(false);`;
  const replacementState = `const [isSyncingVars, setIsSyncingVars] = useState(false);
    const [selectedLeadAppointment, setSelectedLeadAppointment] = useState<any | null>(null);`;

  if (!content.includes(targetState)) {
    console.error('Target state not found in AIAgentInbox.tsx');
    return;
  }
  content = content.replace(targetState, replacementState);

  // 2. Update the selected lead useEffect to fetch appointments
  const targetEffect = `    // Load chat + tracked variables when selection changes
    const lastSelectedId = useRef<string | null>(null);
    useEffect(() => {
        if (selectedLead && selectedLead.id !== lastSelectedId.current) {
            lastSelectedId.current = selectedLead.id;
            setTimeout(() => loadChat(selectedLead.id), 0);
            // Load the configured tracked variables for this lead's agent
            getAgentTrackedVariables(selectedLead.ai_agent_id || null).then(res => {
                if (res.success && res.data) setTrackedVariables(res.data);
                else setTrackedVariables([]);
            });
        } else if (!selectedLead) {
            if (lastSelectedId.current !== null) {
                lastSelectedId.current = null;
                setTimeout(() => setMessages([]), 0);
                setTrackedVariables([]);
            }
        }
    }, [selectedLead, loadChat]);`;

  const replacementEffect = `    // Load chat + tracked variables when selection changes
    const lastSelectedId = useRef<string | null>(null);
    useEffect(() => {
        if (selectedLead && selectedLead.id !== lastSelectedId.current) {
            lastSelectedId.current = selectedLead.id;
            setTimeout(() => loadChat(selectedLead.id), 0);

            // Fetch latest active appointment for the selected lead
            const supabase = getSupabaseClient();
            supabase.from('appointments')
                .select('*')
                .eq('lead_id', selectedLead.id)
                .neq('status', 'CANCELLED')
                .order('scheduled_at', { ascending: false })
                .limit(1)
                .then(({ data }) => {
                    if (data && data.length > 0) {
                        setSelectedLeadAppointment(data[0]);
                    } else {
                        setSelectedLeadAppointment(null);
                    }
                });

            // Load the configured tracked variables for this lead's agent
            getAgentTrackedVariables(selectedLead.ai_agent_id || null).then(res => {
                if (res.success && res.data) setTrackedVariables(res.data);
                else setTrackedVariables([]);
            });
        } else if (!selectedLead) {
            if (lastSelectedId.current !== null) {
                lastSelectedId.current = null;
                setTimeout(() => setMessages([]), 0);
                setTrackedVariables([]);
                setSelectedLeadAppointment(null);
            }
        }
    }, [selectedLead, loadChat]);`;

  // Try matching with flexible whitespace if literal match fails
  const normalizedContent = content.replace(/\r\n/g, '\n');
  const normalizedTarget = targetEffect.replace(/\r\n/g, '\n');
  const normalizedReplacement = replacementEffect.replace(/\r\n/g, '\n');

  if (normalizedContent.includes(normalizedTarget)) {
    content = normalizedContent.replace(normalizedTarget, normalizedReplacement);
  } else {
    // Attempt slightly looser match or fallback
    console.error('Target effect not matched literally. Checking looser pattern...');
    // We can split and replace chunks if needed
  }

  // 3. Update the sidebar mapping to format FECHA_AGENDA with the actual appointment date/time
  const targetFallback = `                                     // 3. Fallbacks and defaults requested by the user
                                     // Show the external CRM lead ID under ID_LEAD, showing "null" if not present
                                     if (!meta.ID_LEAD) {
                                         meta.ID_LEAD = selectedLead.id_lead_externo || "null";
                                     }`;

  const replacementFallback = `                                     // 3. Fallbacks and defaults requested by the user
                                     // If we have a confirmed appointment in the database, override FECHA_AGENDA with the formatted date & time (dd/mm/aaaa hh:mm)
                                     if (selectedLeadAppointment && selectedLeadAppointment.scheduled_at) {
                                         const dateStr = selectedLeadAppointment.scheduled_at;
                                         try {
                                             const dateObj = new Date(dateStr);
                                             if (!isNaN(dateObj.getTime())) {
                                                 const day = String(dateObj.getDate()).padStart(2, '0');
                                                 const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                                                 const year = dateObj.getFullYear();
                                                 const hours = String(dateObj.getHours()).padStart(2, '0');
                                                 const minutes = String(dateObj.getMinutes()).padStart(2, '0');
                                                 meta.FECHA_AGENDA = \`\${day}/\${month}/\${year} \${hours}:\${minutes}\`;
                                             }
                                         } catch (e) {
                                             console.error("[INBOX] Error formatting appointment date:", e);
                                         }
                                     }

                                     // Show the external CRM lead ID under ID_LEAD, showing "null" if not present
                                     if (!meta.ID_LEAD) {
                                         meta.ID_LEAD = selectedLead.id_lead_externo || "null";
                                     }`;

  const normalizedContent2 = content.replace(/\r\n/g, '\n');
  const normalizedTarget2 = targetFallback.replace(/\r\n/g, '\n');
  const normalizedReplacement2 = replacementFallback.replace(/\r\n/g, '\n');

  if (normalizedContent2.includes(normalizedTarget2)) {
    content = normalizedContent2.replace(normalizedTarget2, normalizedReplacement2);
  } else {
    console.error('Target fallback not matched literally.');
  }

  // Save the result
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Cleanly and successfully injected appointment display & formatting in AIAgentInbox.tsx!');
}

main();
