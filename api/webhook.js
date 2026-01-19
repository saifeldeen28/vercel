export default async function handler(req, res) {
  if (req.method === 'POST') {
    // 1. Get the Shopify Data
    const { name, total_price, customer } = req.body;
    
    const message = `🚀 New Order: ${name}\nTotal: ${total_price}\nCustomer: ${customer.first_name}`;

    // 2. Send to Green API
    await fetch('https://api.green-api.com/waInstance{{YOUR_ID}}/sendMessage/{{YOUR_TOKEN}}', {
      method: 'POST',
      body: JSON.stringify({
        chatId: "YOUR_PARTNER_NUMBER@c.us",
        message: message
      })
    });

    return res.status(200).send('OK');
  }
  res.status(405).send('Method Not Allowed');
}