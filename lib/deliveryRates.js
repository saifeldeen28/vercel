/**
 * Centralized delivery rates configuration
 * Single source of truth for driver earnings per delivery area
 * Used by: api/delivery.js, api/drivers-messaging.js, app/page.tsx
 */

export const deliveryRates = {
  // Giza & West Cairo
  "الدقي": 170.00,
  "الزمالك": 170.00,
  "الشيخ زايد": 270.00,
  "العجوزه": 170.00,
  "المنيب": 170.00,
  "المهندسين": 170.00,
  "امبايه": 250.00,
  "بولاق الدكرور": 250.00,
  "حدائق الاهرام": 250.00,
  "حدايق الاهرام": 250.00,
  "فيصل والهرم": 170.00,
  "6 اكتوبر": 270.00,
  "٦ اكتوبر": 270.00,

  // East Cairo & Helwan
  "جسر السويس": 150.00,
  "حدائق القبة": 150.00,
  "حلوان": 250.00,
  "شبرا": 150.00,
  "شبرا مصر": 150.00,
  "عين شمس": 150.00,
  "مدينة بدر": 220.00,
  "مدينة نصر": 120.00,
  "مدينتي": 220.00,
  "مصر الجديدة": 130.00,
  "وسط البلد": 150.00,
  "15 مايو": 250.00,

  // New Cairo & North/South
  "التجمع الأول/الثالث/الخامس": 100.00,
  "التجمع الاول": 100.00,
  "التجمع الثالث": 100.00,
  "التجمع الخامس": 100.00,
  "الرحاب": 120.00,
  "الزيتون": 150.00,
  "الشروق": 220.00,
  "العاشر من رمضان": 350.00,
  "العبور": 220.00,
  "المرج": 170.00,
  "المستقبل": 250.00,
  "المطرية": 150.00,
  "المعادي": 150.00,
  "المعادى": 150.00,
  "المقطم": 120.00,
  "المنيل": 170.00,
  "النزهة": 140.00
};

/**
 * Helper function to get delivery rate for an area
 * Supports case-insensitive area matching
 * @param {string} area - Delivery area name
 * @returns {number} Delivery rate in EGP (defaults to 100 if not found)
 */
export function getDeliveryRate(area) {
  if (!area) return 0;
  if (deliveryRates[area]) return deliveryRates[area];

  const areaLower = area.toLowerCase();
  for (const [key, value] of Object.entries(deliveryRates)) {
    if (key.toLowerCase() === areaLower) return value;
  }

  return 100.00;
}
