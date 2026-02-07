import { createClient } from '@supabase/supabase-js'
import fetch from 'node-fetch'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' })
  }

  // --- CONFIGURATION ---
  const INSTANCE_ID = 'REDACTED_INSTANCE_ID'
  const TOKEN = 'REDACTED_GREEN_API_TOKEN'
  const CHAT_ID = '120363408155697195@g.us'
  const SHOPIFY_TOKEN = 'REDACTED_SHOPIFY_TOKEN'
  const STORE_DOMAIN = 'breakfastgift.myshopify.com'

  try {
    const {
      id,
      name,
      customer,
      shipping_address,
      billing_address,
      note,
      note_attributes = [],
      line_items = [],
      payment_gateway_names = [],
      total_price,
      currency
    } = req.body

    // ------------------ NAME HANDLING ------------------
    const getDisplayName = async () => {
      const addr = shipping_address || billing_address || customer || {}
      const first = addr.first_name || ''
      const last = addr.last_name || ''
      const fullName = `${first} ${last}`.trim()

      if (!fullName) return 'عميل غير معروف'

      const isEnglish = /[a-zA-Z]/.test(fullName)

      if (isEnglish) {
        try {
          const r = await fetch(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=${encodeURIComponent(fullName)}`
          )
          const data = await r.json()
          return data?.[0]?.[0]?.[0] || fullName
        } catch {
          return fullName
        }
      }

      return fullName
    }

    const displayName = await getDisplayName()

    // ------------------ DELIVERY DATE ------------------
    const deliveryAttribute = note_attributes.find(attr => {
      const key = attr.name?.toLowerCase() || ''
      return key.includes('delivery') || key.includes('تاريخ') || key.includes('date')
    })

    let dayName = 'غير محدد'
    let deliveryDateFormatted = 'غير محدد'
    let extractedDate = null

    if (deliveryAttribute?.value) {
      const d = new Date(deliveryAttribute.value)
      if (!isNaN(d)) {
        dayName = new Intl.DateTimeFormat('ar-EG', { weekday: 'long' }).format(d)
        deliveryDateFormatted = new Intl.DateTimeFormat('ar-EG', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }).format(d)
        extractedDate = d.toISOString().split('T')[0]
      } else {
        dayName = deliveryAttribute.value
        deliveryDateFormatted = deliveryAttribute.value
      }
    }

    // ------------------ PAYMENT ------------------
    const paymentMethod = payment_gateway_names[0] || 'غير محدد'
    const isCOD =
      paymentMethod.toLowerCase().includes('cash') ||
      paymentMethod.toLowerCase().includes('manual') ||
      paymentMethod.includes('الدفع')

    const totalDisplay = isCOD
      ? `\n💰 *المبلغ المطلوب:* ${total_price} ${currency}`
      : ''

    // ------------------ PRODUCTS ------------------
    let productsSummary = ''
    line_items.forEach((item, i) => {
      productsSummary += `📦 *المنتج ${i + 1}:* ${item.title}\n`
      if (item.variant_title && item.variant_title !== 'Default Title') {
        productsSummary += `🔹 النوع: ${item.variant_title}\n`
      }
      productsSummary += `الكمية: ${item.quantity}\n`

      item.properties?.forEach(prop => {
        const name = prop.name.toLowerCase()
        if (!name.includes('appid') && !name.startsWith('__') && name !== 'cl_option') {
          productsSummary += `📝 _${prop.name.replace(/^_+/, '')}:_ ${prop.value}\n`
        }
      })

      productsSummary += '\n'
    })

    // ------------------ ADDRESS ------------------
    const a = shipping_address
    const fullAddress = a
      ? `${a.address1 || ''} ${a.address2 || ''}, ${a.city || ''}, ${a.province || ''}`.trim()
      : 'لا يوجد عنوان'

    const fullDetailsCaption =
      `*طلب جديد - ${name}* 🚀\n\n` +
      `📅 *تاريخ التوصيل:* ${deliveryDateFormatted}\n` +
      `🗓️ *يوم التوصيل:* ${dayName}\n` +
      `👤 *العميل:* ${displayName}\n` +
      `📞 *رقم الهاتف:* ${shipping_address?.phone || 'غير مسجل'}\n\n` +
      `*المنتجات:*\n${productsSummary}` +
      `*العنوان:*\n${fullAddress}\n\n` +
      `*طريقة الدفع:* ${paymentMethod}${totalDisplay}\n` +
      `*ملحوظة:* ${note || 'لا توجد ملاحظات'}`

    // ------------------ SEND WHATSAPP ------------------
    await fetch(
      `https://api.green-api.com/waInstance${INSTANCE_ID}/sendMessage/${TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: CHAT_ID, message: fullDetailsCaption })
      }
    )

    // ------------------ DATABASE ------------------
    if (isCOD) {
      const { data: order } = await supabase
        .from('orders')
        .upsert(
          {
            shopify_order_id: id.toString(),
            customer_name: displayName,
            total_price,
            delivery_area: shipping_address?.city || 'غير محدد',
            delivery_date: extractedDate,
            status: 'pending'
          },
          { onConflict: 'shopify_order_id' }
        )
        .select()
        .single()

      await supabase.from('order_items').delete().eq('order_id', order.id)

      await supabase.from('order_items').insert(
        line_items.map(i => ({
          order_id: order.id,
          item_name: i.title,
          quantity: i.quantity
        }))
      )
    }

    return res.status(200).json({ success: true, addedToDatabase: isCOD })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
