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
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-2 overflow-y-auto backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-700 px-5 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Edit Dispatch</h2>
            <p className="text-xs text-gray-400">Click an area to select · click a driver to move</p>
          </div>
          {selectedArea !== null && (
            <span className="text-xs text-blue-300 font-medium bg-blue-900/40 border border-blue-700 px-3 py-1 rounded-full">
              Area selected — click a driver to move
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {drivers.map((driver, driverIndex) => (
              <div
                key={driver.driver_number}
                className={`border-2 rounded-lg overflow-hidden ${
                  selectedArea?.driverIndex === driverIndex
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                {/* Driver Header — single compact row */}
                <div
                  className="px-3 py-2 bg-gray-50 border-b border-gray-200 cursor-pointer"
                  onClick={() => {
                    if (selectedArea !== null && selectedArea.driverIndex !== driverIndex) {
                      moveArea(selectedArea.driverIndex, selectedArea.areaIndex, driverIndex);
                      setSelectedArea(null);
                    }
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-900 truncate">{driver.driver}</span>
                    <div className="flex items-center gap-2 text-xs shrink-0">
                      <span className="font-medium text-gray-700">{driver.totalOrders} ord</span>
                      <span className="text-green-700">{driver.totalEarnings.toFixed(0)}</span>
                      <span className="text-orange-700">{driver.totalCOD.toFixed(0)} COD</span>
                    </div>
                  </div>
                </div>

                {/* Area rows */}
                <div className="divide-y divide-gray-100">
                  {driver.areaGroups.map((areaGroup, areaIndex) => (
                    <div
                      key={`${driverIndex}-${areaIndex}`}
                      className={`flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors ${
                        selectedArea?.driverIndex === driverIndex && selectedArea?.areaIndex === areaIndex
                          ? 'bg-blue-100'
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => handleAreaClick(driverIndex, areaIndex)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0 ${
                          selectedArea?.driverIndex === driverIndex && selectedArea?.areaIndex === areaIndex
                            ? 'bg-blue-500 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}>
                          {areaGroup.orderCount}
                        </span>
                        <span className="text-sm text-gray-800 truncate">{areaGroup.area}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          splitArea(driverIndex, areaIndex);
                        }}
                        className="ml-2 px-1.5 py-0.5 text-xs text-gray-500 border border-gray-300 rounded hover:bg-gray-100 shrink-0"
                        title="Split into 2 parts"
                      >
                        ✂
                      </button>
                    </div>
                  ))}

                  {driver.areaGroups.length === 0 && (
                    <div className="px-3 py-3 text-center text-xs text-gray-400 border-dashed">
                      No areas
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-5 py-3 bg-gradient-to-r from-gray-900 to-gray-700 flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-sm border border-gray-500 rounded-lg text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors font-semibold shadow-sm"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
