import crypto from 'crypto';

/**
 * Helper to read raw body from request stream
 */
async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      resolve(data);
    });
    req.on('error', reject);
  });
}

/**
 * Verifies that a webhook request came from Shopify using HMAC-SHA256 signature
 * 
 * @param {Object} req - Next.js request object
 * @param {string} rawBody - Raw request body string
 * @returns {Object} { valid: boolean, error?: string }
 */
export function verifyShopifyWebhook(req, rawBody) {
  const WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET;

  // Check if secret is configured
  if (!WEBHOOK_SECRET) {
    console.error('SHOPIFY_WEBHOOK_SECRET is not configured');
    return { 
      valid: false, 
      error: 'Webhook authentication not configured' 
    };
  }

  // Extract HMAC from header
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  
  if (!hmacHeader) {
    console.warn('Webhook request missing X-Shopify-Hmac-SHA256 header');
    return { 
      valid: false, 
      error: 'Missing authentication header' 
    };
  }

  try {
    // Compute HMAC-SHA256 hash on raw body
    const hash = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(rawBody, 'utf8')
      .digest('base64');

    // Timing-safe comparison to prevent timing attacks
    const isValid = crypto.timingSafeEqual(
      Buffer.from(hash, 'base64'),
      Buffer.from(hmacHeader, 'base64')
    );

    if (!isValid) {
      console.warn('Webhook HMAC verification failed - possible unauthorized request');
      console.warn(`Expected: ${hash}`);
      console.warn(`Received: ${hmacHeader}`);
      return { 
        valid: false, 
        error: 'Invalid signature' 
      };
    }

    return { valid: true };

  } catch (error) {
    console.error('HMAC verification error:', error);
    return { 
      valid: false, 
      error: 'Verification failed' 
    };
  }
}

export { getRawBody };
