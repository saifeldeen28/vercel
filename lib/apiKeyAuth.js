/**
 * Verifies that a request has a valid API key
 * Used to protect admin dispatch endpoints from unauthorized access
 * 
 * @param {Object} req - Next.js request object
 * @returns {Object} { valid: boolean, error?: string }
 */
export function verifyApiKey(req) {
  const API_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY;

  // Check if API key is configured
  if (!API_KEY) {
    console.error('NEXT_PUBLIC_ADMIN_API_KEY is not configured');
    return { 
      valid: false, 
      error: 'API authentication not configured' 
    };
  }

  // Extract Authorization header
  const authHeader = req.headers['authorization'];
  
  if (!authHeader) {
    console.warn('Request missing Authorization header');
    return { 
      valid: false, 
      error: 'Missing authorization header' 
    };
  }

  // Extract Bearer token
  const token = authHeader.replace(/^Bearer\s+/i, '');
  
  if (!token || token === authHeader) {
    console.warn('Authorization header malformed (expected "Bearer <token>")');
    return { 
      valid: false, 
      error: 'Invalid authorization format' 
    };
  }

  // Validate API key
  if (token !== API_KEY) {
    console.warn('API key validation failed - unauthorized access attempt');
    return { 
      valid: false, 
      error: 'Invalid API key' 
    };
  }

  return { valid: true };
}
