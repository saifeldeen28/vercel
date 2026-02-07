import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Order ID is required' 
      });
    }

    const shopifyId = id.toString();

    // Delete the order from database (cascade will delete order_items automatically)
    const { data, error } = await supabase
      .from('orders')
      .delete()
      .eq('shopify_order_id', shopifyId)
      .select();

    if (error) {
      console.error('Database deletion error:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }

    // Check if order was found and deleted
    if (!data || data.length === 0) {
      console.log(`Order ${shopifyId} not found in database (may not have been synced)`);
      return res.status(200).json({ 
        success: true, 
        message: 'Order not found in database',
        deleted: false
      });
    }

    console.log(`Order ${shopifyId} cancelled and removed from database`);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Order deleted successfully',
      deleted: true,
      orderName: data[0].order_name
    });

  } catch (error) {
    console.error('Handler error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}
