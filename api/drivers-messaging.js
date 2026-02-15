// --- GREEN API CONFIG ---
const GREEN_API = {
  INSTANCE_ID: 'REDACTED_INSTANCE_ID',         
  API_TOKEN: 'REDACTED_GREEN_API_TOKEN',             
  CHAT_ID: '201009356511@c.us', 
  API_URL: 'https://api.green-api.com'
};

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
  "حدايق الاهرام": 250.00,
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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // Extract parameters from request body
    const { delivery_date, dispatch_results } = req.body;

    // Validate input
    if (!delivery_date) {
      return res.status(400).json({ 
        error: 'Missing required field: delivery_date'
      });
    }

    if (!dispatch_results || !Array.isArray(dispatch_results) || dispatch_results.length === 0) {
      return res.status(400).json({ 
        error: 'Missing or invalid dispatch_results. Expected an array of driver assignments.'
      });
    }

    // Validate each driver assignment has required fields
    for (const driver of dispatch_results) {
      if (!driver.driver || !driver.orders || !Array.isArray(driver.orders)) {
        return res.status(400).json({ 
          error: 'Invalid driver data. Each driver must have "driver" name and "orders" array.'
        });
      }
    }

    // Send WhatsApp messages to each driver
    const messagingResults = [];
    
    for (const driverData of dispatch_results) {
      if (driverData.orders.length === 0) continue;

      // Build the WhatsApp message
      const message = `*🚚 Dispatch: ${driverData.driver}*\n` +
        `📅 Date: ${delivery_date}\n` +
        `📍 Areas: ${driverData.areas.join(', ')}\n` +
        `📦 Total Orders: ${driverData.order_count}\n` +
        `💵 Your Earnings: ${driverData.earnings.toFixed(2)} EGP\n` +
        `💰 COD to Collect: ${driverData.cod_collection.toFixed(2)} EGP\n` +
        `────────────────────\n\n` +
        driverData.orders.map((o, i) => {
          const deliveryRate = getDeliveryRate(o.delivery_area);
          const codStatus = o.is_cod ? `🔴 *COD: ${o.total_price} EGP*` : `🟢 Paid Online`;
          return `${i+1}. *Order: ${o.order_name}*\n` +
            `👤 ${o.shipping_name || o.customer_account_name || 'N/A'}\n` +
            `🏠 ${o.delivery_full_address || 'N/A'}\n` +
            `📞 ${o.shipping_phone || o.customer_account_phone || 'N/A'}\n` +
            `💰 ${codStatus}\n` +
            `💵 Rate: ${deliveryRate.toFixed(2)} EGP` +
            `${o.order_notes ? `\n📝 Note: ${o.order_notes}` : ''}`;
        }).join('\n\n────────────────────\n\n');

      // Send to Green API
      const response = await fetch(
        `${GREEN_API.API_URL}/waInstance${GREEN_API.INSTANCE_ID}/sendMessage/${GREEN_API.API_TOKEN}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: GREEN_API.CHAT_ID, 
            message: message
          })
        }
      );

      const result = await response.json();
      
      messagingResults.push({ 
        driver: driverData.driver,
        driver_number: driverData.driver_number,
        orders_count: driverData.order_count,
        message_sent: response.ok,
        green_api_response: result
      });
      
      // Small delay between messages to avoid rate limiting
      await sleep(1000);
    }

    return res.status(200).json({ 
      success: true,
      delivery_date,
      messages_sent: messagingResults.length,
      messaging_results: messagingResults 
    });

  } catch (err) {
    console.error('Error in messaging handler:', err);
    return res.status(500).json({ 
      success: false,
      error: err.message 
    });
  }
}
