export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method Not Allowed' });

  // --- 1. CONFIGURATION ---
  const INSTANCE_ID = 'REDACTED_INSTANCE_ID';
  const TOKEN = 'fa3a7a65a16248409e35fa8c8ed25ec086ebda5b67bc437f9f';
  const CHAT_ID = "120363408155697195@g.us";

  // Remember to use your NEW shpat_ token here
  const SHOPIFY_TOKEN = 'REDACTED_SHOPIFY_TOKEN'; 
  const STORE_DOMAIN = 'breakfastgift.myshopify.com'; 

  try {
    const { 
      name, 
      customer, 
      shipping_address, 
      billing_address, 
      note, 
      note_attributes, 
      line_items,
      payment_gateway_names // New field for payment method
    } = req.body;

    const getDisplayName = () => {
      const addr = shipping_address || billing_address || customer || {};
      return `${addr.first_name || ''} ${addr.last_name || ''}`.trim() || "عميل غير معروف";
    };

    // Extract the primary payment method
    const paymentMethod = payment_gateway_names?.length > 0 
      ? payment_gateway_names[0] 
      : "غير محدد";

    // --- 2. SEND UNIQUE PRODUCT PHOTOS FIRST ---
    const processedProductIds = new Set();
    for (const item of line_items) {
      if (!processedProductIds.has(item.product_id)) {
        try {
          const shopifyRes = await fetch(
            `https://${STORE_DOMAIN}/admin/api/2024-01/products/${item.product_id}.json?fields=image`,
            { headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN } }
          );
          const data = await shopifyRes.json();
          const imageUrl = data.product?.image?.src;

          if (imageUrl) {
            await fetch(`https://api.green-api.com/waInstance${INSTANCE_ID}/sendFileByUrl/${TOKEN}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chatId: CHAT_ID,
                urlFile: imageUrl,
                fileName: `${item.title}.jpg`,
                caption: `📸 المنتج: ${item.title}`
              })
            });
            processedProductIds.add(item.product_id);
          }
        } catch (e) { console.error("Image Fetch Error:", e); }
      }
    }

    // --- 3. FORMAT TEXT SUMMARY ---
    let productsSummary = "";
    line_items.forEach((item, i) => {
      productsSummary += `📦 *المنتج ${i + 1}:* ${item.title}\n`;
      if (item.variant_title && item.variant_title !== "Default Title") {
        productsSummary += `🔹 النوع: ${item.variant_title}\n`;
      }
      productsSummary += `الكمية: ${item.quantity}\n\n`;
    });

    const message = `*طلب جديد - ${name}* 🚀\n\n` +
                    `*طريقة الدفع:* ${paymentMethod}\n` + // Added Payment Method
                    `*العميل:* ${getDisplayName()}\n` +
                    `*رقم الشحن:* ${shipping_address?.phone || 'غير مسجل'}\n\n` +
                    `*المنتجات:*\n${productsSummary}` +
                    `*العنوان:* \n${shipping_address?.address1 || 'لا يوجد عنوان'}\n\n` +
                    `*ملحوظة:* ${note || 'لا توجد ملاحظات'}`;

    // --- 4. SEND FINAL SUMMARY ---
    await fetch(`https://api.green-api.com/waInstance${INSTANCE_ID}/sendMessage/${TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: CHAT_ID, message: message })
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
