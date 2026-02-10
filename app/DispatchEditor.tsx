'use client';

import { useState } from 'react';

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

interface AreaGroup {
  area: string;
  orders: Order[];
  orderCount: number;
  earnings: number;
  codCollection: number;
}

interface DriverWithAreas {
  driver: string;
  driver_number: number;
  areaGroups: AreaGroup[];
  totalOrders: number;
  totalEarnings: number;
  totalCOD: number;
}

interface DispatchEditorProps {
  dispatchResults: DispatchResult[];
  deliveryRates: { [key: string]: number };
  onSave: (editedResults: DispatchResult[]) => void;
  onCancel: () => void;
}

export default function DispatchEditor({ 
  dispatchResults, 
  deliveryRates,
  onSave, 
  onCancel 
}: DispatchEditorProps) {
  const [drivers, setDrivers] = useState<DriverWithAreas[]>(() => 
    convertToDriversWithAreas(dispatchResults, deliveryRates)
  );
  const [selectedArea, setSelectedArea] = useState<{ driverIndex: number; areaIndex: number } | null>(null);

  function convertToDriversWithAreas(results: DispatchResult[], rates: { [key: string]: number }): DriverWithAreas[] {
    return results.map(result => {
      // Group orders by area
      const areaMap = new Map<string, Order[]>();
      
      result.orders.forEach(order => {
        const area = order.delivery_area;
        if (!areaMap.has(area)) {
          areaMap.set(area, []);
        }
        areaMap.get(area)!.push(order);
      });

      // Create area groups
      const areaGroups: AreaGroup[] = Array.from(areaMap.entries()).map(([area, orders]) => {
        const earnings = orders.reduce((sum, order) => sum + getDeliveryRate(order.delivery_area, rates), 0);
        const codCollection = orders.reduce((sum, order) => {
          return sum + (order.is_cod ? parseFloat(order.total_price || '0') : 0);
        }, 0);

        return {
          area,
          orders,
          orderCount: orders.length,
          earnings,
          codCollection
        };
      });

      const totalOrders = areaGroups.reduce((sum, ag) => sum + ag.orderCount, 0);
      const totalEarnings = areaGroups.reduce((sum, ag) => sum + ag.earnings, 0);
      const totalCOD = areaGroups.reduce((sum, ag) => sum + ag.codCollection, 0);

      return {
        driver: result.driver,
        driver_number: result.driver_number,
        areaGroups,
        totalOrders,
        totalEarnings,
        totalCOD
      };
    });
  }

  function getDeliveryRate(area: string, rates: { [key: string]: number }): number {
    if (!area) return 0;
    if (rates[area]) return rates[area];
    
    const areaLower = area.toLowerCase();
    for (const [key, value] of Object.entries(rates)) {
      if (key.toLowerCase() === areaLower) return value;
    }
    
    return 100.00;
  }

  function handleAreaClick(driverIndex: number, areaIndex: number) {
    if (selectedArea === null) {
      // First click - select area
      setSelectedArea({ driverIndex, areaIndex });
    } else if (selectedArea.driverIndex === driverIndex && selectedArea.areaIndex === areaIndex) {
      // Clicked same area - deselect
      setSelectedArea(null);
    } else {
      // Second click - move area to this driver
      moveArea(selectedArea.driverIndex, selectedArea.areaIndex, driverIndex);
      setSelectedArea(null);
    }
  }

  function moveArea(fromDriverIndex: number, areaIndex: number, toDriverIndex: number) {
    const newDrivers = [...drivers];
    const fromDriver = newDrivers[fromDriverIndex];
    const toDriver = newDrivers[toDriverIndex];

    // Get the area group to move
    const areaGroup = fromDriver.areaGroups[areaIndex];

    // Remove from source driver
    fromDriver.areaGroups.splice(areaIndex, 1);
    fromDriver.totalOrders -= areaGroup.orderCount;
    fromDriver.totalEarnings -= areaGroup.earnings;
    fromDriver.totalCOD -= areaGroup.codCollection;

    // Add to destination driver
    toDriver.areaGroups.push(areaGroup);
    toDriver.totalOrders += areaGroup.orderCount;
    toDriver.totalEarnings += areaGroup.earnings;
    toDriver.totalCOD += areaGroup.codCollection;

    setDrivers(newDrivers);
  }

  function splitArea(driverIndex: number, areaIndex: number) {
    const newDrivers = [...drivers];
    const driver = newDrivers[driverIndex];
    const areaGroup = driver.areaGroups[areaIndex];

    if (areaGroup.orderCount < 2) {
      alert('Cannot split an area with less than 2 orders');
      return;
    }

    // Split orders randomly into two groups
    const shuffled = [...areaGroup.orders].sort(() => Math.random() - 0.5);
    const mid = Math.ceil(shuffled.length / 2);
    const orders1 = shuffled.slice(0, mid);
    const orders2 = shuffled.slice(mid);

    // Calculate stats for both parts
    const earnings1 = orders1.reduce((sum, order) => sum + getDeliveryRate(order.delivery_area, deliveryRates), 0);
    const codCollection1 = orders1.reduce((sum, order) => {
      return sum + (order.is_cod ? parseFloat(order.total_price || '0') : 0);
    }, 0);

    const earnings2 = orders2.reduce((sum, order) => sum + getDeliveryRate(order.delivery_area, deliveryRates), 0);
    const codCollection2 = orders2.reduce((sum, order) => {
      return sum + (order.is_cod ? parseFloat(order.total_price || '0') : 0);
    }, 0);

    // Create two new area groups
    const areaGroup1: AreaGroup = {
      area: `${areaGroup.area} (Part 1)`,
      orders: orders1,
      orderCount: orders1.length,
      earnings: earnings1,
      codCollection: codCollection1
    };

    const areaGroup2: AreaGroup = {
      area: `${areaGroup.area} (Part 2)`,
      orders: orders2,
      orderCount: orders2.length,
      earnings: earnings2,
      codCollection: codCollection2
    };

    // Replace original area with two new ones
    driver.areaGroups.splice(areaIndex, 1, areaGroup1, areaGroup2);

    setDrivers(newDrivers);
  }

  function handleSave() {
    // Convert back to DispatchResult format
    const editedResults: DispatchResult[] = drivers.map(driver => {
      const allOrders = driver.areaGroups.flatMap(ag => ag.orders);
      const uniqueAreas = Array.from(new Set(driver.areaGroups.map(ag => ag.area.replace(' (Part 1)', '').replace(' (Part 2)', ''))));

      return {
        driver: driver.driver,
        driver_number: driver.driver_number,
        orders: allOrders,
        order_count: driver.totalOrders,
        areas: uniqueAreas,
        earnings: driver.totalEarnings,
        cod_collection: driver.totalCOD
      };
    });

    onSave(editedResults);
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Edit Dispatch Assignments</h2>
          <p className="text-gray-600">
            Click an area to select it, then click a driver to move it. Areas are moved as complete groups.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {drivers.map((driver, driverIndex) => (
              <div 
                key={driver.driver_number} 
                className={`border-2 rounded-lg p-4 ${
                  selectedArea?.driverIndex === driverIndex 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 bg-white'
                }`}
              >
                {/* Driver Header */}
                <div className="mb-4 pb-3 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {driver.driver}
                  </h3>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-gray-600">Orders:</span>
                      <span className="ml-1 font-medium text-gray-900">{driver.totalOrders}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Earn:</span>
                      <span className="ml-1 font-medium text-green-700">{driver.totalEarnings.toFixed(0)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">COD:</span>
                      <span className="ml-1 font-medium text-orange-700">{driver.totalCOD.toFixed(0)}</span>
                    </div>
                  </div>
                </div>

                {/* Area Groups */}
                <div className="space-y-2">
                  {driver.areaGroups.map((areaGroup, areaIndex) => (
                    <div
                      key={`${driverIndex}-${areaIndex}`}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedArea?.driverIndex === driverIndex && selectedArea?.areaIndex === areaIndex
                          ? 'border-blue-500 bg-blue-100 shadow-md'
                          : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50'
                      }`}
                      onClick={() => handleAreaClick(driverIndex, areaIndex)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 text-sm mb-1">
                            {areaGroup.area}
                          </p>
                          <p className="text-xs text-gray-600">
                            {areaGroup.orderCount} order{areaGroup.orderCount !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            splitArea(driverIndex, areaIndex);
                          }}
                          className="ml-2 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                          title="Split this area into 2 parts"
                        >
                          ✂️ Split
                        </button>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-green-700">
                          💵 {areaGroup.earnings.toFixed(0)} EGP
                        </span>
                        <span className="text-orange-700">
                          🔴 {areaGroup.codCollection.toFixed(0)} COD
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  {driver.areaGroups.length === 0 && (
                    <div className="p-4 text-center text-gray-400 border-2 border-dashed border-gray-300 rounded-lg">
                      No areas assigned
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {selectedArea !== null && (
                <span className="text-blue-600 font-medium">
                  ✓ Area selected - Click a driver to move it
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
