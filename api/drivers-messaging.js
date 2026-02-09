const GREEN_API = {
  INSTANCE_ID: 'REDACTED_INSTANCE_ID',
  API_TOKEN: 'REDACTED_GREEN_API_TOKEN',
  CHAT_ID: '201023238155@c.us',
  API_URL: 'https://api.green-api.com'
};

// Include deliveryRates object and getDeliveryRate helper here for message formatting

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  try {
    const { driverAssignments, delivery_date } = req.body;
    const results = [];

    for (const d of driverAssignments) {
      if (!d.orders || d.orders.length === 0) continue;

      let totalEarnings = 0;
      let totalCOD = 0;
      const areas = new Set();

      // Format Message String
      const orderDetails = d.orders.map((o, i) => {
        const rate = getDeliveryRate(o.delivery_area);
        totalEarnings += rate;
        areas.add(o.delivery_area);
        if (o.is_cod) totalCOD += parseFloat(o.total_price || 0);

        return `${i+1}. *Order: ${o.order_name}*\n` +
               `🏠 ${o.delivery_full_address}\n` +
               `💰 ${o.is_cod ? `🔴 COD: ${o.total_price}` : '🟢 Paid'}`;
      }).join('\n\n────────────────────\n\n');

      const fullMessage = `*🚚 Dispatch: ${d.driver_name}*\n` +
                          `📅 Date: ${delivery_date}\n` +
                          `📍 Areas: ${Array.from(areas).join(', ')}\n` +
                          `💵 Earnings: ${totalEarnings.toFixed(2)} EGP\n\n` +
                          `────────────────────\n\n` + orderDetails;

      // Call Green API
      const response = await fetch(`${GREEN_API.API_URL}/waInstance${GREEN_API.INSTANCE_ID}/sendMessage/${GREEN_API.API_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: GREEN_API.CHAT_ID, message: fullMessage })
      });

      results.push({ driver: d.driver_name, status: await response.json() });
    }

    return res.status(200).json({ success: true, results });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
