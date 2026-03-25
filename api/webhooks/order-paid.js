import { createClient } from '@supabase/supabase-js'
import { verifyShopifyWebhook, getRawBody } from '../../lib/shopifyWebhookAuth.js'

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

  // Get raw body for HMAC verification
  const rawBody = await getRawBody(req);

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

    // Update order status to 'paid'
    const { data, error } = await supabase
      .from('orders')
      .update({ status: 'paid' })
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

    console.log(`Order ${shopifyId} marked as paid`);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Order status updated to paid',
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
