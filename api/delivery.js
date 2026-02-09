import { createClient } from '@supabase/supabase-js';

const ML_API_URL = 'https://saifeldeen28-vercel-ml.hf.space/assign-drivers';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// --- PASTE YOUR deliveryRates AND areaCoordinates OBJECTS HERE ---
// --- PASTE YOUR getDeliveryRate AND getCoordinates HELPER FUNCTIONS HERE ---

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    const { delivery_date, drivers_count } = req.body;

    // 1. Fetch Orders (Original Logic)
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('delivery_date', delivery_date);

    if (error) throw error;
    if (!orders || orders.length === 0) {
      return res.status(200).json({ 
        success: false, 
        message: `No orders found for ${delivery_date}`,
        delivery_date,
        drivers_count,
        orders_found: 0 
      });
    }

    // 2. Prepare data for ML API (Original mapping)
    const ordersWithCoordinates = orders.map(order => {
      const coords = getCoordinates(order.delivery_area);
      return {
        id: order.id.toString(),
        lat: coords.lat,
        lng: coords.lng,
        originalOrder: order
      };
    });

    // 3. Call ML API
    const mlResponse = await fetch(ML_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        drivers_count: drivers_count,
        orders: ordersWithCoordinates.map(o => ({ id: o.id, lat: o.lat, lng: o.lng }))
      })
    });

    const mlAssignments = await mlResponse.json();

    // 4. Grouping Logic (Restored to match original loop structure)
    const driverAssignments = Array.from({ length: drivers_count }, (_, i) => ({
      driver_name: `Driver ${i + 1}`,
      driver_number: i + 1,
      orders: [],
      areas: new Set()
    }));

    mlAssignments.forEach(assignment => {
      const orderData = ordersWithCoordinates.find(o => o.id === assignment.order_id);
      if (orderData) {
        const driverIndex = assignment.driver_number - 1;
        driverAssignments[driverIndex].orders.push(orderData.originalOrder);
        driverAssignments[driverIndex].areas.add(orderData.originalOrder.delivery_area);
      }
    });

    // 5. Final Formatting (Converting Sets to Arrays for JSON)
    const finalAssignments = driverAssignments.map(d => ({
      ...d,
      areas: Array.from(d.areas)
    }));

    // This return object now matches your original success response keys
    return res.status(200).json({
      success: true,
      delivery_date,
      drivers_count,
      orders_found: orders.length,
      driverAssignments: finalAssignments // Changed 'data' back to a descriptive name
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
