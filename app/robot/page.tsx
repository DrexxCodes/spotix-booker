// "use client"

// import { useState, useEffect } from "react"
// import { 
//   Activity, 
//   CheckCircle2, 
//   XCircle, 
//   Clock, 
//   AlertTriangle,
//   RefreshCw,
//   TrendingUp,
//   Globe,
//   Zap
// } from "lucide-react"

// interface Monitor {
//   id: number
//   friendly_name: string
//   url: string
//   type: number
//   status: number
//   create_datetime: number
//   average_response_time: string
//   ssl?: {
//     brand: string
//     product: string
//     expires: number
//   }
//   custom_uptime_ratio?: string
//   custom_uptime_ranges?: string
//   response_times?: Array<{
//     datetime: number
//     value: number
//   }>
//   logs?: Array<{
//     type: number
//     datetime: number
//     duration: number
//     reason?: {
//       code: string
//       detail: string
//     }
//   }>
// }

// interface Stats {
//   total_monitors: number
//   up_monitors: number
//   down_monitors: number
//   paused_monitors: number
//   average_response_time: number
//   overall_uptime: number
// }

// export default function UptimeRobotDashboard() {
//   const [monitors, setMonitors] = useState<Monitor[]>([])
//   const [stats, setStats] = useState<Stats | null>(null)
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState<string | null>(null)
//   const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

//   const fetchMonitors = async () => {
//     setLoading(true)
//     setError(null)

//     try {
//       const response = await fetch('/api/ping', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//       })

//       if (!response.ok) {
//         throw new Error('Failed to fetch monitors')
//       }

//       const data = await response.json()

//       if (data.stat === 'fail') {
//         throw new Error(data.error?.message || 'API request failed')
//       }

//       setMonitors(data.monitors || [])
      
//       // Calculate stats
//       const total = data.monitors?.length || 0
//       const up = data.monitors?.filter((m: Monitor) => m.status === 2).length || 0
//       const down = data.monitors?.filter((m: Monitor) => m.status === 9).length || 0
//       const paused = data.monitors?.filter((m: Monitor) => m.status === 0).length || 0
      
//       const avgResponse = data.monitors?.reduce((acc: number, m: Monitor) => 
//         acc + (parseInt(m.average_response_time) || 0), 0
//       ) / (total || 1)

//       const totalUptime = data.monitors?.reduce((acc: number, m: Monitor) =>
//         acc + (parseFloat(m.custom_uptime_ratio || '0') || 0), 0
//       ) / (total || 1)

//       setStats({
//         total_monitors: total,
//         up_monitors: up,
//         down_monitors: down,
//         paused_monitors: paused,
//         average_response_time: Math.round(avgResponse),
//         overall_uptime: parseFloat(totalUptime.toFixed(2))
//       })

//       setLastUpdated(new Date())
//     } catch (err) {
//       setError(err instanceof Error ? err.message : 'An error occurred')
//       console.error('Error fetching monitors:', err)
//     } finally {
//       setLoading(false)
//     }
//   }

//   useEffect(() => {
//     fetchMonitors()
    
//     // Auto-refresh every 5 minutes
//     const interval = setInterval(() => {
//       fetchMonitors()
//     }, 5 * 60 * 1000)

//     return () => clearInterval(interval)
//   }, [])

//   const getStatusColor = (status: number) => {
//     switch (status) {
//       case 2: return 'text-green-600 bg-green-50 border-green-200'
//       case 9: return 'text-red-600 bg-red-50 border-red-200'
//       case 0: return 'text-gray-600 bg-gray-50 border-gray-200'
//       case 1: return 'text-yellow-600 bg-yellow-50 border-yellow-200'
//       default: return 'text-gray-600 bg-gray-50 border-gray-200'
//     }
//   }

//   const getStatusText = (status: number) => {
//     switch (status) {
//       case 2: return 'Up'
//       case 9: return 'Down'
//       case 0: return 'Paused'
//       case 1: return 'Not Checked Yet'
//       default: return 'Unknown'
//     }
//   }

//   const getStatusIcon = (status: number) => {
//     switch (status) {
//       case 2: return <CheckCircle2 size={20} />
//       case 9: return <XCircle size={20} />
//       case 0: return <Clock size={20} />
//       default: return <AlertTriangle size={20} />
//     }
//   }

//   const getMonitorTypeText = (type: number) => {
//     const types: { [key: number]: string } = {
//       1: 'HTTP(s)',
//       2: 'Keyword',
//       3: 'Ping',
//       4: 'Port',
//       5: 'Heartbeat'
//     }
//     return types[type] || 'Unknown'
//   }

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-8">
//       <div className="max-w-7xl mx-auto space-y-6">
//         {/* Header */}
//         <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
//           <div>
//             <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">
//               Service Status Dashboard
//             </h1>
//             {lastUpdated && (
//               <p className="text-sm text-slate-600">
//                 Last updated: {lastUpdated.toLocaleTimeString()}
//               </p>
//             )}
//           </div>
//           <button
//             onClick={() => fetchMonitors()}
//             disabled={loading}
//             className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-200 rounded-lg font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-all"
//           >
//             <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
//             Refresh
//           </button>
//         </div>

//         {error && (
//           <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
//             <div className="flex items-center gap-3">
//               <AlertTriangle className="text-red-600" size={24} />
//               <div>
//                 <p className="font-semibold text-red-800">Error</p>
//                 <p className="text-sm text-red-700">{error}</p>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* Stats Grid */}
//         {stats && (
//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
//             <div className="bg-white rounded-xl p-6 border-2 border-slate-200 shadow-sm hover:shadow-md transition-shadow">
//               <div className="flex items-center justify-between mb-2">
//                 <Globe className="text-blue-600" size={24} />
//               </div>
//               <p className="text-sm text-slate-600 font-semibold">Total Monitors</p>
//               <p className="text-3xl font-bold text-slate-900">{stats.total_monitors}</p>
//             </div>

//             <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200 shadow-sm hover:shadow-md transition-shadow">
//               <div className="flex items-center justify-between mb-2">
//                 <CheckCircle2 className="text-green-600" size={24} />
//               </div>
//               <p className="text-sm text-green-700 font-semibold">Up</p>
//               <p className="text-3xl font-bold text-green-900">{stats.up_monitors}</p>
//             </div>

//             <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-6 border-2 border-red-200 shadow-sm hover:shadow-md transition-shadow">
//               <div className="flex items-center justify-between mb-2">
//                 <XCircle className="text-red-600" size={24} />
//               </div>
//               <p className="text-sm text-red-700 font-semibold">Down</p>
//               <p className="text-3xl font-bold text-red-900">{stats.down_monitors}</p>
//             </div>

//             <div className="bg-white rounded-xl p-6 border-2 border-slate-200 shadow-sm hover:shadow-md transition-shadow">
//               <div className="flex items-center justify-between mb-2">
//                 <Zap className="text-amber-600" size={24} />
//               </div>
//               <p className="text-sm text-slate-600 font-semibold">Avg Response</p>
//               <p className="text-3xl font-bold text-slate-900">{stats.average_response_time}ms</p>
//             </div>

//             <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200 shadow-sm hover:shadow-md transition-shadow">
//               <div className="flex items-center justify-between mb-2">
//                 <TrendingUp className="text-blue-600" size={24} />
//               </div>
//               <p className="text-sm text-blue-700 font-semibold">Overall Uptime</p>
//               <p className="text-3xl font-bold text-blue-900">{stats.overall_uptime}%</p>
//             </div>
//           </div>
//         )}

//         {/* Monitors List */}
//         {loading ? (
//           <div className="bg-white rounded-xl p-12 border-2 border-slate-200 text-center">
//             <RefreshCw className="mx-auto mb-4 animate-spin text-blue-600" size={40} />
//             <p className="text-slate-600 font-semibold">Loading monitors...</p>
//           </div>
//         ) : monitors.length === 0 ? (
//           <div className="bg-white rounded-xl p-12 border-2 border-slate-200 text-center">
//             <Activity className="mx-auto mb-4 text-slate-400" size={40} />
//             <p className="text-slate-600 font-semibold">No monitors found</p>
//             <p className="text-sm text-slate-500 mt-2">Check your API key configuration</p>
//           </div>
//         ) : (
//           <div className="bg-white rounded-xl border-2 border-slate-200 shadow-sm overflow-hidden">
//             <div className="overflow-x-auto">
//               <table className="w-full">
//                 <thead className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-200">
//                   <tr>
//                     <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Status</th>
//                     <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Monitor</th>
//                     <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Type</th>
//                     <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Uptime</th>
//                     <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Response Time</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100">
//                   {monitors.map((monitor) => (
//                     <tr key={monitor.id} className="hover:bg-slate-50 transition-colors">
//                       <td className="px-6 py-4">
//                         <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 font-semibold text-sm ${getStatusColor(monitor.status)}`}>
//                           {getStatusIcon(monitor.status)}
//                           {getStatusText(monitor.status)}
//                         </div>
//                       </td>
//                       <td className="px-6 py-4">
//                         <div>
//                           <p className="font-bold text-slate-900">{monitor.friendly_name}</p>
//                           <p className="text-sm text-slate-500 truncate max-w-md">{monitor.url}</p>
//                         </div>
//                       </td>
//                       <td className="px-6 py-4">
//                         <span className="inline-flex px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md">
//                           {getMonitorTypeText(monitor.type)}
//                         </span>
//                       </td>
//                       <td className="px-6 py-4">
//                         <div className="flex items-center gap-2">
//                           <span className="text-lg font-bold text-slate-900">
//                             {monitor.custom_uptime_ratio || 'N/A'}%
//                           </span>
//                           {parseFloat(monitor.custom_uptime_ratio || '0') >= 99.9 && (
//                             <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
//                               Excellent
//                             </span>
//                           )}
//                         </div>
//                       </td>
//                       <td className="px-6 py-4">
//                         <span className="font-semibold text-slate-900">
//                           {monitor.average_response_time}ms
//                         </span>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   )
// }


//   return (
//     <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-8">
//       <div className="max-w-7xl mx-auto space-y-6">
//         {/* Header */}
//         <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
//           <div>
//             <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">
//               Service Status Dashboard
//             </h1>
//             {lastUpdated && (
//               <p className="text-sm text-slate-600">
//                 Last updated: {lastUpdated.toLocaleTimeString()}
//               </p>
//             )}
//           </div>
//           <button
//             onClick={() => fetchMonitors()}
//             disabled={loading}
//             className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-200 rounded-lg font-semibold text-slate-700 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition-all"
//           >
//             <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
//             Refresh
//           </button>
//         </div>

//         {error && (
//           <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
//             <div className="flex items-center gap-3">
//               <AlertTriangle className="text-red-600" size={24} />
//               <div>
//                 <p className="font-semibold text-red-800">Error</p>
//                 <p className="text-sm text-red-700">{error}</p>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* Stats Grid */}
//         {stats && (
//           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
//             <div className="bg-white rounded-xl p-6 border-2 border-slate-200 shadow-sm hover:shadow-md transition-shadow">
//               <div className="flex items-center justify-between mb-2">
//                 <Globe className="text-blue-600" size={24} />
//               </div>
//               <p className="text-sm text-slate-600 font-semibold">Total Monitors</p>
//               <p className="text-3xl font-bold text-slate-900">{stats.total_monitors}</p>
//             </div>

//             <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border-2 border-green-200 shadow-sm hover:shadow-md transition-shadow">
//               <div className="flex items-center justify-between mb-2">
//                 <CheckCircle2 className="text-green-600" size={24} />
//               </div>
//               <p className="text-sm text-green-700 font-semibold">Up</p>
//               <p className="text-3xl font-bold text-green-900">{stats.up_monitors}</p>
//             </div>

//             <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl p-6 border-2 border-red-200 shadow-sm hover:shadow-md transition-shadow">
//               <div className="flex items-center justify-between mb-2">
//                 <XCircle className="text-red-600" size={24} />
//               </div>
//               <p className="text-sm text-red-700 font-semibold">Down</p>
//               <p className="text-3xl font-bold text-red-900">{stats.down_monitors}</p>
//             </div>

//             <div className="bg-white rounded-xl p-6 border-2 border-slate-200 shadow-sm hover:shadow-md transition-shadow">
//               <div className="flex items-center justify-between mb-2">
//                 <Zap className="text-amber-600" size={24} />
//               </div>
//               <p className="text-sm text-slate-600 font-semibold">Avg Response</p>
//               <p className="text-3xl font-bold text-slate-900">{stats.average_response_time}ms</p>
//             </div>

//             <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200 shadow-sm hover:shadow-md transition-shadow">
//               <div className="flex items-center justify-between mb-2">
//                 <TrendingUp className="text-blue-600" size={24} />
//               </div>
//               <p className="text-sm text-blue-700 font-semibold">Overall Uptime</p>
//               <p className="text-3xl font-bold text-blue-900">{stats.overall_uptime}%</p>
//             </div>
//           </div>
//         )}

//         {/* Monitors List */}
//         {loading ? (
//           <div className="bg-white rounded-xl p-12 border-2 border-slate-200 text-center">
//             <RefreshCw className="mx-auto mb-4 animate-spin text-blue-600" size={40} />
//             <p className="text-slate-600 font-semibold">Loading monitors...</p>
//           </div>
//         ) : monitors.length === 0 ? (
//           <div className="bg-white rounded-xl p-12 border-2 border-slate-200 text-center">
//             <Activity className="mx-auto mb-4 text-slate-400" size={40} />
//             <p className="text-slate-600 font-semibold">No monitors found</p>
//           </div>
//         ) : (
//           <div className="bg-white rounded-xl border-2 border-slate-200 shadow-sm overflow-hidden">
//             <div className="overflow-x-auto">
//               <table className="w-full">
//                 <thead className="bg-gradient-to-r from-slate-100 to-slate-50 border-b-2 border-slate-200">
//                   <tr>
//                     <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Status</th>
//                     <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Monitor</th>
//                     <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Type</th>
//                     <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Uptime</th>
//                     <th className="px-6 py-4 text-left text-sm font-bold text-slate-700">Response Time</th>
//                   </tr>
//                 </thead>
//                 <tbody className="divide-y divide-slate-100">
//                   {monitors.map((monitor) => (
//                     <tr key={monitor.id} className="hover:bg-slate-50 transition-colors">
//                       <td className="px-6 py-4">
//                         <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 font-semibold text-sm ${getStatusColor(monitor.status)}`}>
//                           {getStatusIcon(monitor.status)}
//                           {getStatusText(monitor.status)}
//                         </div>
//                       </td>
//                       <td className="px-6 py-4">
//                         <div>
//                           <p className="font-bold text-slate-900">{monitor.friendly_name}</p>
//                           <p className="text-sm text-slate-500 truncate max-w-md">{monitor.url}</p>
//                         </div>
//                       </td>
//                       <td className="px-6 py-4">
//                         <span className="inline-flex px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-md">
//                           {getMonitorTypeText(monitor.type)}
//                         </span>
//                       </td>
//                       <td className="px-6 py-4">
//                         <div className="flex items-center gap-2">
//                           <span className="text-lg font-bold text-slate-900">
//                             {monitor.custom_uptime_ratio || 'N/A'}%
//                           </span>
//                           {parseFloat(monitor.custom_uptime_ratio || '0') >= 99.9 && (
//                             <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
//                               Excellent
//                             </span>
//                           )}
//                         </div>
//                       </td>
//                       <td className="px-6 py-4">
//                         <span className="font-semibold text-slate-900">
//                           {monitor.average_response_time}ms
//                         </span>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   )
// }