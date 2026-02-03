import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

export default async function handler(req, res) {
  // Only allow POST requests from Shopify
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const body = req.body;
    
    // Shopify sends the order ID as 'id' or 'admin_graphql_api_id'
    const shopifyId = body.id.toString(); 

    // 1. Insert Order (Using upsert to avoid errors on duplicate webhooks)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .upsert([{ 
        shopify_order_id: shopifyId, 
        customer_name: body.customer?.first_name || 'Guest',
        total_price: body.total_price,
        delivery_area: body.shipping_address?.city || 'Not Specified', // Grab the area!
        status: 'pending'
      }], { onConflict: 'shopify_order_id' })
      .select()

    if (orderError) throw orderError;

    // 2. Insert Items (Clear old items first if this is an update)
    await supabase.from('order_items').delete().eq('order_id', order[0].id);

    const items = body.line_items.map(item => ({
      order_id: order[0].id,
      item_name: item.title,
      quantity: item.quantity
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(items);
    if (itemsError) throw itemsError;

    // 3. Trigger Telegram Notification
    // You'll call your bot function here next!
    console.log(`Order ${shopifyId} synced successfully.`);

    return res.status(200).json({ message: 'Success' });

  } catch (err) {
    console.error('Webhook Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
