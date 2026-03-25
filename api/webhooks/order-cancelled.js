import { createClient } from '@supabase/supabase-js'
import { verifyShopifyWebhook, getRawBody } from '../../lib/shopifyWebhookAuth.js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

const INSTANCE_ID = process.env.GREEN_API_INSTANCE_ID;
const TOKEN = process.env.GREEN_API_TOKEN;
const CHAT_ID = process.env.GREEN_API_GROUP_CHAT_ID;

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
  const { id, name } = JSON.parse(rawBody);

  if (!id) {
    return res.status(400).json({ success: false, error: 'Order ID is required' });
  }

  const shopifyId = id.toString();
  const orderName = name || shopifyId;
  let databaseSuccess = false;
  let whatsappSuccess = false;
  const errors = [];

  // 1. Delete from database (independent)
  try {
    const { data, error } = await supabase
      .from('orders')
      .delete()
      .eq('shopify_order_id', shopifyId)
      .select();

    if (error) throw error;

    if (!data || data.length === 0) {
      console.log(`Order ${shopifyId} not found in database (may not have been synced)`);
    } else {
      console.log(`Order ${shopifyId} removed from database`);
    }
    databaseSuccess = true;
  } catch (err) {
    console.error('Database deletion error:', err);
    errors.push({ service: 'Database', error: err.message });
  }

  // 2. Send WhatsApp notification (independent)
  try {
    const message = `❌ *طلب ملغي - ${orderName}*\n\nتم إلغاء الطلب وحذفه من قاعدة البيانات.`;

    const response = await fetch(
      `https://api.green-api.com/waInstance${INSTANCE_ID}/sendMessage/${TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: CHAT_ID, message })
      }
    );

    if (!response.ok) throw new Error(`Green API responded with ${response.status}`);

    console.log(`Cancellation WhatsApp sent for order ${orderName}`);
    whatsappSuccess = true;
  } catch (err) {
    console.error('WhatsApp send error:', err);
    errors.push({ service: 'WhatsApp', error: err.message });
  }

  return res.status(200).json({
    success: databaseSuccess || whatsappSuccess,
    databaseDeleted: databaseSuccess,
    whatsappSent: whatsappSuccess,
    orderName,
    errors: errors.length > 0 ? errors : undefined
  });
}
