export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // 1. استقبال البيانات من Shopify
    const { 
      name, 
      customer, 
      shipping_address, 
      note, 
      created_at 
    } = req.body;

    // 2. تحويل التاريخ لاسم اليوم بالعربية
    const orderDate = new Date(created_at);
    const dayName = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(orderDate);

    // 3. تجهيز بيانات العنوان
    const address = shipping_address ? 
      `${shipping_address.address1}${shipping_address.address2 ? ' ، ' + shipping_address.address2 : ''}\n${shipping_address.city}` 
      : 'لا يوجد عنوان';

    // 4. بناء القالب (Template) كما طلبت
    const message = `${dayName}\n` +
                    `${name}\n` +
                    `${customer.first_name} ${customer.last_name}\n` +
                    `${customer.phone || shipping_address?.phone || 'بدون رقم هاتف'}\n\n` +
                    `العنوان: \n${address}\n\n` +
                    `ملحوظة: ${note || 'لا توجد ملاحظات'}\n\n` +
                    `يتصور`;

    // 5. الإرسال إلى Green API
    const greenApiUrl = `https://api.green-api.com/waInstance7105482130/sendMessage/162863f82a0545f5b7f941f677ec2697396adf54bdf949d9ae`;

    const greenApiResponse = await fetch(greenApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: "201023238155@c.us",
        message: message
      })
    });
    
    if (!greenApiResponse.ok) {
      const errorText = await greenApiResponse.text();
      return res.status(greenApiResponse.status).json({ error: "Green API failed", details: errorText });
    }
    
    const result = await greenApiResponse.json();
    return res.status(200).json({ success: true, result });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
