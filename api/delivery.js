import { createClient } from '@supabase/supabase-js';

// --- CONFIGURATION (MANUAL INPUTS) ---
const CONFIG = {
  DRIVER_COUNT: 5,             
  TARGET_PER_DRIVER: 5,        
  CURRENT_DATE: '2026-02-14',  // Use YYYY-MM-DD format
};

// --- GREEN API CONFIG ---
const GREEN_API = {
  INSTANCE_ID: 'REDACTED_INSTANCE_ID',         
  API_TOKEN: 'REDACTED_GREEN_API_TOKEN',             
  CHAT_ID: '201023238155@c.us', 
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

// --- GEOGRAPHIC ZONES (Prevent mixing far east and far west) ---
const ZONES = {
  "WEST": [
    "الدقي", "الزمالك", "الشيخ زايد", "العجوزه", "المنيب", 
    "المهندسين", "امبايه", "بولاق الدكرور", "حدائق الاهرام", 
    "فيصل والهرم", "6 اكتوبر", "٦ اكتوبر"
  ],
  "EAST": [
    "جسر السويس", "مدينة بدر", "مدينتي", "الشروق", 
    "العاشر من رمضان", "العبور", "المرج", "المستقبل"
  ],
  "CENTRAL_NORTH": [
    "حدائق القبة", "شبرا", "شبرا مصر", "عين شمس", 
    "مدينة نصر", "مصر الجديدة", "وسط البلد", 
    "الزيتون", "المطرية", "النزهة"
  ],
  "CENTRAL_SOUTH": [
    "حلوان", "15 مايو", "المنيل"
  ],
  "NEW_CAIRO": [
    "التجمع الأول/الثالث/الخامس", "التجمع الاول", 
    "التجمع الثالث", "التجمع الخامس", "الرحاب", 
    "المعادي", "المعادى", "المقطم"
  ]
};

// --- PRIMARY ADJACENCY (Within same zone or compatible zones) ---
const ADJACENCY_MAP = {
  // West Zone - Can combine within west only
  "الشيخ زايد": ["6 اكتوبر", "٦ اكتوبر"],
  "6 اكتوبر": ["الشيخ زايد", "٦ اكتوبر"],
  "٦ اكتوبر": ["الشيخ زايد", "6 اكتوبر"],
  "الدقي": ["المهندسين", "العجوزه", "الزمالك"],
  "المهندسين": ["الدقي", "العجوزه"],
  "العجوزه": ["الدقي", "المهندسين"],
  "الزمالك": ["الدقي"],
  "فيصل والهرم": ["حدائق الاهرام"],
  "حدائق الاهرام": ["فيصل والهرم"],

  // New Cairo Zone - Can combine with each other
  "الرحاب": ["مدينتي", "التجمع الأول/الثالث/الخامس", "التجمع الخامس"],
  "مدينتي": ["الرحاب", "التجمع الأول/الثالث/الخامس", "التجمع الخامس"],
  "التجمع الأول/الثالث/الخامس": ["الرحاب", "المقطم", "التجمع الخامس"],
  "التجمع الخامس": ["الرحاب", "المقطم", "التجمع الأول/الثالث/الخامس"],
  "المقطم": ["التجمع الأول/الثالث/الخامس", "التجمع الخامس", "المعادي", "المعادى"],
  "المعادي": ["المقطم", "المعادى"],
  "المعادى": ["المقطم", "المعادي"],
  
  // Central North - Can combine with each other
  "مدينة نصر": ["مصر الجديدة", "النزهة"],
  "مصر الجديدة": ["مدينة نصر", "النزهة"],
  "النزهة": ["مدينة نصر", "مصر الجديدة"],
  "شبرا": ["شبرا مصر", "حدائق القبة"],
  "شبرا مصر": ["شبرا", "حدائق القبة"],
  "حدائق القبة": ["شبرا", "شبرا مصر"]
};

// --- COMPATIBLE ZONES (Which zones can be combined if needed) ---
const COMPATIBLE_ZONES = {
  "WEST": ["WEST"], // West stays alone
  "EAST": ["EAST"], // East stays alone
  "CENTRAL_NORTH": ["CENTRAL_NORTH", "NEW_CAIRO"], // Can combine
  "CENTRAL_SOUTH": ["CENTRAL_SOUTH", "NEW_CAIRO"], // Can combine
  "NEW_CAIRO": ["NEW_CAIRO", "CENTRAL_NORTH", "CENTRAL_SOUTH"] // Can combine with central
};

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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

// Helper function to get zone for an area
function getZone(area) {
  for (const [zone, areas] of Object.entries(ZONES)) {
    if (areas.includes(area)) return zone;
  }
  return "UNKNOWN";
}

// Helper function to check if two zones are compatible
function areZonesCompatible(zone1, zone2) {
  if (zone1 === zone2) return true;
  const compatible = COMPATIBLE_ZONES[zone1] || [];
  return compatible.includes(zone2);
}

export default async function handler(req, res) {
  try {
    // 1. Fetch Pending Orders by 'delivery_date'
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('delivery_date', CONFIG.CURRENT_DATE)
      .eq('status', 'pending');

    if (error) throw error;
    if (!orders || orders.length === 0) {
      return res.status(200).json({ message: `No pending orders found for ${CONFIG.CURRENT_DATE}` });
    }

    // 2. Grouping by delivery_area
    const areaGroups = {};
    orders.forEach(order => {
      const area = order.delivery_area || 'Unspecified Area';
      if (!areaGroups[area]) areaGroups[area] = [];
      areaGroups[area].push(order);
    });

    // 3. Zone-Aware Clustering Logic
    const clusters = [];
    const processedAreas = new Set();
    
    Object.keys(areaGroups).forEach(area => {
      if (processedAreas.has(area)) return;
      
      let currentCluster = [...areaGroups[area]];
      let clusterZone = getZone(area);
      processedAreas.add(area);

      // Try to expand cluster if below target
      if (currentCluster.length < CONFIG.TARGET_PER_DRIVER) {
        // First: Try adjacent areas in SAME or COMPATIBLE zones
        const neighbors = ADJACENCY_MAP[area] || [];
        
        for (const neighbor of neighbors) {
          if (processedAreas.has(neighbor) || !areaGroups[neighbor]) continue;
          
          const neighborZone = getZone(neighbor);
          
          // Only combine if zones are compatible
          if (areZonesCompatible(clusterZone, neighborZone)) {
            currentCluster = currentCluster.concat(areaGroups[neighbor]);
            processedAreas.add(neighbor);
            
            if (currentCluster.length >= CONFIG.TARGET_PER_DRIVER) break;
          }
        }
        
        // Second: If still below target, try other areas in SAME or COMPATIBLE zones
        if (currentCluster.length < CONFIG.TARGET_PER_DRIVER) {
          for (const [otherArea, otherOrders] of Object.entries(areaGroups)) {
            if (processedAreas.has(otherArea)) continue;
            
            const otherZone = getZone(otherArea);
            
            // Only combine if zones are compatible
            if (areZonesCompatible(clusterZone, otherZone)) {
              currentCluster = currentCluster.concat(otherOrders);
              processedAreas.add(otherArea);
              
              if (currentCluster.length >= CONFIG.TARGET_PER_DRIVER) break;
            }
          }
        }
      }
      
      clusters.push(currentCluster);
    });

    // 4. Driver Distribution
    const driverAssignments = Array.from({ length: CONFIG.DRIVER_COUNT }, (_, i) => ({
      driver_name: `Driver ${i + 1}`,
      orders: [],
      areas: new Set(),
      zones: new Set()
    }));

    clusters.forEach(cluster => {
      const leastBusy = driverAssignments.reduce((p, c) => (p.orders.length < c.orders.length ? p : c));
      leastBusy.orders.push(...cluster);
      cluster.forEach(o => {
        leastBusy.areas.add(o.delivery_area);
        leastBusy.zones.add(getZone(o.delivery_area));
      });
    });

    // 5. Send to Green API
    const results = [];
    for (const d of driverAssignments) {
      if (d.orders.length === 0) continue;

      // Calculate driver earnings and COD collection
      let totalEarnings = 0;
      let totalCODCollection = 0;

      d.orders.forEach(order => {
        totalEarnings += getDeliveryRate(order.delivery_area);
        if (order.is_cod) {
          totalCODCollection += parseFloat(order.total_price || 0);
        }
      });

      const zonesInfo = Array.from(d.zones).join(' + ');

      const message = `*🚚 Dispatch: ${d.driver_name}*\n` +
        `📅 Date: ${CONFIG.CURRENT_DATE}\n` +
        `🗺️ Zones: ${zonesInfo}\n` +
        `📍 Areas: ${Array.from(d.areas).join(', ')}\n` +
        `📦 Total Orders: ${d.orders.length}\n` +
        `💵 Your Earnings: ${totalEarnings.toFixed(2)} EGP\n` +
        `💰 COD to Collect: ${totalCODCollection.toFixed(2)} EGP\n` +
        `────────────────────\n\n` +
        d.orders.map((o, i) => {
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

      const response = await fetch(`${GREEN_API.API_URL}/waInstance${GREEN_API.INSTANCE_ID}/sendMessage/${GREEN_API.API_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: GREEN_API.CHAT_ID, 
          message: message
        })
      });

      const result = await response.json();
      results.push({ 
        driver: d.driver_name, 
        orders: d.orders.length,
        zones: Array.from(d.zones),
        areas: Array.from(d.areas),
        earnings: totalEarnings,
        cod_collection: totalCODCollection,
        status: result 
      });
      
      await sleep(1000); 
    }

    return res.status(200).json({ success: true, dispatch_results: results });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
