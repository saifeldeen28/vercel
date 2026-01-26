export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const INSTANCE_ID = 'REDACTED_INSTANCE_ID';
  const TOKEN = 'fa3a7a65a16248409e35fa8c8ed25ec086ebda5b67bc437f9f';
  const CHAT_ID = "120363408155697195@g.us";

  try {
    const { 
      name, 
      customer, 
      shipping_address, 
      billing_address, 
      note, 
      note_attributes,
      line_items 
    } = req.body;

    const getPriorityName = () => {
      if (shipping_address?.first_name || shipping_address?.last_name) {
        return `${shipping_address.first_name || ''} ${shipping_address.last_name || ''}`.trim();
      }
      if (billing_address?.first_name || billing_address?.last_name) {
        return `${billing_address.first_name || ''} ${billing_address.last_name || ''}`.trim();
      }
      if (customer?.first_name || customer?.last_name) {
        return `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
      }
      return "عميل غير معروف";
    };

    const displayName = getPriorityName();

    // 1. Send Unique Photos First
    const processedProductIds = new Set();
    
    for (const item of line_items) {
      // Use product_id to ensure uniqueness (or variant_id if photos differ by variant)
      if (!processedProductIds.has(item.product_id) && item.image?.src) {
        try {
          await fetch(`https://api.green-api.com/waInstance${INSTANCE_ID}/sendFileByUrl/${TOKEN}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId: CHAT_ID,
              urlFile: item.image.src,
              fileName: `${item.title}.jpg`,
              caption: `صورة المنتج: ${item.title}`
            })
          });
          processedProductIds.add(item.product_id);
        } catch (imgErr) {
          console.error(`Failed to send image for ${item.title}:`, imgErr);
        }
      }
    }

    // 2. Format Delivery Date
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

    // 3. Format Products Summary
    let productsSummary = "";
    line_items.forEach((item, index) => {
      productsSummary += `📦 *المنتج ${index + 1}:* ${item.title}\n`;
      
      if (item.variant_title && item.variant_title !== "" && item.variant_title !== "Default Title") {
        productsSummary += `🔹 *النوع:* ${item.variant_title}\n`;
      }
      
      productsSummary += `الكمية: ${item.quantity}\n`;
      
      if (item.properties && item.properties.length > 0) {
        item.properties.forEach(prop => {
          const keyLower = prop.name.toLowerCase();
          const isJunk = keyLower.includes('appid') || keyLower.includes('options') || keyLower.includes('cl_');
          if (!isJunk && !prop.name.startsWith('__')) {
            productsSummary += `📝 _${prop.name.replace(/^_+/, '')}:_ ${prop.value}\n`;
          }
        });
      }
      productsSummary += `\n`;
    });

    const address = shipping_address ? 
      `${shipping_address.address1}${shipping_address.address2 ? ' ، ' + shipping_address.address2 : ''}\n${shipping_address.city}` 
      : 'لا يوجد عنوان';

    const customerPhone = customer?.phone || 'غير مسجل';
    const shippingPhone = shipping_address?.phone || 'غير مسجل';

    // 4. Build and Send Final Message
    const message = `*طلب جديد - ${name}* 🚀\n\n` +
                    `*يوم التوصيل:* ${dayName}\n` +
                    `*العميل:* ${displayName}\n` + 
                    `*رقم الحساب:* ${customerPhone}\n` +
                    `*رقم الشحن:* ${shippingPhone}\n\n` +
                    `*المنتجات:*\n${productsSummary}` +
                    `*العنوان:* \n${address}\n\n` +
                    `*ملحوظة العميل:* ${note || 'لا توجد ملاحظات'}`;

    const textResponse = await fetch(`https://api.green-api.com/waInstance${INSTANCE_ID}/sendMessage/${TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: CHAT_ID,
        message: message
      })
    });

    if (!textResponse.ok) {
      throw new Error(`Green API failed with status ${textResponse.status}`);
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Execution Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
