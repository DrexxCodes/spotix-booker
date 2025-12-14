"use client"

interface ProfileData {
  fullName: string
  email: string
  dateOfBirth: string
  accountName: string
  accountNumber: string
  bankName: string
}

interface PersonalInformationProps {
  profileData: ProfileData
}

export function PersonalInformation({ profileData }: PersonalInformationProps) {
  return (
    <div className="space-y-8">
      {/* Personal Information */}
      <div className="bg-white rounded-2xl shadow-md p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-foreground mb-6 pb-4 border-b-2 border-[#6b2fa5]">
          Personal Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Full Name</label>
            <p className="text-lg font-semibold text-foreground">{profileData.fullName}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Email Address</label>
            <p className="text-lg font-semibold text-foreground">{profileData.email}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Date of Birth</label>
            <p className="text-lg font-semibold text-foreground">{profileData.dateOfBirth || "Not provided"}</p>
          </div>
        </div>
      </div>

      {/* Banking Information */}
      <div className="bg-white rounded-2xl shadow-md p-8 border border-gray-200">
        <h2 className="text-2xl font-bold text-foreground mb-6 pb-4 border-b-2 border-[#6b2fa5]">
          Banking Information
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Account Name</label>
            <p className="text-lg font-semibold text-foreground">{profileData.accountName}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Account Number</label>
            <p className="text-lg font-semibold text-foreground font-mono">{profileData.accountNumber}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Bank Name</label>
            <p className="text-lg font-semibold text-foreground">{profileData.bankName}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
