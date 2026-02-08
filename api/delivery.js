import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION (MANUAL INPUTS) ---
const CONFIG = {
  DRIVER_COUNT: 3,             // Update manually
  TARGET_PER_DRIVER: 5,        // Target orders per driver
  CURRENT_DAY: 'Saturday',     // Processing day
};

// --- GREEN API CONFIG ---
const GREEN_API = {
  INSTANCE_ID: 'REDACTED_INSTANCE_ID',         // e.g. '1101xxxxxx'
  API_TOKEN: 'REDACTED_GREEN_API_TOKEN',             // your apiTokenInstance
  CHAT_ID: '201023238155@c.us',       // '2010xxxxxxxx@c.us' (User) or 'xxx@g.us' (Group)
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

// Helper function to add delay between API calls
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handler(req, res) {
  try {
    // 1. Fetch Pending Orders
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('delivery_day', CONFIG.CURRENT_DAY)
      .eq('status', 'pending');

    if (error) throw error;

    // 2. Grouping by Area
    const areaGroups = {};
    orders.forEach(order => {
      const area = order.delivery_area || 'Unknown';
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

      const message = `*🚚 Dispatch: ${d.driver_name}*\n` +
        `📅 Day: ${CONFIG.CURRENT_DAY}\n` +
        `📍 Zones: ${Array.from(d.areas).join(', ')}\n` +
        `📦 Total: ${d.orders.length} Orders\n\n` +
        d.orders.map((o, i) => `${i+1}. ${o.delivery_full_address}`).join('\n\n');

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
      
      await sleep(1000); // 1-second pause to prevent rate limiting
    }

    return res.status(200).json({ success: true, dispatch_results: results });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
