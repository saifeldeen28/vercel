import { createClient } from '@supabase/supabase-js';

const ML_API_URL = 'https://saifeldeen28-vercel-ml.hf.space/assign-drivers';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// --- PASTE YOUR deliveryRates AND areaCoordinates OBJECTS HERE ---
// --- PASTE YOUR getDeliveryRate AND getCoordinates HELPER FUNCTIONS HERE ---

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    const { delivery_date, drivers_count } = req.body;

    // 1. Validation (Keep your original regex and field checks)
    if (!delivery_date || !drivers_count) {
      return res.status(400).json({ error: 'Missing delivery_date or drivers_count' });
    }

    // 2. Fetch Orders from Supabase
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('delivery_date', delivery_date);

    if (error) throw error;
    if (!orders || orders.length === 0) {
      return res.status(200).json({ success: false, message: `No orders found for ${delivery_date}` });
    }

    // 3. Prepare data for ML API
    const ordersWithCoordinates = orders.map(order => {
      const coords = getCoordinates(order.delivery_area);
      return {
        id: order.id.toString(),
        lat: coords.lat,
        lng: coords.lng,
        originalOrder: order
      };
    });

    // 4. Call ML API
    const mlResponse = await fetch(ML_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        drivers_count: drivers_count,
        orders: ordersWithCoordinates.map(o => ({ id: o.id, lat: o.lat, lng: o.lng }))
      })
    });

    if (!mlResponse.ok) throw new Error(`ML API error: ${mlResponse.status}`);
    const mlAssignments = await mlResponse.json();

    // 5. Group orders by driver (The fixed logic)
    const driverAssignments = Array.from({ length: drivers_count }, (_, i) => ({
      driver_name: `Driver ${i + 1}`,
      driver_number: i + 1,
      orders: []
    }));

    mlAssignments.forEach(assignment => {
      const orderData = ordersWithCoordinates.find(o => o.id === assignment.order_id);
      if (orderData) {
        // Ensure we use the correct index (driver_number is 1-based from ML)
        const driverIndex = assignment.driver_number - 1;
        if (driverAssignments[driverIndex]) {
          driverAssignments[driverIndex].orders.push(orderData.originalOrder);
        }
      }
    });

    // 6. Return the data structure exactly as the WhatsApp endpoint expects it
    return res.status(200).json({ 
      success: true,
      delivery_date,
      drivers_count,
      orders_found: orders.length,
      data: driverAssignments 
    });

  } catch (err) {
    console.error('Core Logic Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
