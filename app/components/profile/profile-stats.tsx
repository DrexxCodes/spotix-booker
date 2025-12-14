"use client"

interface ProfileData {
  eventsCreated: number
  totalRevenue: number
}

interface ProfileStatsProps {
  profileData: ProfileData
}

export function ProfileStats({ profileData }: ProfileStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
      <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-[#6b2fa5]">
        <p className="text-sm font-medium text-muted-foreground mb-2">Events Created</p>
        <p className="text-4xl font-bold text-[#6b2fa5]">{profileData.eventsCreated}</p>
      </div>
      <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-[#6b2fa5]">
        <p className="text-sm font-medium text-muted-foreground mb-2">Total Revenue</p>
        <p className="text-3xl font-bold text-foreground">
          ₦{profileData.totalRevenue.toLocaleString("en-NG", { maximumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  )
}
