import crypto from 'crypto';

/**
 * Helper to read raw body from request stream
 * Works with Vercel's serverless functions
 */
async function getRawBody(req) {
  // If body is already a string (Vercel sometimes does this)
  if (typeof req.body === 'string') {
    console.log('getRawBody: Body already string, length:', req.body.length);
    return req.body;
  }
  
  // If body is a buffer
  if (Buffer.isBuffer(req.body)) {
    console.log('getRawBody: Body is buffer, length:', req.body.length);
    return req.body.toString('utf8');
  }
  
  // Read from stream
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalLength = 0;
    
    req.on('data', chunk => {
      chunks.push(chunk);
      totalLength += chunk.length;
      console.log('getRawBody: Received chunk, size:', chunk.length);
    });
    
    req.on('end', () => {
      if (chunks.length === 0) {
        console.error('getRawBody: No data received from stream!');
        resolve('');
        return;
      }
      const rawBody = Buffer.concat(chunks).toString('utf8');
      console.log('getRawBody: Complete. Total bytes:', totalLength, 'String length:', rawBody.length);
      resolve(rawBody);
    });
    
    req.on('error', (err) => {
      console.error('getRawBody: Stream error:', err);
      reject(err);
    });
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

  console.log('=== HMAC Verification Start ===');
  
  // Check if secret is configured
  if (!WEBHOOK_SECRET) {
    console.error('SHOPIFY_WEBHOOK_SECRET is not configured');
    return { 
      valid: false, 
      error: 'Webhook authentication not configured' 
    };
  }

  console.log('Secret configured:', WEBHOOK_SECRET.substring(0, 10) + '...');
  console.log('Secret length:', WEBHOOK_SECRET.length);

  // Extract HMAC from header
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];
  
  if (!hmacHeader) {
    console.warn('Webhook request missing X-Shopify-Hmac-SHA256 header');
    console.log('Available headers:', Object.keys(req.headers));
    return { 
      valid: false, 
      error: 'Missing authentication header' 
    };
  }

  console.log('HMAC header present:', hmacHeader.substring(0, 20) + '...');

  // Check raw body
  if (!rawBody || rawBody.length === 0) {
    console.error('Raw body is empty! Cannot verify HMAC.');
    return {
      valid: false,
      error: 'Empty request body'
    };
  }

  console.log('Raw body length:', rawBody.length);
  console.log('Raw body preview (first 200 chars):', rawBody.substring(0, 200));

  try {
    // Compute HMAC-SHA256 hash on raw body
    const hash = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(rawBody, 'utf8')
      .digest('base64');

    console.log('Computed HMAC:', hash);
    console.log('Received HMAC:', hmacHeader);
    console.log('HMACs match:', hash === hmacHeader);

    // Timing-safe comparison to prevent timing attacks
    let isValid;
    try {
      isValid = crypto.timingSafeEqual(
        Buffer.from(hash, 'base64'),
        Buffer.from(hmacHeader, 'base64')
      );
    } catch (e) {
      console.error('timingSafeEqual error:', e.message);
      // Fallback to simple comparison if buffers are different lengths
      isValid = (hash === hmacHeader);
    }

    if (!isValid) {
      console.warn('❌ Webhook HMAC verification FAILED');
      console.warn('This means either:');
      console.warn('1. Wrong SHOPIFY_WEBHOOK_SECRET in environment');
      console.warn('2. Request not from Shopify');
      console.warn('3. Body was modified in transit');
      return { 
        valid: false, 
        error: 'Invalid signature' 
      };
    }

    console.log('✅ HMAC verification SUCCESSFUL');
    console.log('=== HMAC Verification End ===');
    return { valid: true };

  } catch (error) {
    console.error('HMAC verification exception:', error);
    console.error('Stack:', error.stack);
    return { 
      valid: false, 
      error: 'Verification failed: ' + error.message 
    };
  }
}

export { getRawBody };
