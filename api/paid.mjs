import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const body = req.body;
    const shopifyId = body.id.toString();

    // --- 1. EXTRACT DELIVERY DATE ---
    // Look for a note attribute with names like "Delivery Date" or "date"
    const deliveryAttr = body.note_attributes?.find(attr => {
      const name = attr.name.toLowerCase();
      return name.includes('delivery') || name.includes('date');
    });

    let extractedDate = null;
    if (deliveryAttr?.value) {
      const parsedDate = new Date(deliveryAttr.value);
      // Check if the date is valid, then format as YYYY-MM-DD
      if (!isNaN(parsedDate)) {
        extractedDate = parsedDate.toISOString().split('T')[0];
      }
    }

    // --- 2. INSERT/UPDATE ORDER ---
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .upsert([{ 
        shopify_order_id: shopifyId, 
        customer_name: `${body.customer?.first_name || ''} ${body.customer?.last_name || ''}`.trim() || 'Guest',
        total_price: body.total_price,
        delivery_area: body.shipping_address?.city || 'Not Specified',
        delivery_date: extractedDate, // This is our YYYY-MM-DD string
        status: 'pending'
      }], { onConflict: 'shopify_order_id' })
      .select();

    if (orderError) throw orderError;

    // --- 3. INSERT ORDER ITEMS ---
    // First, clear old items for this order to prevent duplicates if webhook resends
    await supabase.from('order_items').delete().eq('order_id', order[0].id);

    const items = body.line_items.map(item => ({
      order_id: order[0].id,
      item_name: item.title,
      quantity: item.quantity
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(items);
    if (itemsError) throw itemsError;

    console.log(`Order ${shopifyId} synced successfully for delivery on ${extractedDate}`);

    return res.status(200).json({ 
      message: 'Success', 
      delivery_date: extractedDate 
    });

  } catch (err) {
    console.error('Webhook Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
