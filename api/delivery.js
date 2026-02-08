import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION (MANUAL INPUTS) ---
const CONFIG = {
  DRIVER_COUNT: 3,             
  TARGET_PER_DRIVER: 5,        
  CURRENT_DAY: 'Saturday',     // This matches 'delivery_day_name'
};

// --- GREEN API CONFIG ---
const GREEN_API = {
  INSTANCE_ID: 'YOUR_INSTANCE_ID',         
  API_TOKEN: 'YOUR_API_TOKEN',             
  CHAT_ID: '2010xxxxxxxx@c.us', // Your WhatsApp ID
  API_URL: 'https://api.green-api.com'
};

// --- ADJACENCY MATRIX ---
const ADJACENCY_MAP = {
  "Sheikh Zayed": ["6th of October"],
  "6th of October": ["Sheikh Zayed"],
  "Rehab": ["Madinaty", "New Cairo"],
  "New Cairo": ["Rehab", "Madinaty"],
  "Maadi": ["Mokattam"],
};

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
  try {
    // 1. Fetch Pending Orders using your new schema
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('delivery_day_name', CONFIG.CURRENT_DAY) // Matches your schema
      .eq('status', 'pending');

    if (error) throw error;
    if (!orders || orders.length === 0) {
      return res.status(200).json({ message: "No pending orders found for today." });
    }

    // 2. Grouping by delivery_area
    const areaGroups = {};
    orders.forEach(order => {
      const area = order.delivery_area || 'Unspecified Area';
      if (!areaGroups[area]) areaGroups[area] = [];
      areaGroups[area].push(order);
    });

    // 3. Clustering Logic (Adjacency)
    const clusters = [];
    const processedAreas = new Set();
    Object.keys(areaGroups).forEach(area => {
      if (processedAreas.has(area)) return;
      let currentCluster = [...areaGroups[area]];
      processedAreas.add(area);

      if (currentCluster.length < CONFIG.TARGET_PER_DRIVER) {
        const neighbors = ADJACENCY_MAP[area] || [];
        for (const neighbor of neighbors) {
          if (areaGroups[neighbor] && !processedAreas.has(neighbor)) {
            currentCluster = currentCluster.concat(areaGroups[neighbor]);
            processedAreas.add(neighbor);
            if (currentCluster.length >= CONFIG.TARGET_PER_DRIVER) break;
          }
        }
      }
      clusters.push(currentCluster);
    });

    // 4. Driver Distribution
    const driverAssignments = Array.from({ length: CONFIG.DRIVER_COUNT }, (_, i) => ({
      driver_name: `Driver ${i + 1}`,
      orders: [],
      areas: new Set()
    }));

    clusters.forEach(cluster => {
      const leastBusy = driverAssignments.reduce((p, c) => (p.orders.length < c.orders.length ? p : c));
      leastBusy.orders.push(...cluster);
      cluster.forEach(o => leastBusy.areas.add(o.delivery_area));
    });

    // 5. Send to Green API
    const results = [];
    for (const d of driverAssignments) {
      if (d.orders.length === 0) continue;

      // Formatting the message using your schema fields
      const message = `*🚚 Dispatch: ${d.driver_name}*\n` +
        `📅 Day: ${CONFIG.CURRENT_DAY}\n` +
        `📍 Zones: ${Array.from(d.areas).join(', ')}\n` +
        `📦 Total: ${d.orders.length} Orders\n` +
        `────────────────────\n\n` +
        d.orders.map((o, i) => {
          const codStatus = o.is_cod ? `🔴 *COD: ${o.total_price} EGP*` : `🟢 Paid Online`;
          return `${i+1}. *Order: ${o.order_name}*\n👤 ${o.shipping_name}\n🏠 ${o.delivery_full_address}\n📞 ${o.shipping_phone}\n💰 ${codStatus}${o.order_notes ? `\n📝 Note: ${o.order_notes}` : ''}`;
        }).join('\n\n────────────────────\n\n');

      const response = await fetch(`${GREEN_API.API_URL}/waInstance${GREEN_API.INSTANCE_ID}/sendMessage/${GREEN_API.API_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: GREEN_API.CHAT_ID, 
          message: message
        })
      });

      const result = await response.json();
      results.push({ driver: d.driver_name, status: result });
      
      await sleep(1000); 
    }

    return res.status(200).json({ success: true, dispatch_results: results });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
