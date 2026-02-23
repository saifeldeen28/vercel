interface DriverCardProps {
  driver: string;
  orders: number;
  areas: string[];
  earnings: number;
  cod_collection: number;
  status: {
    idMessage: string;
  };
}

export default function DriverCard({
  driver,
  orders,
  areas,
  earnings,
  cod_collection,
  status,
}: DriverCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Colored top accent bar */}
      <div className="h-1 bg-gradient-to-r from-blue-500 to-blue-400" />

      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">{driver}</h3>
          <span className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full shadow-sm">
            {orders} Orders
          </span>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Delivery Areas</p>
            <div className="flex flex-wrap gap-1.5">
              {areas.map((area, index) => (
                <span
                  key={index}
                  className="px-2.5 py-1 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 text-xs font-medium rounded-full border border-blue-100"
                >
                  {area}
                </span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100">
            <div className="bg-emerald-50 rounded-lg p-3">
              <p className="text-xs text-emerald-600 font-medium mb-0.5">Earnings</p>
              <p className="text-base font-bold text-emerald-800">{earnings} <span className="text-xs font-medium">EGP</span></p>
            </div>
            <div className="bg-orange-50 rounded-lg p-3">
              <p className="text-xs text-orange-600 font-medium mb-0.5">COD Collection</p>
              <p className="text-base font-bold text-orange-800">{cod_collection} <span className="text-xs font-medium">EGP</span></p>
            </div>
          </div>

          {status.idMessage && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Message ID</p>
              <p className="text-xs font-mono bg-gray-50 text-gray-600 px-2 py-1 rounded border border-gray-200 break-all">{status.idMessage}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
