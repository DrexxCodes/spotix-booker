// import { NextRequest, NextResponse } from 'next/server'

// export async function POST(request: NextRequest) {
//   try {
//     // Get API key from environment variable
//     const apiKey = process.env.UPTIMEROBOT_API_KEY

//     if (!apiKey) {
//       return NextResponse.json(
//         { error: 'API key not configured.' },
//         { status: 500 }
//       )
//     }

//     // Call UptimeRobot API
//     const response = await fetch('https://api.uptimerobot.com/v2/getMonitors', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//         api_key: apiKey,
//         format: 'json',
//         logs: 1,
//         log_limit: 10,
//         response_times: 1,
//         response_times_limit: 24,
//         custom_uptime_ratios: '1-7-30',
//         custom_uptime_ranges: '1-7-30',
//         ssl: 1,
//       }),
//     })

//     const data = await response.json()

//     if (!response.ok) {
//       return NextResponse.json(
//         { error: 'Failed to fetch from UptimeRobot API', details: data },
//         { status: response.status }
//       )
//     }

//     return NextResponse.json(data)
//   } catch (error) {
//     console.error('API Error:', error)
//     return NextResponse.json(
//       { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
//       { status: 500 }
//     )
//   }
// }