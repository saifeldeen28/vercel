import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  // --- CONFIGURATION ---
  const INSTANCE_ID = 'REDACTED_INSTANCE_ID';
  const TOKEN = 'REDACTED_GREEN_API_TOKEN';
  const CHAT_ID = "120363408155697195@g.us";
  const SHOPIFY_TOKEN = 'REDACTED_SHOPIFY_TOKEN'; 
  const STORE_DOMAIN = 'breakfastgift.myshopify.com'; 

  try {
    const { 
      id, name, customer, shipping_address, billing_address, 
      note, note_attributes, line_items, payment_gateway_names,
      total_price, currency 
    } = req.body;

    // 1. Logic for Name, Delivery, and Payment
    const getDisplayName = () => {
      const addr = shipping_address || billing_address || customer || {};
      return `${addr.first_name || ''} ${addr.last_name || ''}`.trim() || "عميل غير معروف";
    };

    const deliveryAttribute = note_attributes?.find(attr => {
      const key = attr.name.toLowerCase();
      return key.includes('delivery') || key.includes('تاريخ') || key.includes('date');
    });

    let dayName = "غير محدد";
    let deliveryDateFormatted = "غير محدد";
    let extractedDate = null;
    if (deliveryAttribute?.value) {
      const deliveryDate = new Date(deliveryAttribute.value);
      if (!isNaN(deliveryDate)) {
        dayName = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(deliveryDate);
        deliveryDateFormatted = new Intl.DateTimeFormat('ar-EG', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }).format(deliveryDate);
        extractedDate = deliveryDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      } else {
        dayName = deliveryAttribute.value;
        deliveryDateFormatted = deliveryAttribute.value;
      }
    }

    const paymentMethod = payment_gateway_names?.length > 0 ? payment_gateway_names[0] : "غير محدد";
    const isCOD = paymentMethod.toLowerCase().includes('cash') || 
                  paymentMethod.toLowerCase().includes('manual') || 
                  paymentMethod.includes('الدفع عند الاستلام');
    const totalDisplay = isCOD ? `\n💰 *المبلغ المطلوب (COD):* ${total_price} ${currency}` : "";

    // 2. Format Products Summary (Excluding cl_option)
    let productsSummary = "";
    line_items.forEach((item, i) => {
      productsSummary += `📦 *المنتج ${i + 1}:* ${item.title}\n`;
      if (item.variant_title && item.variant_title !== "Default Title") productsSummary += `🔹 النوع: ${item.variant_title}\n`;
      productsSummary += `الكمية: ${item.quantity}\n`;
      
      if (item.properties?.length > 0) {
        item.properties.forEach(prop => {
          const propName = prop.name.toLowerCase();
          // Filter logic: ignore appid, underscore prefixes, and cl_option
          if (
            !propName.includes('appid') && 
            !propName.startsWith('__') && 
            propName !== 'cl_option'
          ) {
            productsSummary += `📝 _${prop.name.replace(/^_+/, '')}:_ ${prop.value}\n`;
          }
        });
      }
      productsSummary += `\n`;
    });

    const fullDetailsCaption = `*طلب جديد - ${name}* 🚀\n\n` +
                               `📅 *تاريخ التوصيل:* ${deliveryDateFormatted}\n` +
                               `🗓️ *يوم التوصيل:* ${dayName}\n` +
                               `*العميل:* ${getDisplayName()}\n` +
                               `*رقم الشحن:* ${shipping_address?.phone || 'غير مسجل'}\n\n` +
                               `*المنتجات:*\n${productsSummary}` +
                               `*العنوان:* \n${shipping_address?.address1 || 'لا يوجد عنوان'}\n\n` +
                               `*طريقة الدفع:* ${paymentMethod}${totalDisplay}\n` + 
                               `*ملحوظة:* ${note || 'لا توجد ملاحظات'}`;

    // 3. Collect Unique Product Images
    const uniqueItems = [];
    const seenIds = new Set();
    for (const item of line_items) {
      if (!seenIds.has(item.product_id)) {
        try {
          const res = await fetch(`https://${STORE_DOMAIN}/admin/api/2024-01/products/${item.product_id}.json?fields=image,title`, {
            headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
          });
          const data = await res.json();
          if (data.product?.image?.src) {
            uniqueItems.push({ url: data.product.image.src, title: item.title });
          }
        } catch (e) { console.error("Fetch error", e); }
        seenIds.add(item.product_id);
      }
    }

    // 4. Send Messages Logic
    if (uniqueItems.length === 0) {
      await fetch(`https://api.green-api.com/waInstance${INSTANCE_ID}/sendMessage/${TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: CHAT_ID, message: fullDetailsCaption })
      });
    } else {
      for (let i = 0; i < uniqueItems.length; i++) {
        const isLast = (i === uniqueItems.length - 1);
        await fetch(`https://api.green-api.com/waInstance${INSTANCE_ID}/sendFileByUrl/${TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: CHAT_ID,
            urlFile: uniqueItems[i].url,
            fileName: `${uniqueItems[i].title}.jpg`,
            caption: isLast ? fullDetailsCaption : `📸 المنتج: ${uniqueItems[i].title}`
          })
        });
      }
    }

    // 5. Add to Database ONLY if COD
    if (isCOD) {
      const shopifyId = id.toString();

      // INSERT/UPDATE ORDER
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .upsert([{ 
          shopify_order_id: shopifyId, 
          customer_name: getDisplayName(),
          total_price: total_price,
          delivery_area: shipping_address?.city || 'Not Specified',
          delivery_date: extractedDate,
          status: 'pending'
        }], { onConflict: 'shopify_order_id' })
        .select();

      if (orderError) throw orderError;

      // INSERT ORDER ITEMS
      await supabase.from('order_items').delete().eq('order_id', order[0].id);

      const items = line_items.map(item => ({
        order_id: order[0].id,
        item_name: item.title,
        quantity: item.quantity
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(items);
      if (itemsError) throw itemsError;

      console.log(`COD Order ${shopifyId} synced to database for delivery on ${extractedDate}`);
    }

    return res.status(200).json({ success: true, addedToDatabase: isCOD });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}