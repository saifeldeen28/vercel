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
      note_attributes 
    } = req.body;

    // 1. Debugging: Log all attributes to Vercel console to see the exact key name
    console.log("Order Attributes:", JSON.stringify(note_attributes));

    // 2. Extract Delivery Date
    // We check common keys used in custom coding: 'delivery date', 'delivery-date', 'date'
    const deliveryAttribute = note_attributes?.find(attr => {
      const key = attr.name.toLowerCase();
      return key.includes('delivery') || key.includes('تاريخ') || key.includes('date');
    });

    let dayName = "غير محدد";
    if (deliveryAttribute?.value) {
      // Try to parse the date string from the custom code
      const deliveryDate = new Date(deliveryAttribute.value);
      if (!isNaN(deliveryDate)) {
        dayName = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(deliveryDate);
      } else {
        // If it's a plain string like "Saturday", just use it directly
        dayName = deliveryAttribute.value;
      }
    }

    // 3. Format Address
    const address = shipping_address ? 
      `${shipping_address.address1}${shipping_address.address2 ? ' ، ' + shipping_address.address2 : ''}\n${shipping_address.city}` 
      : 'لا يوجد عنوان';

    // 4. Build the WhatsApp Message
    const message = `*طلب جديد - ${name}* \n\n` +
                    `*يوم التوصيل:* ${dayName}\n` +
                    `*العميل:* ${customer.first_name} ${customer.last_name}\n` +
                    `*الهاتف:* ${customer.phone || shipping_address?.phone || 'بدون رقم هاتف'}\n\n` +
                    `*العنوان:* \n${address}\n\n` +
                    `*ملحوظة:* ${note || 'لا توجد ملاحظات'}`;

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
