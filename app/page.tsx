'use client';

import { useState } from 'react';
import DriverCard from './components/DriverCard';
import StatsCard from './components/StatsCard';
import DispatchEditor from './components/DispatchEditor';

interface Order {
  id: number;
  order_name: string;
  shipping_name?: string;
  customer_account_name?: string;
  delivery_full_address?: string;
  shipping_phone?: string;
  customer_account_phone?: string;
  is_cod: boolean;
  total_price: string;
  order_notes?: string;
  delivery_area: string;
}

interface DispatchResult {
  driver: string;
  driver_number: number;
  orders: Order[];
  order_count: number;
  areas: string[];
  earnings: number;
  cod_collection: number;
}

interface DispatchResponse {
  success: boolean;
  delivery_date: string;
  drivers_count: number;
  orders_found: number;
  drivers_dispatched: number;
  dispatch_results: DispatchResult[];
}

interface MessagingResult {
  driver: string;
  driver_number: number;
  orders_count: number;
  message_sent: boolean;
  green_api_response: {
    idMessage?: string;
  };
}

interface MessagingResponse {
  success: boolean;
  delivery_date: string;
  messages_sent: number;
  messaging_results: MessagingResult[];
}

export default function Home() {
  const [deliveryDate, setDeliveryDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [driversCount, setDriversCount] = useState<number>(5);
  const [loading, setLoading] = useState<boolean>(false);
  const [messagingLoading, setMessagingLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [messagingError, setMessagingError] = useState<string>('');
  const [dispatchResult, setDispatchResult] = useState<DispatchResponse | null>(null);
  const [messagingResult, setMessagingResult] = useState<MessagingResponse | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Delivery rates for calculating earnings
  const deliveryRates: { [key: string]: number } = {
    "الدقي": 170.00,
    "الزمالك": 170.00,
    "الشيخ زايد": 270.00,
    "العجوزه": 170.00,
    "المنيب": 170.00,
    "المهندسين": 170.00,
    "امبايه": 250.00,
    "بولاق الدكرور": 250.00,
    "حدائق الاهرام": 250.00,
    "فيصل والهرم": 170.00,
    "6 اكتوبر": 270.00,
    "٦ اكتوبر": 270.00,
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

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setDispatchResult(null);
    setMessagingResult(null);
    setMessagingError('');

    try {
      const response = await fetch('https://vercel-jet-ten-24.vercel.app/api/delivery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          delivery_date: deliveryDate,
          drivers_count: driversCount,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to dispatch drivers');
      }

      const data: DispatchResponse = await response.json();
      setDispatchResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessages = async () => {
    if (!dispatchResult || !dispatchResult.dispatch_results) {
      setMessagingError('No dispatch data available to send messages');
      return;
    }

    setMessagingLoading(true);
    setMessagingError('');
    setMessagingResult(null);

    try {
      const response = await fetch('https://vercel-jet-ten-24.vercel.app/api/drivers-messaging', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          delivery_date: deliveryDate,
          dispatch_results: dispatchResult.dispatch_results,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send messages');
      }

      const data: MessagingResponse = await response.json();
      setMessagingResult(data);
    } catch (err) {
      setMessagingError(err instanceof Error ? err.message : 'An error occurred while sending messages');
    } finally {
      setMessagingLoading(false);
    }
  };

  const handleEditDispatch = () => {
    setIsEditing(true);
  };

  const handleSaveEdits = (editedResults: DispatchResult[]) => {
    if (!dispatchResult) return;

    // Recalculate totals
    const totalOrders = editedResults.reduce((sum, d) => sum + d.order_count, 0);

    setDispatchResult({
      ...dispatchResult,
      dispatch_results: editedResults,
      orders_found: totalOrders,
      drivers_dispatched: editedResults.length
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const totalEarnings = dispatchResult?.dispatch_results.reduce((sum, driver) => sum + driver.earnings, 0) || 0;
  const totalCOD = dispatchResult?.dispatch_results.reduce((sum, driver) => sum + driver.cod_collection, 0) || 0;

  return (
    <main className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Delivery Dispatch System</h1>
          <p className="text-gray-600">Assign drivers and manage deliveries efficiently</p>
        </div>

        {/* Dispatch Form */}
        <div className="card mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Create Dispatch</h2>
          <form onSubmit={handleDispatch} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="deliveryDate" className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Date
                </label>
                <input
                  type="date"
                  id="deliveryDate"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label htmlFor="driversCount" className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Drivers
                </label>
                <input
                  type="number"
                  id="driversCount"
                  value={driversCount}
                  onChange={(e) => setDriversCount(parseInt(e.target.value))}
                  min="1"
                  max="20"
                  className="input-field"
                  required
                />
              </div>
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full md:w-auto"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Dispatching...
                </span>
              ) : (
                '📋 Create Dispatch Assignment'
              )}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Results Section */}
        {dispatchResult && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard 
                title="Orders Found" 
                value={dispatchResult.orders_found} 
                icon="📦"
                color="blue"
              />
              <StatsCard 
                title="Drivers Dispatched" 
                value={dispatchResult.drivers_dispatched} 
                icon="🚗"
                color="green"
              />
              <StatsCard 
                title="Total Earnings" 
                value={`${totalEarnings.toFixed(2)} EGP`} 
                icon="💰"
                color="purple"
              />
              <StatsCard 
                title="Total COD" 
                value={`${totalCOD.toFixed(2)} EGP`} 
                icon="💵"
                color="orange"
              />
            </div>

            {/* Send Messages Button */}
            <div className="card">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-1">
                    WhatsApp Notifications
                  </h3>
                  <p className="text-sm text-gray-600">
                    {messagingResult 
                      ? `✅ Messages sent successfully to ${messagingResult.messages_sent} driver(s)`
                      : 'Review and edit assignments, then send dispatch details via WhatsApp'
                    }
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleEditDispatch}
                    disabled={!!messagingResult}
                    className={`px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium ${
                      messagingResult ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    ✏️ Edit Assignments
                  </button>
                  <button
                    onClick={handleSendMessages}
                    disabled={messagingLoading || !!messagingResult}
                    className={`btn-primary ${messagingResult ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {messagingLoading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Sending Messages...
                      </span>
                    ) : messagingResult ? (
                      '✅ Messages Sent'
                    ) : (
                      '📱 Send WhatsApp Messages'
                    )}
                  </button>
                </div>
              </div>

              {messagingError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">{messagingError}</p>
                </div>
              )}

              {messagingResult && (
                <div className="mt-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-green-900 mb-2">Messaging Summary</h4>
                    <div className="space-y-1 text-sm text-green-800">
                      {messagingResult.messaging_results.map((result, index) => (
                        <div key={index} className="flex items-center justify-between">
                          <span>
                            {result.message_sent ? '✅' : '❌'} {result.driver} ({result.orders_count} orders)
                          </span>
                          {result.green_api_response.idMessage && (
                            <span className="text-xs text-green-600">
                              ID: {result.green_api_response.idMessage}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Driver Cards */}
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Driver Assignments</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dispatchResult.dispatch_results.map((driver, index) => {
                  const messagingStatus = messagingResult?.messaging_results.find(
                    r => r.driver_number === driver.driver_number
                  );
                  
                  return (
                    <DriverCard 
                      key={index} 
                      driver={driver.driver}
                      orders={driver.order_count}
                      areas={driver.areas}
                      earnings={driver.earnings}
                      cod_collection={driver.cod_collection}
                      status={{
                        idMessage: messagingStatus?.green_api_response?.idMessage || ''
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!dispatchResult && !loading && (
          <div className="card text-center py-12">
            <div className="text-6xl mb-4">🚚</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Dispatch Created Yet</h3>
            <p className="text-gray-600">Fill in the form above to create your first dispatch</p>
          </div>
        )}

        {/* Dispatch Editor Modal */}
        {isEditing && dispatchResult && (
          <DispatchEditor
            dispatchResults={dispatchResult.dispatch_results}
            deliveryRates={deliveryRates}
            onSave={handleSaveEdits}
            onCancel={handleCancelEdit}
          />
        )}
      </div>
    </main>
  );
}
