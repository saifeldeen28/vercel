import { createClient } from '@supabase/supabase-js';
import { deliveryRates, getDeliveryRate } from '../lib/deliveryRates.js';

// Cairo coordinates for areas (approximate centers)
const areaCoordinates = {
  // Giza & West Cairo
  "الدقي": { lat: 30.0444, lng: 31.2089 },
  "الزمالك": { lat: 30.0626, lng: 31.2220 },
  "الشيخ زايد": { lat: 30.0181, lng: 30.9737 },
  "العجوزه": { lat: 30.0626, lng: 31.2003 },
  "المنيب": { lat: 29.9797, lng: 31.2122 },
  "المهندسين": { lat: 30.0618, lng: 31.2000 },
  "امبايه": { lat: 30.0100, lng: 31.1800 },
  "بولاق الدكرور": { lat: 30.0358, lng: 31.1711 },
  "حدائق الاهرام": { lat: 30.0194, lng: 31.1164 }, // Added (synced spelling)
  "حدايق الاهرام": { lat: 30.0194, lng: 31.1164 },
  "فيصل والهرم": { lat: 30.0131, lng: 31.1656 },
  "6 اكتوبر": { lat: 29.9597, lng: 30.9239 },
  "٦ اكتوبر": { lat: 29.9597, lng: 30.9239 },

  // East Cairo & Helwan
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

  // New Cairo & North/South
  "التجمع الأول/الثالث/الخامس": { lat: 30.0131, lng: 31.4364 },
  "التجمع الاول": { lat: 30.0131, lng: 31.4364 }, // Added
  "التجمع الثالث": { lat: 30.0131, lng: 31.4364 }, // Added
  "التجمع الخامس": { lat: 30.0131, lng: 31.4364 }, // Added
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

// --- DISPATCH CONSTANTS ---
const GIZA_MAX          = 5;    // max orders per driver in Giza zone
const CAIRO_MAX         = 7;    // max orders per driver in Cairo zone
const DRIVER_MIN        = 2;    // min orders per driver
const INCOMPAT_THRESHOLD = 0.40; // Euclidean lat/lng distance beyond which two areas must NOT share a driver

// Map every area to one of 4 macro-regions
const AREA_REGION = {
  // GIZA (west of the Nile + far west)
  "الشيخ زايد": "GIZA", "6 اكتوبر": "GIZA", "٦ اكتوبر": "GIZA",
  "حدائق الاهرام": "GIZA", "حدايق الاهرام": "GIZA", "فيصل والهرم": "GIZA",
  "امبايه": "GIZA", "بولاق الدكرور": "GIZA", "المنيب": "GIZA",
  "المهندسين": "GIZA", "الدقي": "GIZA", "الزمالك": "GIZA", "العجوزه": "GIZA",
  // NORTH_CAIRO
  "شبرا": "NORTH_CAIRO", "شبرا مصر": "NORTH_CAIRO", "عين شمس": "NORTH_CAIRO",
  "المرج": "NORTH_CAIRO", "النزهة": "NORTH_CAIRO", "جسر السويس": "NORTH_CAIRO",
  "مصر الجديدة": "NORTH_CAIRO", "الزيتون": "NORTH_CAIRO",
  "حدائق القبة": "NORTH_CAIRO", "المطرية": "NORTH_CAIRO",
  // SOUTH_CAIRO
  "وسط البلد": "SOUTH_CAIRO", "المنيل": "SOUTH_CAIRO",
  "المعادي": "SOUTH_CAIRO", "المعادى": "SOUTH_CAIRO",
  "المقطم": "SOUTH_CAIRO", "حلوان": "SOUTH_CAIRO",
  "15 مايو": "SOUTH_CAIRO", "مدينة نصر": "SOUTH_CAIRO",
  // EAST_CAIRO
  "التجمع الأول/الثالث/الخامس": "EAST_CAIRO", "التجمع الاول": "EAST_CAIRO",
  "التجمع الثالث": "EAST_CAIRO", "التجمع الخامس": "EAST_CAIRO",
  "الرحاب": "EAST_CAIRO", "مدينتي": "EAST_CAIRO", "الشروق": "EAST_CAIRO",
  "العاشر من رمضان": "EAST_CAIRO", "العبور": "EAST_CAIRO",
  "المستقبل": "EAST_CAIRO", "مدينة بدر": "EAST_CAIRO"
};

// --- DISPATCH HELPERS ---

function euclideanDist(a, b) {
  const dlat = a.lat - b.lat;
  const dlng = a.lng - b.lng;
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

// Two zones are compatible if NO pair of their areas exceeds the incompatibility threshold
function zonesCompatible(areasA, areasB) {
  for (const a of areasA) {
    const coordA = areaCoordinates[a];
    if (!coordA) continue;
    for (const b of areasB) {
      const coordB = areaCoordinates[b];
      if (!coordB) continue;
      if (euclideanDist(coordA, coordB) > INCOMPAT_THRESHOLD) return false;
    }
  }
  return true;
}

// Single-linkage (minimum) distance between two area sets
function interZoneDist(areasA, areasB) {
  let min = Infinity;
  for (const a of areasA) {
    const coordA = areaCoordinates[a];
    if (!coordA) continue;
    for (const b of areasB) {
      const coordB = areaCoordinates[b];
      if (!coordB) continue;
      const d = euclideanDist(coordA, coordB);
      if (d < min) min = d;
    }
  }
  return min;
}

// Max orders for a zone: 5 if all areas are Giza, otherwise 7
function getZoneMax(areas) {
  return areas.every(a => AREA_REGION[a] === 'GIZA') ? GIZA_MAX : CAIRO_MAX;
}

/**
 * Assigns orders to drivers using geographic clustering.
 * Returns [{ order_id, driver_number }] — same shape as old ML API response.
 *
 * Three modes based on totalOrders / drivers_count:
 *   >= 4 → fine-grained HAC on individual areas
 *   >= 2 → group areas into 4 macro-regions
 *   < 2  → group areas into 2 super-regions (Giza vs Cairo)
 */
function dispatchOrders(ordersWithCoords, drivers_count) {
  if (!ordersWithCoords.length) return [];

  // Step 1: group orders by area
  const areaMap = new Map();
  for (const o of ordersWithCoords) {
    const area = o.originalOrder.delivery_area;
    if (!areaMap.has(area)) areaMap.set(area, []);
    areaMap.get(area).push(o);
  }

  const totalOrders = ordersWithCoords.length;
  const ratio = totalOrders / drivers_count;

  // Step 2: build zones based on mode
  let zones; // each zone: { areas: string[], orders: object[] }

  if (ratio >= 4) {
    // Fine-grained: start with one zone per unique area, then HAC
    zones = Array.from(areaMap.entries()).map(([area, orders]) => ({
      areas: [area],
      orders
    }));

    // HAC: merge closest compatible pair until count <= drivers_count or no merge possible
    while (zones.length > drivers_count) {
      let bestI = -1, bestJ = -1, bestDist = Infinity;
      for (let i = 0; i < zones.length; i++) {
        for (let j = i + 1; j < zones.length; j++) {
          if (!zonesCompatible(zones[i].areas, zones[j].areas)) continue;
          const d = interZoneDist(zones[i].areas, zones[j].areas);
          if (d < bestDist) { bestDist = d; bestI = i; bestJ = j; }
        }
      }
      if (bestI === -1) break; // no compatible merge possible
      zones[bestI] = {
        areas: [...zones[bestI].areas, ...zones[bestJ].areas],
        orders: [...zones[bestI].orders, ...zones[bestJ].orders]
      };
      zones.splice(bestJ, 1);
    }

    // If still more zones than drivers (all incompatible), force-merge smallest by order count
    while (zones.length > drivers_count) {
      zones.sort((a, b) => a.orders.length - b.orders.length);
      zones[0] = {
        areas: [...zones[0].areas, ...zones[1].areas],
        orders: [...zones[0].orders, ...zones[1].orders]
      };
      zones.splice(1, 1);
    }

  } else {
    // 4-region or 2-region: group areas into macro buckets
    const buckets = new Map();
    for (const [area, orders] of areaMap.entries()) {
      let key;
      if (ratio >= 2) {
        // 4-region mode
        key = AREA_REGION[area] || 'SOUTH_CAIRO';
      } else {
        // 2-region mode: Giza vs Cairo
        key = (AREA_REGION[area] === 'GIZA') ? 'GIZA' : 'CAIRO';
      }
      if (!buckets.has(key)) buckets.set(key, { areas: [], orders: [] });
      const bucket = buckets.get(key);
      if (!bucket.areas.includes(area)) bucket.areas.push(area);
      bucket.orders.push(...orders);
    }
    zones = Array.from(buckets.values());
  }

  // Capacity-balance: if total slot demand exceeds drivers_count, merge smallest zones
  // until demand fits — this prevents large zones being squeezed to 1 slot by the
  // proportional formula when there are exactly as many zones as drivers.
  while (zones.length > 1) {
    const sn = zones.map(z => Math.max(1, Math.ceil(z.orders.length / getZoneMax(z.areas))));
    if (sn.reduce((s, n) => s + n, 0) <= drivers_count) break;
    zones.sort((a, b) => a.orders.length - b.orders.length);
    zones[0] = {
      areas: [...zones[0].areas, ...zones[1].areas],
      orders: [...zones[0].orders, ...zones[1].orders]
    };
    zones.splice(1, 1);
  }

  // Step 3: allocate driver slots to zones
  const slotsNeeded = zones.map(z => Math.max(1, Math.ceil(z.orders.length / getZoneMax(z.areas))));
  const totalSlotsNeeded = slotsNeeded.reduce((s, n) => s + n, 0);

  let slotAlloc;
  if (totalSlotsNeeded <= drivers_count) {
    slotAlloc = [...slotsNeeded];
  } else {
    // More demand than available drivers — distribute proportionally
    slotAlloc = slotsNeeded.map(n => Math.max(1, Math.floor(n / totalSlotsNeeded * drivers_count)));
    let remainder = drivers_count - slotAlloc.reduce((s, n) => s + n, 0);
    // Distribute remainder by largest fractional part
    const fracs = slotsNeeded.map((n, i) => ({
      i,
      frac: (n / totalSlotsNeeded * drivers_count) - slotAlloc[i]
    }));
    fracs.sort((a, b) => b.frac - a.frac);
    for (let k = 0; k < remainder; k++) slotAlloc[fracs[k].i]++;
  }

  // Step 4: split each zone's orders across its allocated slots, enforcing DRIVER_MIN
  const finalSlots = []; // { orders: [] }
  for (let zi = 0; zi < zones.length; zi++) {
    const zoneOrders = zones[zi].orders;
    let n = slotAlloc[zi];

    if (zoneOrders.length === 0) continue;

    // Build n roughly equal chunks
    const chunks = [];
    let start = 0;
    for (let k = 0; k < n; k++) {
      const chunkSize = Math.ceil((zoneOrders.length - start) / (n - k));
      chunks.push(zoneOrders.slice(start, start + chunkSize));
      start += chunkSize;
    }

    // Enforce DRIVER_MIN: merge tiny chunks into previous
    const valid = [];
    for (const chunk of chunks) {
      if (chunk.length === 0) continue;
      if (valid.length > 0 && chunk.length < DRIVER_MIN) {
        valid[valid.length - 1].push(...chunk);
      } else {
        valid.push(chunk);
      }
    }
    // Last chunk may still be too small after merging
    while (valid.length > 1 && valid[valid.length - 1].length < DRIVER_MIN) {
      const last = valid.pop();
      valid[valid.length - 1].push(...last);
    }

    for (const chunk of valid) {
      if (chunk.length > 0) finalSlots.push({ orders: chunk });
    }
  }

  // Step 5: assign driver numbers
  const assignments = [];
  finalSlots.forEach((slot, idx) => {
    const driver_number = idx + 1;
    for (const o of slot.orders) {
      assignments.push({ order_id: o.id, driver_number });
    }
  });

  return assignments;
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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

    // 2. Prepare data for dispatch
    const ordersWithCoordinates = orders.map(order => {
      const coords = getCoordinates(order.delivery_area);
      return {
        id: order.id.toString(),
        lat: coords.lat,
        lng: coords.lng,
        originalOrder: order
      };
    });

    // 3. Assign drivers using local geographic clustering
    const assignments = dispatchOrders(ordersWithCoordinates, drivers_count);

    // 4. Group orders by driver number
    const driverAssignments = Array.from({ length: drivers_count }, (_, i) => ({
      driver_name: `Driver ${i + 1}`,
      driver_number: i + 1,
      orders: [],
      areas: new Set()
    }));

    assignments.forEach(assignment => {
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
