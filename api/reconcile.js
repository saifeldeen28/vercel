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

function formatDeliveryTime(value) {
  if (!value) return 'غير محدد';
  const asNumber = Number(value);
  if (!isNaN(asNumber) && asNumber > 0) {
    const date = new Date(asNumber);
    if (!isNaN(date.getTime())) {
      return date.toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Africa/Cairo'
      });
    }
  }
  return value;
}

function extractOrderData(order) {
  const {
    id, name, customer, shipping_address, billing_address,
    note, note_attributes, payment_gateway_names,
    total_price, shipping_lines
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
        if (
          !propName.includes('appid') &&
          !propName.startsWith('__') &&
          !propName.startsWith('cl_option')
        ) {
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

async function fetchShopifyOrders(createdAtMin) {
  const orders = [];
  let url = `https://${STORE_DOMAIN}/admin/api/2024-01/orders.json?created_at_min=${createdAtMin}&limit=250&status=any`;

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

async function sendOrderWhatsApp(order, orderData) {
  const { name, note_attributes, line_items, total_price, currency } = order;

  // Translate customer name to Arabic if it's in English
  const addr = order.shipping_address || order.billing_address || order.customer || {};
  let displayName = `${addr.first_name || ''} ${addr.last_name || ''}`.trim() || 'عميل غير معروف';
  const isEnglish = /[a-zA-Z]/.test(displayName);
  if (isEnglish && displayName) {
    try {
      const res = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=${encodeURIComponent(displayName)}`
      );
      const data = await res.json();
      if (data?.[0]?.[0]?.[0]) displayName = data[0][0][0];
    } catch (e) {
      console.error('Translation failed, using original name', e);
    }
  }

  // Delivery time attribute
  const deliveryTimeAttribute = note_attributes?.find(attr => {
    const key = attr.name.toLowerCase();
    return key.includes('time') || key.includes('due');
  });

  // Build products summary
  let productsSummary = '';
  line_items.forEach((item, i) => {
    productsSummary += `📦 *المنتج ${i + 1}:* ${item.title}\n`;
    if (item.variant_title && item.variant_title !== 'Default Title') {
      productsSummary += `🔹 النوع: ${item.variant_title}\n`;
    }
    productsSummary += `الكمية: ${item.quantity}\n`;
    if (item.properties?.length > 0) {
      item.properties.forEach(prop => {
        const propName = prop.name.toLowerCase();
        if (
          !propName.includes('appid') &&
          !propName.startsWith('__') &&
          !propName.startsWith('cl_option')
        ) {
          productsSummary += `📝 _${prop.name.replace(/^_+/, '')}:_ ${prop.value}\n`;
        }
      });
    }
    productsSummary += '\n';
  });

  const totalDisplay = orderData.is_cod
    ? `\n💰 *المبلغ المطلوب (COD):* ${total_price} ${currency}`
    : '';

  const fullDetailsCaption =
    `⚠️ *طلب مُسترجع - ${name}* 🚀\n\n` +
    `📅 *تاريخ التوصيل:* ${orderData.delivery_date_full}\n` +
    `🗓️ *يوم التوصيل:* ${orderData.delivery_day_name}\n` +
    `⏰ *وقت التوصيل:* ${formatDeliveryTime(deliveryTimeAttribute?.value)}\n` +
    `📍 *المنطقة:* ${orderData.delivery_area || 'غير محدد'}\n` +
    `*العميل:* ${displayName}\n` +
    `*رقم الشحن:* ${orderData.shipping_phone || 'غير مسجل'}\n\n` +
    `*المنتجات:*\n${productsSummary}` +
    `*العنوان:* \n${orderData.delivery_full_address}\n\n` +
    `*طريقة الدفع:* ${orderData.payment_method}${totalDisplay}\n` +
    `*ملحوظة:* ${order.note || 'لا توجد ملاحظات'}`;

  // Fetch unique product images
  const uniqueItems = [];
  const seenIds = new Set();
  for (const item of line_items) {
    if (!seenIds.has(item.product_id)) {
      try {
        const res = await fetch(
          `https://${STORE_DOMAIN}/admin/api/2024-01/products/${item.product_id}.json?fields=image,title`,
          { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
        );
        const data = await res.json();
        if (data.product?.image?.src) {
          uniqueItems.push({ url: data.product.image.src, title: item.title, productId: item.product_id });
        }
      } catch (e) {
        console.error('Failed to fetch image for product', item.product_id, e);
      }
      seenIds.add(item.product_id);
    }
  }

  // Send WhatsApp — text only if no images, otherwise send images with caption on last one
  if (uniqueItems.length === 0) {
    const res = await fetch(
      `https://api.green-api.com/waInstance${INSTANCE_ID}/sendMessage/${TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: CHAT_ID, message: fullDetailsCaption })
      }
    );
    if (!res.ok) throw new Error(`Green API responded with ${res.status}`);
  } else {
    for (let i = 0; i < uniqueItems.length; i++) {
      const isLast = i === uniqueItems.length - 1;
      const res = await fetch(
        `https://api.green-api.com/waInstance${INSTANCE_ID}/sendFileByUrl/${TOKEN}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: CHAT_ID,
            urlFile: uniqueItems[i].url,
            fileName: `${uniqueItems[i].title}.jpg`,
            caption: isLast ? fullDetailsCaption : `📸 المنتج: ${uniqueItems[i].title}`
          })
        }
      );
      if (!res.ok) throw new Error(`Green API responded with ${res.status}`);
    }
  }
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
    const createdAtMin = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Fetch orders created in the last 24h (not updated_at — avoids pulling old orders)
    const shopifyOrders = await fetchShopifyOrders(createdAtMin);
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
          // --- NEW ORDER: full insert + full WhatsApp ---
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
            await sendOrderWhatsApp(order, orderData);
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
