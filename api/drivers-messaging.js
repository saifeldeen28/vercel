const GREEN_API = {
  INSTANCE_ID: 'REDACTED_INSTANCE_ID',
  API_TOKEN: 'REDACTED_GREEN_API_TOKEN',
  CHAT_ID: '201023238155@c.us',
  API_URL: 'https://api.green-api.com'
};

const deliveryRates = {
  "الدقي": 170, "الزمالك": 170, "الشيخ زايد": 270, "العجوزه": 170, "المنيب": 170, "المهندسين": 170,
  "امبايه": 250, "بولاق الدكرور": 250, "حدائق الاهرام": 250, "فيصل والهرم": 170, "6 اكتوبر": 270,
  "٦ اكتوبر": 270, "جسر السويس": 150, "حدائق القبة": 150, "حلوان": 250, "شبرا": 150, "شبرا مصر": 150,
  "عين شمس": 150, "مدينة بدر": 220, "مدينة نصر": 120, "مدينتي": 220, "مصر الجديدة": 130,
  "وسط البلد": 150, "15 مايو": 250, "التجمع الأول/الثالث/الخامس": 100, "التجمع الاول": 100,
  "التجمع الثالث": 100, "التجمع الخامس": 100, "الرحاب": 120, "الزيتون": 150, "الشروق": 220,
  "العاشر من رمضان": 350, "العبور": 220, "المرج": 170, "المستقبل": 250, "المطرية": 150,
  "المعادي": 150, "المعادى": 150, "المقطم": 120, "المنيل": 170, "النزهة": 140
};

function getDeliveryRate(area) {
  if (!area) return 100.00;
  if (deliveryRates[area]) return deliveryRates[area];
  const areaLower = area.toLowerCase();
  for (const [key, value] of Object.entries(deliveryRates)) {
    if (key.toLowerCase() === areaLower) return value;
  }
  return 100.00;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  try {
    const { driverAssignments, delivery_date } = req.body;
    const results = [];

    for (const d of driverAssignments) {
      if (d.orders.length === 0) continue;

      let totalEarnings = 0;
      let totalCODCollection = 0;

      d.orders.forEach(order => {
        totalEarnings += getDeliveryRate(order.delivery_area);
        if (order.is_cod) totalCODCollection += parseFloat(order.total_price || 0);
      });

      // --- RESTORED CHARACTER-FOR-CHARACTER MESSAGE LOGIC ---
      const message = `*🚚 Dispatch: ${d.driver_name}*\n` +
        `📅 Date: ${delivery_date}\n` +
        `📍 Areas: ${d.areas.join(', ')}\n` +
        `📦 Total Orders: ${d.orders.length}\n` +
        `💵 Your Earnings: ${totalEarnings.toFixed(2)} EGP\n` +
        `💰 COD to Collect: ${totalCODCollection.toFixed(2)} EGP\n` +
        `────────────────────\n\n` +
        d.orders.map((o, i) => {
          const rate = getDeliveryRate(o.delivery_area);
          const codStatus = o.is_cod ? `🔴 *COD: ${o.total_price} EGP*` : `🟢 Paid Online`;
          return `${i+1}. *Order: ${o.order_name}*\n` +
            `👤 ${o.shipping_name || o.customer_account_name || 'N/A'}\n` +
            `🏠 ${o.delivery_full_address || 'N/A'}\n` +
            `📞 ${o.shipping_phone || o.customer_account_phone || 'N/A'}\n` +
            `💰 ${codStatus}\n` +
            `💵 Rate: ${rate.toFixed(2)} EGP` +
            `${o.order_notes ? `\n📝 Note: ${o.order_notes}` : ''}`;
        }).join('\n\n────────────────────\n\n');

      const response = await fetch(`${GREEN_API.API_URL}/waInstance${GREEN_API.INSTANCE_ID}/sendMessage/${GREEN_API.API_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: GREEN_API.CHAT_ID, message })
      });

      const result = await response.json();
      results.push({ driver: d.driver_name, orders: d.orders.length, status: result });
      await sleep(1);
    }

    return res.status(200).json({ success: true, drivers_dispatched: results.length, dispatch_results: results });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}
