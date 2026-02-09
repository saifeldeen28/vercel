'use client';

import { useState } from 'react';
import DriverCard from './components/DriverCard';
import StatsCard from './components/StatsCard';

interface DispatchResult {
  driver: string;
  orders: number;
  areas: string[];
  earnings: number;
  cod_collection: number;
  status: {
    idMessage: string;
  };
}

interface ApiResponse {
  success: boolean;
  delivery_date: string;
  drivers_count: number;
  orders_found: number;
  drivers_dispatched: number;
  dispatch_results: DispatchResult[];
}

export default function Home() {
  const [deliveryDate, setDeliveryDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [driversCount, setDriversCount] = useState<number>(5);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<ApiResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

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
        throw new Error('Failed to dispatch drivers');
      }

      const data: ApiResponse = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const totalEarnings = result?.dispatch_results.reduce((sum, driver) => sum + driver.earnings, 0) || 0;
  const totalCOD = result?.dispatch_results.reduce((sum, driver) => sum + driver.cod_collection, 0) || 0;

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
          <form onSubmit={handleSubmit} className="space-y-4">
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
                'Dispatch Drivers'
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
        {result && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard 
                title="Orders Found" 
                value={result.orders_found} 
                icon="📦"
                color="blue"
              />
              <StatsCard 
                title="Drivers Dispatched" 
                value={result.drivers_dispatched} 
                icon="🚗"
                color="green"
              />
              <StatsCard 
                title="Total Earnings" 
                value={`${totalEarnings} EGP`} 
                icon="💰"
                color="purple"
              />
              <StatsCard 
                title="Total COD" 
                value={`${totalCOD} EGP`} 
                icon="💵"
                color="orange"
              />
            </div>

            {/* Driver Cards */}
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Driver Assignments</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {result.dispatch_results.map((driver, index) => (
                  <DriverCard key={index} {...driver} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!result && !loading && (
          <div className="card text-center py-12">
            <div className="text-6xl mb-4">🚚</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Dispatch Created Yet</h3>
            <p className="text-gray-600">Fill in the form above to create your first dispatch</p>
          </div>
        )}
      </div>
    </main>
  );
}
