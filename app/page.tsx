'use client';

import { useState } from 'react';
import DriverCard from './components/DriverCard';
import StatsCard from './components/StatsCard';

// 1. Updated Interfaces to match the Core Endpoint
interface Order {
  id: string;
  delivery_area: string;
  total_price: string;
  is_cod: boolean;
  order_name: string;
  // ... add other order fields as needed
}

interface DriverAssignment {
  driver_name: string;
  driver_number: number;
  orders: Order[];
  areas: string[];
}

interface CoreApiResponse {
  success: boolean;
  delivery_date: string;
  drivers_count: number;
  orders_found: number;
  driverAssignments: DriverAssignment[];
}

export default function Home() {
  const [deliveryDate, setDeliveryDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [driversCount, setDriversCount] = useState<number>(5);
  const [loading, setLoading] = useState<boolean>(false);
  const [sendingWa, setSendingWa] = useState<boolean>(false); // New state for WA button
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<CoreApiResponse | null>(null);
  const [waStatus, setWaStatus] = useState<string>('');

  // Step 1: Get Assignments from Core API
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    setWaStatus('');

    try {
      // Update this URL to your NEW Core API endpoint
      const response = await fetch('https://vercel-jet-ten-24.vercel.app/api/core-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_date: deliveryDate,
          drivers_count: driversCount,
        }),
      });

      if (!response.ok) throw new Error('Failed to calculate assignments');

      const data: CoreApiResponse = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Send to WhatsApp API
  const handleSendWhatsApp = async () => {
    if (!result) return;
    setSendingWa(true);
    setWaStatus('');

    try {
      // Update this URL to your NEW WhatsApp Sender endpoint
      const response = await fetch('https://vercel-jet-ten-24.vercel.app/api/drivers-messaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverAssignments: result.driverAssignments,
          delivery_date: result.delivery_date,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setWaStatus('✅ Messages sent successfully!');
      } else {
        throw new Error('Failed to send messages');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'WhatsApp error');
    } finally {
      setSendingWa(false);
    }
  };

  // Helper calculations for the UI
  const calculateTotals = () => {
    let earnings = 0;
    let cod = 0;
    result?.driverAssignments.forEach(d => {
      d.orders.forEach(o => {
        // You'll need a logic or a prop for rates here if not calculated in backend
        // For now, let's assume rates are 150 avg or calculated in backend
        if (o.is_cod) cod += parseFloat(o.total_price || '0');
      });
    });
    return { earnings, cod };
  };

  const { cod } = calculateTotals();

  return (
    <main className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Delivery Dispatch System</h1>
          <p className="text-gray-600">Assign drivers and manage deliveries efficiently</p>
        </div>

        <div className="card mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">Create Dispatch</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Date</label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Number of Drivers</label>
                <input
                  type="number"
                  value={driversCount}
                  onChange={(e) => setDriversCount(parseInt(e.target.value))}
                  min="1" max="20"
                  className="input-field"
                  required
                />
              </div>
            </div>
            
            <button type="submit" disabled={loading} className="btn-primary w-full md:w-auto">
              {loading ? 'Calculating...' : 'Calculate Assignments'}
            </button>
          </form>

          {error && <div className="mt-4 p-4 bg-red-50 text-red-800 rounded-lg">{error}</div>}
        </div>

        {result && (
          <div className="space-y-6">
            {/* Actions Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div>
                <h3 className="text-lg font-bold">Review Assignments</h3>
                <p className="text-sm text-gray-500">Check the data before pushing to WhatsApp</p>
              </div>
              <div className="mt-4 md:mt-0 flex gap-4 items-center">
                {waStatus && <span className="text-sm font-medium text-green-600">{waStatus}</span>}
                <button 
                  onClick={handleSendWhatsApp}
                  disabled={sendingWa}
                  className={`px-6 py-2 rounded-lg font-semibold text-white transition ${sendingWa ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  {sendingWa ? 'Sending...' : '📤 Send to WhatsApp'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatsCard title="Orders Found" value={result.orders_found} icon="📦" color="blue" />
              <StatsCard title="Drivers" value={result.driverAssignments.length} icon="🚗" color="green" />
              <StatsCard title="Total COD" value={`${cod} EGP`} icon="💵" color="orange" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {result.driverAssignments.map((driver, index) => (
                <div key={index} className="border rounded-lg p-4 bg-white shadow-sm">
                   <h4 className="font-bold text-blue-600">{driver.driver_name}</h4>
                   <p className="text-sm text-gray-600">Areas: {driver.areas.join(', ')}</p>
                   <p className="font-medium mt-2">{driver.orders.length} Orders</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
