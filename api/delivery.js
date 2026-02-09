import { createClient } from '@supabase/supabase-js';

const ML_API_URL = 'https://saifeldeen28-vercel-ml.hf.space/assign-drivers';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// --- DATA TABLES ---
const areaCoordinates = {
  "الدقي": { lat: 30.0444, lng: 31.2089 }, "الزمالك": { lat: 30.0626, lng: 31.2220 },
  "الشيخ زايد": { lat: 30.0181, lng: 30.9737 }, "العجوزه": { lat: 30.0626, lng: 31.2003 },
  "المنيب": { lat: 29.9797, lng: 31.2122 }, "المهندسين": { lat: 30.0618, lng: 31.2000 },
  "امبايه": { lat: 30.0100, lng: 31.1800 }, "بولاق الدكرور": { lat: 30.0358, lng: 31.1711 },
  "حدائق الاهرام": { lat: 30.0194, lng: 31.1164 }, "فيصل والهرم": { lat: 30.0131, lng: 31.1656 },
  "6 اكتوبر": { lat: 29.9597, lng: 30.9239 }, "٦ اكتوبر": { lat: 29.9597, lng: 30.9239 },
  "جسر السويس": { lat: 30.0719, lng: 31.3394 }, "حدائق القبة": { lat: 30.0753, lng: 31.2811 },
  "حلوان": { lat: 29.8500, lng: 31.3344 }, "شبرا": { lat: 30.1100, lng: 31.2450 },
  "شبرا مصر": { lat: 30.1100, lng: 31.2450 }, "عين شمس": { lat: 30.1281, lng: 31.3181 },
  "مدينة بدر": { lat: 30.1525, lng: 31.7061 }, "مدينة نصر": { lat: 30.0542, lng: 31.3606 },
  "مدينتي": { lat: 30.0892, lng: 31.6536 }, "مصر الجديدة": { lat: 30.0908, lng: 31.3272 },
  "وسط البلد": { lat: 30.0444, lng: 31.2358 }, "15 مايو": { lat: 29.8703, lng: 31.2528 },
  "التجمع الأول/الثالث/الخامس": { lat: 30.0131, lng: 31.4364 }, "التجمع الاول": { lat: 30.0300, lng: 31.4200 },
  "التجمع الثالث": { lat: 30.0281, lng: 31.5064 }, "التجمع الخامس": { lat: 30.0131, lng: 31.4364 },
  "الرحاب": { lat: 30.0586, lng: 31.4933 }, "الزيتون": { lat: 30.0808, lng: 31.2914 },
  "الشروق": { lat: 30.1200, lng: 31.6200 }, "العاشر من رمضان": { lat: 30.4800, lng: 31.7400 },
  "العبور": { lat: 30.1858, lng: 31.4800 }, "المرج": { lat: 30.1281, lng: 31.3564 },
  "المستقبل": { lat: 30.0900, lng: 31.4800 }, "المطرية": { lat: 30.1281, lng: 31.3181 },
  "المعادي": { lat: 29.9600, lng: 31.2500 }, "المعادى": { lat: 29.9600, lng: 31.2500 },
  "المقطم": { lat: 30.0081, lng: 31.3200 }, "المنيل": { lat: 30.0233, lng: 31.2294 },
  "النزهة": { lat: 30.1100, lng: 31.3400 }
};

function getCoordinates(area) {
  if (!area) return { lat: 30.0444, lng: 31.2357 };
  if (areaCoordinates[area]) return areaCoordinates[area];
  const areaLower = area.toLowerCase();
  for (const [key, value] of Object.entries(areaCoordinates)) {
    if (key.toLowerCase() === areaLower) return value;
  }
  return { lat: 30.0444, lng: 31.2357 };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    const { delivery_date, drivers_count } = req.body;

    // --- RESTORED ORIGINAL VALIDATION ---
    if (!delivery_date) return res.status(400).json({ error: 'Missing delivery_date' });
    if (!drivers_count || drivers_count < 1 || drivers_count > 20) {
      return res.status(400).json({ error: 'drivers_count must be between 1 and 20' });
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(delivery_date)) return res.status(400).json({ error: 'Invalid date format (YYYY-MM-DD)' });

    // 1. Fetch Orders
    const { data: orders, error } = await supabase.from('orders').select('*').eq('delivery_date', delivery_date);
    if (error) throw error;
    if (!orders || orders.length === 0) return res.status(200).json({ success: false, orders_found: 0, message: `No orders found for ${delivery_date}` });

    // 2. Prep ML
    const ordersWithCoordinates = orders.map(order => {
      const coords = getCoordinates(order.delivery_area);
      return { id: order.id.toString(), lat: coords.lat, lng: coords.lng, originalOrder: order };
    });

    // 3. Call ML API
    const mlResponse = await fetch(ML_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        drivers_count,
        orders: ordersWithCoordinates.map(o => ({ id: o.id, lat: o.lat, lng: o.lng }))
      })
    });
    if (!mlResponse.ok) throw new Error(`ML API error: ${mlResponse.status}`);
    const mlAssignments = await mlResponse.json();

    // 4. Grouping (Restored Exact Original Logic)
    const driverAssignments = Array.from({ length: drivers_count }, (_, i) => ({
      driver_name: `Driver ${i + 1}`,
      driver_number: i + 1,
      orders: [],
      areas: new Set()
    }));

    mlAssignments.forEach(assignment => {
      const orderData = ordersWithCoordinates.find(o => o.id === assignment.order_id);
      if (orderData) {
        const d = driverAssignments[assignment.driver_number - 1];
        if (d) {
          d.orders.push(orderData.originalOrder);
          d.areas.add(orderData.originalOrder.delivery_area);
        }
      }
    });

    return res.status(200).json({
      success: true,
      delivery_date,
      drivers_count,
      orders_found: orders.length,
      driverAssignments: driverAssignments.map(d => ({ ...d, areas: Array.from(d.areas) }))
    });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
