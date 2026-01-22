export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { 
      name, 
      customer, 
      shipping_address, 
      billing_address, // Added billing address
      note, 
      note_attributes,
      line_items 
    } = req.body;

    // --- NEW NAME PRIORITY LOGIC ---
    // 1. Shipping Name -> 2. Billing Name -> 3. Account Name
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
    // --------------------------------

    // 1. Extract Delivery Date from Note Attributes
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

    // 2. Format Products, Variants, and Smart Filter Properties
    let productsSummary = "";
    line_items.forEach((item, index) => {
      productsSummary += `📦 *المنتج ${index + 1}:* ${item.title}\n`;
      
      if (item.variant_title && item.variant_title !== "" && item.variant_title !== "Default Title") {
        if (item.options && item.options.length > 0) {
          item.options.forEach(opt => {
            productsSummary += `🔹 *${opt.name}:* ${opt.value}\n`;
          });
        } else {
          productsSummary += `🔹 *النوع:* ${item.variant_title}\n`;
        }
      }
      
      productsSummary += `الكمية: ${item.quantity}\n`;
      
      if (item.properties && item.properties.length > 0) {
        item.properties.forEach(prop => {
          const key = prop.name;
          const keyLower = key.toLowerCase();
          const isJunk = keyLower.includes('appid') || keyLower.includes('options') || keyLower.includes('cl_');
          const isImportant = keyLower.includes('message') || keyLower.includes('name') || keyLower.includes('sticker') || keyLower.includes('balloon') || keyLower.includes('كارت') || keyLower.includes('gift');

          if (isImportant || (!isJunk && !key.startsWith('__'))) {
            const cleanLabel = key.replace(/^_+/, ''); 
            productsSummary += `📝 _${cleanLabel}:_ ${prop.value}\n`;
          }
        });
      }
      productsSummary += `\n`;
    });

    // 3. Format Address and Phone Numbers
    const address = shipping_address ? 
      `${shipping_address.address1}${shipping_address.address2 ? ' ، ' + shipping_address.address2 : ''}\n${shipping_address.city}` 
      : 'لا يوجد عنوان';

    const customerPhone = customer?.phone || 'غير مسجل';
    const shippingPhone = shipping_address?.phone || 'غير مسجل';

    // 4. Build the Final WhatsApp Message Template
    // Used the new "displayName" here
    const message = `*طلب جديد - ${name}* 🚀\n\n` +
                    `*يوم التوصيل:* ${dayName}\n` +
                    `*العميل:* ${displayName}\n` + 
                    `*رقم الحساب:* ${customerPhone}\n` +
                    `*رقم الشحن:* ${shippingPhone}\n\n` +
                    `*المنتجات:*\n${productsSummary}` +
                    `*العنوان:* \n${address}\n\n` +
                    `*ملحوظة العميل:* ${note || 'لا توجد ملاحظات'}`;

    // 5. Send to Green API
    const greenApiUrl = `https://api.green-api.com/waInstanceREDACTED_INSTANCE_ID/sendMessage/fa3a7a65a16248409e35fa8c8ed25ec086ebda5b67bc437f9f`;

    const response = await fetch(greenApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: "120363408155697195@g.us",
        message: message
      })
    });

    if (!response.ok) {
      throw new Error(`Green API failed with status ${response.status}`);
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Execution Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
