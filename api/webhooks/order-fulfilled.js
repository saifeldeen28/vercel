import { createClient } from '@supabase/supabase-js'
import { verifyShopifyWebhook } from '../../lib/shopifyWebhookAuth.js'
import { buffer } from 'micro'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

// Disable body parsing to get raw body for HMAC verification
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  // Get raw body for HMAC verification using micro's buffer
  const buf = await buffer(req);
  const rawBody = buf.toString('utf8');

  // Verify webhook authenticity
  const verification = verifyShopifyWebhook(req, rawBody);
  if (!verification.valid) {
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized' 
    });
  }

  // Parse body for processing
  const { id } = JSON.parse(rawBody);

  try {

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Order ID is required' 
      });
    }

    const shopifyId = id.toString();

    // Update order status to 'fulfilled'
    const { data, error } = await supabase
      .from('orders')
      .update({ status: 'fulfilled' })
      .eq('shopify_order_id', shopifyId)
      .select();

    if (error) {
      console.error('Database update error:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }

    // Check if order was found and updated
    if (!data || data.length === 0) {
      console.log(`Order ${shopifyId} not found in database (may not have been synced)`);
      return res.status(200).json({ 
        success: true, 
        message: 'Order not found in database',
        updated: false
      });
    }

    console.log(`Order ${shopifyId} marked as fulfilled`);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Order status updated to fulfilled',
      updated: true,
      orderName: data[0].order_name,
      previousStatus: data[0].status
    });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
