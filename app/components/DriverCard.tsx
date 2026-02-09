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
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{driver}</h3>
        <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
          {orders} Orders
        </span>
      </div>
      
      <div className="space-y-3">
        <div>
          <p className="text-sm text-gray-600 mb-2">Delivery Areas:</p>
          <div className="flex flex-wrap gap-2">
            {areas.map((area, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200">
          <div>
            <p className="text-sm text-gray-600">Earnings</p>
            <p className="text-lg font-semibold text-gray-900">{earnings} EGP</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">COD Collection</p>
            <p className="text-lg font-semibold text-gray-900">{cod_collection} EGP</p>
          </div>
        </div>
        
        <div className="pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-500">Message ID:</p>
          <p className="text-xs font-mono text-gray-700 break-all">{status.idMessage}</p>
        </div>
      </div>
    </div>
  );
}
