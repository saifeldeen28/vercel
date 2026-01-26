export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  // --- CONFIGURATION ---
  const INSTANCE_ID = 'REDACTED_INSTANCE_ID';
  const TOKEN = 'fa3a7a65a16248409e35fa8c8ed25ec086ebda5b67bc437f9f';
  const CHAT_ID = "120363408155697195@g.us";
  const SHOPIFY_TOKEN = 'REDACTED_SHOPIFY_TOKEN'; 
  const STORE_DOMAIN = 'breakfastgift.myshopify.com'; 

  try {
    const { 
      name, customer, shipping_address, billing_address, 
      note, note_attributes, line_items, payment_gateway_names,
      total_price, currency 
    } = req.body;

    // 1. Logic for Name, Delivery, and Payment (Preserved)
    const getDisplayName = () => {
      const addr = shipping_address || billing_address || customer || {};
      return `${addr.first_name || ''} ${addr.last_name || ''}`.trim() || "عميل غير معروف";
    };

    const deliveryAttribute = note_attributes?.find(attr => {
      const key = attr.name.toLowerCase();
      return key.includes('delivery') || key.includes('تاريخ') || key.includes('date');
    });

    let dayName = "غير محدد";
    if (deliveryAttribute?.value) {
      const deliveryDate = new Date(deliveryAttribute.value);
      dayName = !isNaN(deliveryDate) 
        ? new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(deliveryDate)
        : deliveryAttribute.value;
    }

    const paymentMethod = payment_gateway_names?.length > 0 ? payment_gateway_names[0] : "غير محدد";
    const isCOD = paymentMethod.toLowerCase().includes('cash') || 
                  paymentMethod.toLowerCase().includes('manual') || 
                  paymentMethod.includes('الدفع عند الاستلام');
    const totalDisplay = isCOD ? `\n💰 *المبلغ المطلوب (COD):* ${total_price} ${currency}` : "";

    // 2. Format Products Summary (Preserved)
    let productsSummary = "";
    line_items.forEach((item, i) => {
      productsSummary += `📦 *المنتج ${i + 1}:* ${item.title}\n`;
      if (item.variant_title && item.variant_title !== "Default Title") productsSummary += `🔹 النوع: ${item.variant_title}\n`;
      productsSummary += `الكمية: ${item.quantity}\n`;
      if (item.properties?.length > 0) {
        item.properties.forEach(prop => {
          if (!prop.name.toLowerCase().includes('appid') && !prop.name.startsWith('__')) {
            productsSummary += `📝 _${prop.name.replace(/^_+/, '')}:_ ${prop.value}\n`;
          }
        });
      }
      productsSummary += `\n`;
    });

    const fullDetailsCaption = `*طلب جديد - ${name}* 🚀\n\n` +
                               `*يوم التوصيل:* ${dayName}\n` +
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
      // No images found? Send text only.
      await fetch(`https://api.green-api.com/waInstance${INSTANCE_ID}/sendMessage/${TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: CHAT_ID, message: fullDetailsCaption })
      });
    } else {
      // Loop through unique images
      for (let i = 0; i < uniqueItems.length; i++) {
        const isLast = (i === uniqueItems.length - 1);
        await fetch(`https://api.green-api.com/waInstance${INSTANCE_ID}/sendFileByUrl/${TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: CHAT_ID,
            urlFile: uniqueItems[i].url,
            fileName: `${uniqueItems[i].title}.jpg`,
            // ONLY the last photo gets the full details caption
            caption: isLast ? fullDetailsCaption : `📸 المنتج: ${uniqueItems[i].title}`
          })
        });
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
