import { createClient } from '@supabase/supabase-js';

// --- ML API CONFIG ---
const ML_API_URL = 'https://saifeldeen28-vercel-ml.hf.space/assign-drivers';

// --- DELIVERY RATES (Driver earnings per area) ---
const deliveryRates = {
  // Giza & West Cairo
  "الدقي": 170.00,
  "الزمالك": 170.00,
  "الشيخ زايد": 270.00,
  "العجوزه": 170.00,
  "المنيب": 170.00,
  "المهندسين": 170.00,
  "امبايه": 250.00,
  "بولاق الدكرور": 250.00,
  "حدائق الاهرام": 250.00,
  "فيصل والهرم": 170.00,
  "6 اكتوبر": 270.00,
  "٦ اكتوبر": 270.00,

  // East Cairo & Helwan
  "جسر السويس": 150.00,
  "حدائق القبة": 150.00,
  "حلوان": 250.00,
  "شبرا": 150.00,
  "شبرا مصر": 150.00,
  "عين شمس": 150.00,
  "مدينة بدر": 220.00,
  "مدينة نصر": 120.00,
  "مدينتي": 220.00,
  "مصر الجديدة": 130.00,
  "وسط البلد": 150.00,
  "15 مايو": 250.00,

  // New Cairo & North/South
  "التجمع الأول/الثالث/الخامس": 100.00,
  "التجمع الاول": 100.00,
  "التجمع الثالث": 100.00,
  "التجمع الخامس": 100.00,
  "الرحاب": 120.00,
  "الزيتون": 150.00,
  "الشروق": 220.00,
  "العاشر من رمضان": 350.00,
  "العبور": 220.00,
  "المرج": 170.00,
  "المستقبل": 250.00,
  "المطرية": 150.00,
  "المعادي": 150.00,
  "المعادى": 150.00,
  "المقطم": 120.00,
  "المنيل": 170.00,
  "النزهة": 140.00
};

// Cairo coordinates for areas (approximate centers)
const areaCoordinates = {
  "الدقي": { lat: 30.0444, lng: 31.2089 },
  "الزمالك": { lat: 30.0626, lng: 31.2220 },
  "الشيخ زايد": { lat: 30.0181, lng: 30.9737 },
  "العجوزه": { lat: 30.0626, lng: 31.2003 },
  "المنيب": { lat: 29.9797, lng: 31.2122 },
  "المهندسين": { lat: 30.0618, lng: 31.2000 },
  "امبايه": { lat: 30.0100, lng: 31.1800 },
  "بولاق الدكرور": { lat: 30.0358, lng: 31.1711 },
  "حدائق الاهرام": { lat: 30.0194, lng: 31.1164 },
  "فيصل والهرم": { lat: 30.0131, lng: 31.1656 },
  "6 اكتوبر": { lat: 29.9597, lng: 30.9239 },
  "٦ اكتوبر": { lat: 29.9597, lng: 30.9239 },
  "جسر السويس": { lat: 30.0719, lng: 31.3394 },
  "حدائق القبة": { lat: 30.0753, lng: 31.2811 },
  "حلوان": { lat: 29.8500, lng: 31.3344 },
  "شبرا": { lat: 30.1100, lng: 31.2450 },
  "شبرا مصر": { lat: 30.1100, lng: 31.2450 },
  "عين شمس": { lat: 30.1281, lng: 31.3181 },
  "مدينة بدر": { lat: 30.1525, lng: 31.7061 },
  "مدينة نصر": { lat: 30.0542, lng: 31.3606 },
  "مدينتي": { lat: 30.0892, lng: 31.6536 },
  "مصر الجديدة": { lat: 30.0908, lng: 31.3272 },
  "وسط البلد": { lat: 30.0444, lng: 31.2358 },
  "15 مايو": { lat: 29.8703, lng: 31.2528 },
  "التجمع الأول/الثالث/الخامس": { lat: 30.0131, lng: 31.4364 },
  "التجمع الاول": { lat: 30.0300, lng: 31.4200 },
  "التجمع الثالث": { lat: 30.0281, lng: 31.5064 },
  "التجمع الخامس": { lat: 30.0131, lng: 31.4364 },
  "الرحاب": { lat: 30.0586, lng: 31.4933 },
  "الزيتون": { lat: 30.0808, lng: 31.2914 },
  "الشروق": { lat: 30.1200, lng: 31.6200 },
  "العاشر من رمضان": { lat: 30.4800, lng: 31.7400 },
  "العبور": { lat: 30.1858, lng: 31.4800 },
  "المرج": { lat: 30.1281, lng: 31.3564 },
  "المستقبل": { lat: 30.0900, lng: 31.4800 },
  "المطرية": { lat: 30.1281, lng: 31.3181 },
  "المعادي": { lat: 29.9600, lng: 31.2500 },
  "المعادى": { lat: 29.9600, lng: 31.2500 },
  "المقطم": { lat: 30.0081, lng: 31.3200 },
  "المنيل": { lat: 30.0233, lng: 31.2294 },
  "النزهة": { lat: 30.1100, lng: 31.3400 }
};

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Helper function to get delivery rate for an area
function getDeliveryRate(area) {
  if (!area) return 0;
  if (deliveryRates[area]) return deliveryRates[area];
  
  const areaLower = area.toLowerCase();
  for (const [key, value] of Object.entries(deliveryRates)) {
    if (key.toLowerCase() === areaLower) return value;
  }
  
  return 100.00;
}

// Helper function to get coordinates for an area
function getCoordinates(area) {
  if (!area) return { lat: 30.0444, lng: 31.2357 }; // Default Cairo center
  
  if (areaCoordinates[area]) return areaCoordinates[area];
  
  // Try case-insensitive match
  const areaLower = area.toLowerCase();
  for (const [key, value] of Object.entries(areaCoordinates)) {
    if (key.toLowerCase() === areaLower) return value;
  }
  
  return { lat: 30.0444, lng: 31.2357 }; // Default Cairo center
}

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // Extract parameters from request body
    const { delivery_date, drivers_count } = req.body;

    // Validate input
    if (!delivery_date) {
      return res.status(400).json({ 
        error: 'Missing required field: delivery_date',
        example: { delivery_date: '2026-02-09', drivers_count: 5 }
      });
    }

    if (!drivers_count || drivers_count < 1 || drivers_count > 20) {
      return res.status(400).json({ 
        error: 'drivers_count must be between 1 and 20',
        example: { delivery_date: '2026-02-09', drivers_count: 5 }
      });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(delivery_date)) {
      return res.status(400).json({ 
        error: 'Invalid date format. Use YYYY-MM-DD (e.g., 2026-02-09)' 
      });
    }

    // 1. Fetch Orders by delivery_date
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

    // 2. Prepare data for ML API
    const ordersWithCoordinates = orders.map(order => {
      const coords = getCoordinates(order.delivery_area);
      return {
        id: order.id.toString(),
        lat: coords.lat,
        lng: coords.lng,
        originalOrder: order
      };
    });

    // 3. Call Hugging Face ML API for clustering
    const mlResponse = await fetch(ML_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        drivers_count: drivers_count,
        orders: ordersWithCoordinates.map(o => ({
          id: o.id,
          lat: o.lat,
          lng: o.lng
        }))
      })
    });

    if (!mlResponse.ok) {
      const errorText = await mlResponse.text();
      throw new Error(`ML API error: ${mlResponse.status} - ${errorText}`);
    }

    const mlAssignments = await mlResponse.json();

    // 4. Group orders by driver number from ML API
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

    // 5. Calculate earnings and COD for each driver
    const results = driverAssignments
      .filter(d => d.orders.length > 0)
      .map(d => {
        let totalEarnings = 0;
        let totalCODCollection = 0;

        d.orders.forEach(order => {
          totalEarnings += getDeliveryRate(order.delivery_area);
          if (order.is_cod) {
            totalCODCollection += parseFloat(order.total_price || 0);
          }
        });

        return {
          driver: d.driver_name,
          driver_number: d.driver_number,
          orders: d.orders,
          order_count: d.orders.length,
          areas: Array.from(d.areas),
          earnings: totalEarnings,
          cod_collection: totalCODCollection
        };
      });

    return res.status(200).json({ 
      success: true,
      delivery_date,
      drivers_count,
      orders_found: orders.length,
      drivers_dispatched: results.length,
      dispatch_results: results 
    });

  } catch (err) {
    console.error('Error in dispatch handler:', err);
    return res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
}
