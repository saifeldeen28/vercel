import { createClient } from '@supabase/supabase-js';
import { getDeliveryRate } from '../../lib/deliveryRates.js';
import { verifyApiKey } from '../../lib/apiKeyAuth.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  // Verify API key
  const verification = verifyApiKey(req);
  if (!verification.valid) {
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized' 
    });
  }

  const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
  const delivery_date = searchParams.get('delivery_date');

  if (!delivery_date) {
    return res.status(400).json({ error: 'Missing required query param: delivery_date' });
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(delivery_date)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
  }

  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('delivery_area, is_cod, total_price')
      .eq('delivery_date', delivery_date);

    if (error) throw error;

    if (!orders || orders.length === 0) {
      return res.status(200).json({
        success: true,
        delivery_date,
        orders_count: 0,
        total_earnings: 0,
        total_cod: 0
      });
    }

    let totalEarnings = 0;
    let totalCOD = 0;

    orders.forEach(order => {
      totalEarnings += getDeliveryRate(order.delivery_area);
      if (order.is_cod) {
        totalCOD += parseFloat(order.total_price || 0);
      }
    });

    return res.status(200).json({
      success: true,
      delivery_date,
      orders_count: orders.length,
      total_earnings: totalEarnings,
      total_cod: totalCOD
    });

  } catch (err) {
    console.error('Error in orders-summary handler:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
