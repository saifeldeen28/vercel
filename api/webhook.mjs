export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { 
      name, 
      customer, 
      shipping_address, 
      note, 
      note_attributes,
      line_items 
    } = req.body;

    // 1. Extract Delivery Date from note_attributes
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

    // 2. Format Products and App-Specific Fields (Gift Messages, Stickers, etc.)
    let productsSummary = "";
    line_items.forEach((item, index) => {
      productsSummary += `📦 *المنتج ${index + 1}:* ${item.title}\n`;
      productsSummary += `الكمية: ${item.quantity}\n`;
      
      // Check for app properties (Gift message, sticker name, balloon, etc.)
      if (item.properties && item.properties.length > 0) {
        item.properties.forEach(prop => {
          productsSummary += `🔹 _${prop.name}:_ ${prop.value}\n`;
        });
      }
      productsSummary += `\n`;
    });

    // 3. Format Address
    const address = shipping_address ? 
      `${shipping_address.address1}${shipping_address.address2 ? ' ، ' + shipping_address.address2 : ''}\n${shipping_address.city}` 
      : 'لا يوجد عنوان';

    // 4. Build the Final Message
    // 1. Extract Phone Numbers
    const customerPhone = customer.phone || 'غير مسجل';
    const shippingPhone = shipping_address?.phone || 'غير مسجل';

    // 2. Build the Message Template
    const message = `*طلب جديد - ${name}* 🚀\n\n` +
                    `*يوم التوصيل:* ${dayName}\n` +
                    `*العميل:* ${customer.first_name} ${customer.last_name}\n` +
                    `*رقم الحساب:* ${customerPhone}\n` +
                    `*رقم الشحن:* ${shippingPhone}\n\n` +
                    `*المنتجات:*\n${productsSummary}` +
                    `*العنوان:* \n${address}\n\n` +
                    `*ملحوظة العميل:* ${note || 'لا توجد ملاحظات'}`;;

    // 5. Send to Green API
    const greenApiUrl = `https://api.green-api.com/waInstance7105482130/sendMessage/162863f82a0545f5b7f941f677ec2697396adf54bdf949d9ae`;

    const response = await fetch(greenApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: "201023238155@c.us",
        message: message
      })
    });

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Logic Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
