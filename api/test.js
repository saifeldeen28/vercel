/**
 * Recursively flattens the JSON and logs every path.
 * Run this during your test to find the "Area" fields.
 */
function logEveryCandidate(data, path = '') {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    // It's an object: Loop through keys
    Object.keys(data).forEach(key => {
      logEveryCandidate(data[key], path ? `${path}.${key}` : key);
    });
  } else if (Array.isArray(data)) {
    // It's an array: Loop through items
    data.forEach((item, index) => {
      logEveryCandidate(item, `${path}[${index}]`);
    });
  } else {
    // It's a value: Print the final path and value
    console.log(`CANDIDATE: ${path.padEnd(45)} | VALUE: ${data}`);
  }
}

// Example usage within your Vercel handler
export default async function handler(req, res) {
  if (req.method === 'POST') {
    console.log("--- STARTING SHOPIFY PAYLOAD INSPECTION ---");
    
    // This logs every single field Shopify sent
    logEveryCandidate(req.body);
    
    console.log("--- END OF INSPECTION ---");

    res.status(200).send('Webhook Received');
  } else {
    res.status(405).send('Method Not Allowed');
  }
}
