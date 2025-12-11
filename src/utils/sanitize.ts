export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

export function sanitizeEmail(email: string | undefined): string {
  if (!email || typeof email !== 'string') {
    return '';
  }

  return email
    .toLowerCase()
    .trim()
    .replace(/[<>\"']/g, '');
}

export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const sanitized = url
    .trim()
    .replace(/javascript:/gi, '')
    .replace(/<[^>]*>/g, '');

  try {
    const parsed = new URL(sanitized);
    if (parsed.protocol === 'javascript:' || parsed.protocol === 'data:') {
      return '';
    }
    return sanitized;
  } catch {
    return sanitized;
  }
}

export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

export function containsScriptTags(input: string): boolean {
  if (!input || typeof input !== 'string') {
    return false;
  }

  // Use String.search() instead of RegExp.test() to avoid lastIndex state issues with global regex
  // String.search() doesn't maintain lastIndex state, making it safe for repeated calls
  const scriptPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
  const iframePattern = /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi;
  const javascriptUrlPattern = /javascript:/gi;
  const eventHandlerPattern = /on\w+\s*=/gi;

  // String.search() doesn't maintain lastIndex state, making it safe for repeated calls
  return input.search(scriptPattern) !== -1 ||
         input.search(iframePattern) !== -1 ||
         input.search(javascriptUrlPattern) !== -1 ||
         input.search(eventHandlerPattern) !== -1;
}

