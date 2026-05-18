/**
 * QUALIFICATION ENGINE v1.0
 * Deterministic business rules extracted from n8n "Agente de Cualificación".
 */

export type QualificationStatus = "cualificado" | "no cualificado";

export interface LeadQualificationInput {
    nivel_estudios: string;
    years_experience: number | string;
    profession?: string;
    age?: number | string;
}

export interface QualificationResult {
    status: QualificationStatus;
    reason: string;
    normalized_studies: string;
    normalized_experience: string;
}

const NIVELES_ESTUDIOS = {
    POSTGRADO: "Estudios de Postgrado (Máster, Doctorado...)",
    UNIVERSITARIO: "Estudios Universitarios (Grado, Licenciatura, Diplomatura...)",
    TECNICO: "Estudios Técnicos (Formación Profesional no Universitaria o Tecnicatura)",
    PREUNIVERSITARIO: "Estudios Pre Universitarios (Bachillerato, COU)",
    BASICO: "Estudios mínimos obligatorios (E.S.O., BUP...)",
    SIN_ESTUDIOS: "Sin estudios (cursos...)"
};

const EXP_RANGES = ["0-5 años", "5-10 años", "10-20 años", "+20 años", "N/A"];

/**
 * Normalizes years of experience into defined buckets.
 */
function normalizeExperience(exp: number | string): string {
    const n = typeof exp === "string" ? parseInt(exp.replace(/\D/g, "")) : exp;
    if (isNaN(n)) return "N/A";
    if (n < 5) return "0-5 años";
    if (n < 10) return "5-10 años";
    if (n <= 20) return "10-20 años";
    return "+20 años";
}

/**
 * Normalizes study description into a technical category.
 */
function categorizeStudies(text: string): keyof typeof NIVELES_ESTUDIOS {
    const s = text.toLowerCase();
    
    if (/máster|maestría|doctorado|postgrado|especialidad/.test(s)) return "POSTGRADO";
    if (/licenciatura|grado|ingenier[íi]a|universidad|universitario|bachiller en/.test(s)) return "UNIVERSITARIO";
    if (/técnico|tecnicatura|fp|grado medio|grado superior|tecnologo/.test(s)) return "TECNICO";
    if (/bachillerato|cou/.test(s)) return "PREUNIVERSITARIO";
    if (/eso|bup|secundaria/.test(s)) return "BASICO";
    
    return "SIN_ESTUDIOS";
}

/**
 * Main evaluation logic matching n8n rules.
 */
export function evaluateLeadQualification(input: LeadQualificationInput): QualificationResult {
    const category = categorizeStudies(input.nivel_estudios);
    const expYears = typeof input.years_experience === "string" ? parseInt(input.years_experience.replace(/\D/g, "")) : input.years_experience;
    const normalizedExp = normalizeExperience(input.years_experience);
    
    // REGLA A: Universitario / Postgrado -> OK
    if (category === "UNIVERSITARIO" || category === "POSTGRADO") {
        return {
            status: "cualificado",
            reason: `Perfil cualificado por estudios de nivel ${category.toLowerCase()}.`,
            normalized_studies: NIVELES_ESTUDIOS[category],
            normalized_experience: normalizedExp
        };
    }

    // REGLA B: Técnico -> >= 3 años
    if (category === "TECNICO") {
        if (expYears >= 3) {
            return {
                status: "cualificado",
                reason: "Perfil cualificado por formación técnica con >= 3 años de experiencia.",
                normalized_studies: NIVELES_ESTUDIOS[category],
                normalized_experience: normalizedExp
            };
        }
        return {
            status: "no cualificado",
            reason: "Perfil no cualificado: formación técnica requiere al menos 3 años de experiencia.",
            normalized_studies: NIVELES_ESTUDIOS[category],
            normalized_experience: normalizedExp
        };
    }

    // REGLA C: Sin estudios / Básico -> >= 5 años
    if (expYears >= 5) {
        return {
            status: "cualificado",
            reason: "Perfil cualificado por experiencia profesional >= 5 años (sin estudios superiores).",
            normalized_studies: NIVELES_ESTUDIOS[category],
            normalized_experience: normalizedExp
        };
    }

    // Default: No cualificado
    return {
        status: "no cualificado",
        reason: "No cumple los requisitos mínimos de titulación o experiencia profesional.",
        normalized_studies: NIVELES_ESTUDIOS[category],
        normalized_experience: normalizedExp
    };
}
