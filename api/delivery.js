import { createClient } from '@supabase/supabase-js';

const ML_API_URL = 'https://saifeldeen28-vercel-ml.hf.space/assign-drivers';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Include deliveryRates and areaCoordinates objects here (same as your original code)
// Include getDeliveryRate and getCoordinates helper functions here

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  try {
    const { delivery_date, drivers_count } = req.body;

    // Validation logic (omitted for brevity, keep your original validation here)

    // 1. Fetch Orders
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('delivery_date', delivery_date);

    if (error) throw error;
    if (!orders || orders.length === 0) return res.status(200).json({ success: false, message: "No orders found" });

    // 2. Prepare & Call ML API
    const ordersWithCoordinates = orders.map(order => ({
      id: order.id.toString(),
      lat: getCoordinates(order.delivery_area).lat,
      lng: getCoordinates(order.delivery_area).lng,
      originalOrder: order
    }));

    const mlResponse = await fetch(ML_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        drivers_count,
        orders: ordersWithCoordinates.map(o => ({ id: o.id, lat: o.lat, lng: o.lng }))
      })
    });

    const mlAssignments = await mlResponse.json();

    // 3. Structure Driver Data
    const driverAssignments = Array.from({ length: drivers_count }, (_, i) => ({
      driver_name: `Driver ${i + 1}`,
      orders: []
    }));

    mlAssignments.forEach(assignment => {
      const orderData = ordersWithCoordinates.find(o => o.id === assignment.order_id);
      if (orderData) {
        driverAssignments[assignment.driver_number - 1].orders.push(orderData.originalOrder);
      }
    });

    // Return the processed data without sending WhatsApp
    return res.status(200).json({
      success: true,
      delivery_date,
      data: driverAssignments
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
