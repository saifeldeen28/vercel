import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const INSTANCE_ID = process.env.GREEN_API_INSTANCE_ID;
const TOKEN = process.env.GREEN_API_TOKEN;
const CHAT_ID = process.env.GREEN_API_GROUP_CHAT_ID;

// --- HELPERS ---

function deriveStatus(order) {
  if (order.fulfillment_status === 'fulfilled') return 'fulfilled';
  if (order.financial_status === 'paid') return 'paid';
  return 'pending';
}

function extractOrderData(order) {
  const {
    id, name, customer, shipping_address, billing_address,
    note, note_attributes, payment_gateway_names,
    total_price, financial_status, fulfillment_status, shipping_lines
  } = order;

  const customerAccountName = customer?.first_name && customer?.last_name
    ? `${customer.first_name} ${customer.last_name}`.trim() : null;
  const shippingName = shipping_address?.first_name && shipping_address?.last_name
    ? `${shipping_address.first_name} ${shipping_address.last_name}`.trim() : null;
  const billingName = billing_address?.first_name && billing_address?.last_name
    ? `${billing_address.first_name} ${billing_address.last_name}`.trim() : null;

  const deliveryAttribute = note_attributes?.find(attr => {
    const key = attr.name.toLowerCase();
    return key.includes('delivery') || key.includes('تاريخ') || key.includes('date');
  });

  let dayName = 'غير محدد';
  let deliveryDateFormatted = 'غير محدد';
  let extractedDate = null;
  if (deliveryAttribute?.value) {
    const deliveryDate = new Date(deliveryAttribute.value);
    if (!isNaN(deliveryDate)) {
      dayName = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(deliveryDate);
      deliveryDateFormatted = new Intl.DateTimeFormat('ar-EG', {
        year: 'numeric', month: 'long', day: 'numeric'
      }).format(deliveryDate);
      extractedDate = deliveryDate.toISOString().split('T')[0];
    } else {
      dayName = deliveryAttribute.value;
      deliveryDateFormatted = deliveryAttribute.value;
    }
  }

  const paymentMethod = payment_gateway_names?.length > 0 ? payment_gateway_names[0] : 'غير محدد';
  const isCOD = paymentMethod.toLowerCase().includes('cash') ||
    paymentMethod.toLowerCase().includes('manual') ||
    paymentMethod.includes('الدفع عند الاستلام');

  const address = shipping_address;
  const fullAddress = address
    ? `${address.address1 || ''} ${address.address2 || ''}, ${address.city || ''}, ${address.province || ''}`.trim()
    : 'لا يوجد عنوان';

  const del_area = shipping_lines?.[0]?.title || shipping_lines?.[0]?.code || null;

  return {
    shopify_order_id: id.toString(),
    order_name: name,
    customer_account_name: customerAccountName,
    shipping_name: shippingName,
    billing_name: billingName,
    customer_account_phone: customer?.phone || null,
    shipping_phone: shipping_address?.phone || null,
    billing_phone: billing_address?.phone || null,
    delivery_date: extractedDate,
    delivery_day_name: dayName,
    delivery_date_full: deliveryDateFormatted,
    delivery_area: del_area,
    delivery_address_line1: shipping_address?.address1 || null,
    delivery_address_line2: shipping_address?.address2 || null,
    delivery_full_address: fullAddress,
    payment_method: paymentMethod,
    is_cod: isCOD,
    total_price: parseFloat(total_price),
    status: deriveStatus(order),
    order_notes: note || null
    // assigned_driver intentionally omitted — defaults to NULL on insert
  };
}

function extractOrderItems(order, dbOrderId) {
  return order.line_items.map(item => {
    const customProps = {};
    if (item.properties?.length > 0) {
      item.properties.forEach(prop => {
        const propName = prop.name.toLowerCase();
        if (!propName.includes('appid') && !propName.startsWith('__') && propName !== 'cl_option') {
          customProps[prop.name] = prop.value;
        }
      });
    }
    return {
      order_id: dbOrderId,
      shopify_product_id: item.product_id?.toString() || null,
      item_name: item.title,
      variant_title: item.variant_title !== 'Default Title' ? item.variant_title : null,
      quantity: item.quantity,
      custom_properties: Object.keys(customProps).length > 0 ? customProps : null
    };
  });
}

async function fetchShopifyOrders(updatedAtMin) {
  const orders = [];
  let url = `https://${STORE_DOMAIN}/admin/api/2024-01/orders.json?updated_at_min=${updatedAtMin}&limit=250&status=any`;

  while (url) {
    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } });
    if (!res.ok) throw new Error(`Shopify API error: ${res.status} ${await res.text()}`);
    const data = await res.json();
    orders.push(...data.orders);
    const nextMatch = res.headers.get('link')?.match(/<([^>]+)>;\s*rel="next"/);
    url = nextMatch ? nextMatch[1] : null;
  }

  return orders;
}

async function sendWhatsApp(order, orderData) {
  const codLine = orderData.is_cod ? `\n💰 *COD:* ${order.total_price} ${order.currency}` : '\n✅ مدفوع أونلاين';
  const message =
    `⚠️ *طلب مُسترجع - ${orderData.order_name}*\n` +
    `📅 *التوصيل:* ${orderData.delivery_date_full}\n` +
    `📍 *المنطقة:* ${orderData.delivery_area || 'غير محدد'}\n` +
    `👤 *العميل:* ${orderData.shipping_name || orderData.customer_account_name || 'غير محدد'}\n` +
    `📞 ${orderData.shipping_phone || orderData.customer_account_phone || 'غير مسجل'}` +
    codLine;

  const res = await fetch(
    `https://api.green-api.com/waInstance${INSTANCE_ID}/sendMessage/${TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: CHAT_ID, message })
    }
  );
  if (!res.ok) throw new Error(`Green API responded with ${res.status}`);
}

// --- HANDLER ---

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const now = new Date();
    const updatedAtMin = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Fetch all orders from Shopify updated in the last 24h
    const shopifyOrders = await fetchShopifyOrders(updatedAtMin);
    console.log(`Reconcile: ${shopifyOrders.length} orders from Shopify`);

    if (shopifyOrders.length === 0) {
      return res.status(200).json({ success: true, message: 'No orders in window', orders_checked: 0 });
    }

    // 2. Bulk-fetch only id + status for all matching records from Supabase (one query)
    const shopifyIds = shopifyOrders.map(o => o.id.toString());
    const { data: existingRows, error: fetchError } = await supabase
      .from('orders')
      .select('shopify_order_id, status')
      .in('shopify_order_id', shopifyIds);

    if (fetchError) throw fetchError;

    const existingMap = new Map(existingRows.map(r => [r.shopify_order_id, r.status]));

    // 3. Loop by id and status — decide action for each order
    let inserted = 0;
    let statusUpdated = 0;
    let skipped = 0;
    const errors = [];

    for (const order of shopifyOrders) {
      const shopifyId = order.id.toString();
      const shopifyStatus = deriveStatus(order);
      const dbStatus = existingMap.get(shopifyId); // undefined = not in DB

      try {
        if (dbStatus === undefined) {
          // --- NEW ORDER: full insert + WhatsApp ---
          const orderData = extractOrderData(order);

          const { data: newOrder, error: insertError } = await supabase
            .from('orders')
            .insert([orderData])
            .select('id')
            .single();

          if (insertError) throw insertError;

          const items = extractOrderItems(order, newOrder.id);
          if (items.length > 0) {
            const { error: itemsError } = await supabase.from('order_items').insert(items);
            if (itemsError) throw itemsError;
          }

          try {
            await sendWhatsApp(order, orderData);
          } catch (waErr) {
            console.error(`WhatsApp failed for new order ${order.name}:`, waErr.message);
            errors.push({ order: order.name, step: 'whatsapp', error: waErr.message });
          }

          console.log(`Reconcile: inserted missing order ${order.name}`);
          inserted++;

        } else if (dbStatus !== shopifyStatus) {
          // --- STATUS MISMATCH: update status column only ---
          const { error: updateError } = await supabase
            .from('orders')
            .update({ status: shopifyStatus })
            .eq('shopify_order_id', shopifyId);

          if (updateError) throw updateError;

          console.log(`Reconcile: updated status for ${order.name} (${dbStatus} → ${shopifyStatus})`);
          statusUpdated++;

        } else {
          // --- NO CHANGE: skip ---
          skipped++;
        }

      } catch (err) {
        console.error(`Reconcile error for order ${order.name}:`, err.message);
        errors.push({ order: order.name, error: err.message });
      }
    }

    const summary = {
      success: true,
      window: '24h',
      orders_checked: shopifyOrders.length,
      inserted,
      status_updated: statusUpdated,
      skipped,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log('Reconcile complete:', summary);
    return res.status(200).json(summary);

  } catch (err) {
    console.error('Reconcile fatal error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
