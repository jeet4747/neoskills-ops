export default function Table({ columns, data, onRowClick, className = '' }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className={`w-full ${className}`}>
        <thead>
          <tr className="border-b border-gray-50">
            {columns.map((col) => (
              <th key={col.key} className="text-left px-3 sm:px-5 py-3 text-[11px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={row.id || i}
              onClick={() => onRowClick?.(row)}
              className={`border-b border-gray-50/80 text-sm text-gray-700 transition-colors ${onRowClick ? 'cursor-pointer hover:bg-gray-50/50' : ''}`}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-3 sm:px-5 py-3.5 whitespace-nowrap">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
