import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  // --- CONFIGURATION ---
  const INSTANCE_ID = process.env.GREEN_API_INSTANCE_ID;
  const TOKEN = process.env.GREEN_API_TOKEN;
  const CHAT_ID = process.env.GREEN_API_GROUP_CHAT_ID;
  const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
  const STORE_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;

  let whatsappSuccess = false;
  let databaseSuccess = false;
  let errors = [];

  try {
    const { 
      id, name, customer, shipping_address, billing_address, 
      note, note_attributes, line_items, payment_gateway_names,
      total_price, currency 
    } = req.body;

    // 1. Extract all name variants
    const getDisplayName = async () => {
      const addr = shipping_address || billing_address || customer || {};
      let first = addr.first_name || '';
      let last = addr.last_name || '';
      const fullName = `${first} ${last}`.trim();

      const isEnglish = /[a-zA-Z]/.test(first + last);

      if (isEnglish && fullName) {
        try {
          const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=${encodeURIComponent(fullName)}`);
          const data = await res.json();
          
          if (data && data[0] && data[0][0] && data[0][0][0]) {
            return data[0][0][0];
          }
        } catch (e) {
          console.error("Translation failed, falling back to original name", e);
        }
      }

      return fullName || "عميل غير معروف";
    };

    // Extract all possible names
    const customerAccountName = customer?.first_name && customer?.last_name 
      ? `${customer.first_name} ${customer.last_name}`.trim() 
      : null;
    
    const shippingName = shipping_address?.first_name && shipping_address?.last_name
      ? `${shipping_address.first_name} ${shipping_address.last_name}`.trim()
      : null;
    
    const billingName = billing_address?.first_name && billing_address?.last_name
      ? `${billing_address.first_name} ${billing_address.last_name}`.trim()
      : null;

    // Extract all possible phone numbers
    const customerAccountPhone = customer?.phone || null;
    const shippingPhone = shipping_address?.phone || null;
    const billingPhone = billing_address?.phone || null;

    // Delivery date logic
    const deliveryAttribute = note_attributes?.find(attr => {
      const key = attr.name.toLowerCase();
      return key.includes('delivery') || key.includes('تاريخ') || key.includes('date');
    });
    const deliveryTimeAttribute = note_attributes?.find(attr => {
      const key = attr.name.toLowerCase();
      return key.includes('due time') || key === 'order due time';
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
    const totalDisplay = `\n💰 *المبلغ المطلوب (COD):* ${total_price} ${currency}` : "";

    // 2. Format Products Summary (Excluding cl_option)
    let productsSummary = "";
    line_items.forEach((item, i) => {
      productsSummary += `📦 *المنتج ${i + 1}:* ${item.title}\n`;
      if (item.variant_title && item.variant_title !== "Default Title") {
        productsSummary += `🔹 النوع: ${item.variant_title}\n`;
      }
      productsSummary += `الكمية: ${item.quantity}\n`;
      
      if (item.properties?.length > 0) {
        item.properties.forEach(prop => {
          const propName = prop.name.toLowerCase();
          // Filter logic: ignore appid, underscore prefixes, and cl_option*
          if (
            !propName.includes('appid') &&
            !propName.startsWith('__') &&
            !propName.startsWith('cl_option')
          ) {
            productsSummary += `📝 _${prop.name.replace(/^_+/, '')}:_ ${prop.value}\n`;
          }
        });
      }
      productsSummary += `\n`;
    });

    const displayName = await getDisplayName();

    // 3. Create formatted address
    const address = shipping_address;
    const fullAddress = address 
      ? `${address.address1 || ''} ${address.address2 || ''}, ${address.city || ''}, ${address.province || ''}`.trim()
      : 'لا يوجد عنوان';

    const del_area= req.body.shipping_lines?.[0]?.title || req.body.shipping_lines?.[0]?.code;//shipping_address?.city || billing_address?.city || null

    const formatDeliveryTime = (value) => {
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
    };
    // 4. Build WhatsApp caption
    const fullDetailsCaption = `*طلب جديد - ${name}* 🚀\n\n` +
        `📅 *تاريخ التوصيل:* ${deliveryDateFormatted}\n` +
        `🗓️ *يوم التوصيل:* ${dayName}\n` +
        `⏰ *وقت التوصيل:* ${formatDeliveryTime(deliveryTimeAttribute?.value)}\n` +
        `📍 *المنطقة:* ${del_area}\n` +
        `*العميل:* ${displayName}\n` +
        `*رقم الشحن:* ${shipping_address?.phone || 'غير مسجل'}\n\n` +
        `*المنتجات:*\n${productsSummary}` +
        `*العنوان:* \n${fullAddress}\n\n` +
        `*طريقة الدفع:* ${paymentMethod}${totalDisplay}\n` + 
        `*ملحوظة:* ${note || 'لا توجد ملاحظات'}`;

    // 5. Collect Unique Product Images
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
            uniqueItems.push({ 
              url: data.product.image.src, 
              title: item.title,
              productId: item.product_id
            });
          }
        } catch (e) { 
          console.error("Fetch error for product image", e); 
        }
        seenIds.add(item.product_id);
      }
    }

    // 6. Send WhatsApp Messages (Independent of database)
    try {
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
      whatsappSuccess = true;
      console.log(`WhatsApp message sent for order ${name}`);
    } catch (whatsappError) {
      console.error('WhatsApp send failed:', whatsappError);
      errors.push({ service: 'WhatsApp', error: whatsappError.message });
    }

    // 7. Add ALL ORDERS to Database (Independent of WhatsApp)
    try {
      const shopifyId = id.toString();

      // INSERT/UPDATE ORDER with all new fields
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .upsert([{ 
          shopify_order_id: shopifyId,
          order_name: name,
          
          // All name variants
          customer_account_name: customerAccountName,
          shipping_name: shippingName,
          billing_name: billingName,
          
          // All phone variants
          customer_account_phone: customerAccountPhone,
          shipping_phone: shippingPhone,
          billing_phone: billingPhone,
          
          // Delivery info
          delivery_date: extractedDate,
          delivery_day_name: dayName,
          delivery_date_full: deliveryDateFormatted,
          delivery_area: del_area,
          delivery_address_line1: shipping_address?.address1 || null,
          delivery_address_line2: shipping_address?.address2 || null,
          delivery_full_address: fullAddress,
          
          // Payment
          payment_method: paymentMethod,
          is_cod: isCOD,
          total_price: parseFloat(total_price),
          
          // Management
          status: 'pending',
          assigned_driver: null,
          
          // Notes
          order_notes: note || null
        }], { onConflict: 'shopify_order_id' })
        .select();

      if (orderError) throw orderError;

      // DELETE old items and INSERT new ones
      await supabase.from('order_items').delete().eq('order_id', order[0].id);

      const items = line_items.map(item => {
        // Build custom properties excluding cl_option*
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

        // Find matching image URL
        const matchingImage = uniqueItems.find(ui => ui.productId === item.product_id);

        return {
          order_id: order[0].id,
          shopify_product_id: item.product_id?.toString() || null,
          item_name: item.title,
          variant_title: item.variant_title !== "Default Title" ? item.variant_title : null,
          quantity: item.quantity,
          product_image_url: matchingImage?.url || null,
          custom_properties: Object.keys(customProps).length > 0 ? customProps : null
        };
      });

      const { error: itemsError } = await supabase.from('order_items').insert(items);
      if (itemsError) throw itemsError;

      databaseSuccess = true;
      console.log(`Order ${shopifyId} synced to database for delivery on ${extractedDate}`);
    } catch (dbError) {
      console.error('Database sync failed:', dbError);
      errors.push({ service: 'Database', error: dbError.message });
    }

    // Return status based on what succeeded
    return res.status(200).json({ 
      success: whatsappSuccess || databaseSuccess,
      whatsappSent: whatsappSuccess,
      databaseSaved: databaseSuccess,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Handler critical error:', error);
    return res.status(500).json({ 
      success: false,
      error: error.message,
      whatsappSent: whatsappSuccess,
      databaseSaved: databaseSuccess
    });
  }
}
