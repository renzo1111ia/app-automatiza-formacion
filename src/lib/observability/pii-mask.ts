/**
 * Enmascara datos personales (PII) en un texto dado.
 * Reemplaza correos y números de teléfono.
 */
export function maskPII(text: string): string {
  if (!text) return text;

  let maskedText = text;

  // Mask emails: a***b@domain.com
  const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
  maskedText = maskedText.replace(emailRegex, (match) => {
    const [name, domain] = match.split("@");
    if (!name || !domain) return match;
    const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : "***";
    return `${maskedName}@${domain}`;
  });

  // Mask phones (simple generic regex for illustration, E.164 or similar)
  // Replaces digits with asterisks, keeping the last 3 visible
  const phoneRegex = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3}\)?[\s-]?)?\d{3}[\s-]?\d{4}/g;
  maskedText = maskedText.replace(phoneRegex, (match) => {
    const digitsOnly = match.replace(/\D/g, "");
    if (digitsOnly.length < 7) return match; // Not a phone
    return match.replace(/\d/g, (d, idx, fullString) => {
      // Keep last 3 digits
      const digitsCount = fullString.replace(/\D/g, "").length;
      let currentDigitIndex = 0;
      for (let i = 0; i <= idx; i++) {
        if (/\d/.test(fullString[i])) currentDigitIndex++;
      }
      return currentDigitIndex > digitsCount - 3 ? d : "*";
    });
  });

  return maskedText;
}

/**
 * Enmascara PII en un objeto u array anidado.
 */
export function maskObjectPII(obj: unknown): unknown {
  if (typeof obj === "string") {
    return maskPII(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(maskObjectPII);
  }
  if (obj !== null && typeof obj === "object") {
    const newObj: Record<string, unknown> = {};
    for (const key in obj as Record<string, unknown>) {
      newObj[key] = maskObjectPII((obj as Record<string, unknown>)[key]);
    }
    return newObj;
  }
  return obj;
}
