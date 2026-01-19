export default async function handler(req, res) {
  // Only allow POST requests (Shopify webhooks are always POST)
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // 1. Capture the data from Shopify
    const { name, total_price, customer, line_items } = req.body;

    // 2. Format a nice WhatsApp message
    const productList = line_items.map(item => `- ${item.title}`).join('\n');
    const message = `🚀 *New Shopify Order!*\n\n` +
                    `*Order:* ${name}\n` +
                    `*Customer:* ${customer.first_name} ${customer.last_name}\n` +
                    `*Total:* ${total_price}\n\n` +
                    `*Items:*\n${productList}`;

    // ... (Previous Shopify data capture code)

    // 3. Send to Green API
    const greenApiResponse = await fetch(greenApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: "2010XXXXXXXX@c.us",
        message: message
      })
    });
    
    // NEW: Safety check before parsing JSON
    if (!greenApiResponse.ok) {
      const errorText = await greenApiResponse.text(); // Read the HTML error
      console.error(`Green API Error (${greenApiResponse.status}):`, errorText);
      return res.status(greenApiResponse.status).json({ error: "Green API failed", details: errorText });
    }
    
    const result = await greenApiResponse.json();
    return res.status(200).json({ success: true, result });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
