import { getDeliveryRate } from '../lib/deliveryRates.js';

// --- GREEN API CONFIG ---
const GREEN_API = {
  INSTANCE_ID: process.env.GREEN_API_INSTANCE_ID,
  API_TOKEN: process.env.GREEN_API_TOKEN,
  CHAT_ID: process.env.GREEN_API_CHAT_ID,
  API_URL: 'https://api.green-api.com'
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
