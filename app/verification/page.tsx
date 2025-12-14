"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { auth, db } from "@/lib/firebase"
import { onAuthStateChanged } from "firebase/auth"
import { doc, getDoc, updateDoc, collection, addDoc, query, where, getDocs } from "firebase/firestore"
import { uploadImage } from "@/lib/image-uploader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, CheckCircle2, Copy, Upload, FileText, Camera, MapPin } from "lucide-react"

interface UserData {
  uid: string
  username: string
  email: string
  fullName: string
  phoneNumber: string
  dateOfBirth: string
  accountName: string
  accountNumber: string
  bankName: string
  isVerified: boolean
}

interface DocumentStatus {
  status: "pending" | "completed"
  dateUploaded: string
  timeUploaded: string
  fileUrl: string
  provider?: string
}

interface VerificationData {
  nin: DocumentStatus
  selfie: DocumentStatus
  proofOfAddress: DocumentStatus
  address: string
  verificationState: "Not Verified" | "Awaiting Verification" | "Verified"
  uid: string
}

export default function VerificationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [phoneNumber, setPhoneNumber] = useState("")
  const [ageError, setAgeError] = useState<string | null>(null)
  const [verificationData, setVerificationData] = useState<VerificationData>({
    nin: { status: "pending", dateUploaded: "", timeUploaded: "", fileUrl: "" },
    selfie: { status: "pending", dateUploaded: "", timeUploaded: "", fileUrl: "" },
    proofOfAddress: { status: "pending", dateUploaded: "", timeUploaded: "", fileUrl: "" },
    address: "",
    verificationState: "Not Verified",
    uid: "",
  })
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({
    nin: 0,
    selfie: 0,
    proofOfAddress: 0,
  })
  const [showUploadDialog, setShowUploadDialog] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [verificationId, setVerificationId] = useState<string>("")
  const [copiedToClipboard, setCopiedToClipboard] = useState(false)
  const [allRequirementsMet, setAllRequirementsMet] = useState(false)

  const resetFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login")
        return
      }

      try {
        const userDocRef = doc(db, "users", user.uid)
        const userDoc = await getDoc(userDocRef)

        if (userDoc.exists()) {
          const data = userDoc.data()

          if (data.isVerified) {
            alert("You are already verified! Redirecting to your profile.")
            router.push("/profile")
            return
          }

          if (data.dateOfBirth) {
            const age = calculateAge(data.dateOfBirth)
            if (Number.parseInt(age) < 18) {
              setAgeError("You must be at least 18 years old to be verified as a booker.")
            }
          }

          const userData = {
            uid: user.uid,
            username: data.username || "",
            email: data.email || "",
            fullName: data.fullName || "",
            phoneNumber: data.phoneNumber || "",
            dateOfBirth: data.dateOfBirth || "",
            accountName: data.accountName || "",
            accountNumber: data.accountNumber || "",
            bankName: data.bankName || "",
            isVerified: data.isVerified || false,
          }

          setUserData(userData)
          setPhoneNumber(userData.phoneNumber || "")

          const verificationQuery = query(collection(db, "verification"), where("uid", "==", user.uid))
          const verificationSnapshot = await getDocs(verificationQuery)

          if (!verificationSnapshot.empty) {
            const verificationDoc = verificationSnapshot.docs[0]
            const verificationData = verificationDoc.data() as VerificationData
            setVerificationId(verificationDoc.id || "")
            setVerificationData({
              nin: verificationData.nin || { status: "pending", dateUploaded: "", timeUploaded: "", fileUrl: "" },
              selfie: verificationData.selfie || { status: "pending", dateUploaded: "", timeUploaded: "", fileUrl: "" },
              proofOfAddress: verificationData.proofOfAddress || {
                status: "pending",
                dateUploaded: "",
                timeUploaded: "",
                fileUrl: "",
              },
              address: verificationData.address || "",
              verificationState: verificationData.verificationState || "Not Verified",
              uid: user.uid,
            })
          } else {
            setVerificationData((prev) => ({
              ...prev,
              uid: user.uid,
            }))
          }
        } else {
          router.push("/profile")
        }
      } catch (error) {
        console.error("Error fetching user data:", error)
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [router])

  useEffect(() => {
    const allDocumentsUploaded =
      verificationData.nin.status === "completed" &&
      verificationData.selfie.status === "completed" &&
      verificationData.proofOfAddress.status === "completed"

    const addressFilled = verificationData.address.trim() !== ""
    const phoneNumberFilled = phoneNumber.trim() !== ""
    const noAgeError = !ageError

    setAllRequirementsMet(
      allDocumentsUploaded && addressFilled && phoneNumberFilled && verificationId !== "" && noAgeError,
    )
  }, [verificationData, verificationId, phoneNumber, ageError])

  const handleAddressChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setVerificationData({
      ...verificationData,
      address: e.target.value,
    })
  }

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, "").slice(0, 11)
    setPhoneNumber(value)
  }

  const handleUploadClick = (documentType: string) => {
    setShowUploadDialog(documentType)
    resetFileInput()

    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.click()
      }
    }, 100)
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !showUploadDialog || !userData) {
      setShowUploadDialog(null)
      return
    }

    const file = e.target.files[0]
    const documentType = showUploadDialog

    if (documentType === "selfie") {
      if (!file.type.startsWith("image/")) {
        alert("Please upload an image file for your selfie")
        setShowUploadDialog(null)
        return
      }
    } else {
      if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
        alert("Please upload an image or PDF file")
        setShowUploadDialog(null)
        return
      }
    }

    try {
      setUploadProgress({ ...uploadProgress, [documentType]: 10 })

      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          const currentProgress = prev[documentType]
          if (currentProgress < 90) {
            return { ...prev, [documentType]: currentProgress + 10 }
          }
          return prev
        })
      }, 500)

      const { uploadPromise } = uploadImage(file, {
        cloudinaryFolder: "Verification",
        showAlert: true,
      })
      const { url: fileUrl, provider } = await uploadPromise

      clearInterval(progressInterval)

      if (!fileUrl) {
        throw new Error("Upload failed on all providers")
      }

      setUploadProgress({ ...uploadProgress, [documentType]: 100 })

      const now = new Date()
      const dateUploaded = now.toLocaleDateString()
      const timeUploaded = now.toLocaleTimeString()

      const updatedVerificationData = {
        ...verificationData,
        [documentType]: {
          status: "completed" as const,
          dateUploaded,
          timeUploaded,
          fileUrl,
          provider,
        },
      }

      const allDocumentsUploaded =
        updatedVerificationData.nin.status === "completed" &&
        updatedVerificationData.selfie.status === "completed" &&
        updatedVerificationData.proofOfAddress.status === "completed"

      if (allDocumentsUploaded && updatedVerificationData.address.trim() !== "") {
        updatedVerificationData.verificationState = "Awaiting Verification"
      }

      setVerificationData(updatedVerificationData)

      await saveVerificationToFirestore(updatedVerificationData)

      setTimeout(() => {
        setShowUploadDialog(null)
        setUploadProgress({ ...uploadProgress, [documentType]: 0 })
      }, 1000)
    } catch (error) {
      console.error("Error uploading file:", error)
      alert("Failed to upload file. Please try again.")
      setUploadProgress({ ...uploadProgress, [documentType]: 0 })
      setShowUploadDialog(null)
    }
  }

  const saveVerificationToFirestore = async (data: VerificationData) => {
    try {
      const firestoreData = {
        nin: {
          status: data.nin.status,
          dateUploaded: data.nin.dateUploaded,
          timeUploaded: data.nin.timeUploaded,
          fileUrl: data.nin.fileUrl,
          provider: data.nin.provider || null,
        },
        selfie: {
          status: data.selfie.status,
          dateUploaded: data.selfie.dateUploaded,
          timeUploaded: data.selfie.timeUploaded,
          fileUrl: data.selfie.fileUrl,
          provider: data.selfie.provider || null,
        },
        proofOfAddress: {
          status: data.proofOfAddress.status,
          dateUploaded: data.proofOfAddress.dateUploaded,
          timeUploaded: data.proofOfAddress.timeUploaded,
          fileUrl: data.proofOfAddress.fileUrl,
          provider: data.proofOfAddress.provider || null,
        },
        address: data.address,
        verificationState: data.verificationState,
        uid: data.uid,
      }

      if (verificationId) {
        await updateDoc(doc(db, "verification", verificationId), firestoreData)
      } else {
        const docRef = await addDoc(collection(db, "verification"), firestoreData)
        setVerificationId(docRef.id)
      }
    } catch (error) {
      console.error("Error saving verification data:", error)
      throw error
    }
  }

  const saveVerification = async () => {
    if (!userData) return

    if (ageError) {
      alert(ageError)
      return
    }

    try {
      setLoading(true)

      if (phoneNumber !== userData.phoneNumber) {
        const userDocRef = doc(db, "users", userData.uid)
        await updateDoc(userDocRef, {
          phoneNumber: phoneNumber,
        })
      }

      await saveVerificationToFirestore(verificationData)

      alert("Verification information saved successfully!")
      router.push("/profile")
    } catch (error) {
      console.error("Error saving verification data:", error)
      alert("Failed to save verification data. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const copyVerificationId = () => {
    if (verificationId) {
      navigator.clipboard
        .writeText(verificationId)
        .then(() => {
          setCopiedToClipboard(true)
          setTimeout(() => setCopiedToClipboard(false), 3000)
        })
        .catch((err) => {
          console.error("Failed to copy verification ID: ", err)
        })
    }
  }

  const getDocumentName = (documentType: string): string => {
    switch (documentType) {
      case "nin":
        return "National Identity Number (NIN)"
      case "selfie":
        return "Selfie Shot"
      case "proofOfAddress":
        return "Proof of Address"
      default:
        return "Document"
    }
  }

  const getDocumentIcon = (documentType: string) => {
    switch (documentType) {
      case "nin":
        return <FileText className="h-5 w-5" />
      case "selfie":
        return <Camera className="h-5 w-5" />
      case "proofOfAddress":
        return <MapPin className="h-5 w-5" />
      default:
        return <Upload className="h-5 w-5" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#6b2fa5] border-t-transparent"></div>
          <p className="mt-4 text-[#6b2fa5] font-medium">Loading verification data...</p>
        </div>
      </div>
    )
  }

  if (!userData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-white">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h5 className="font-semibold">Error</h5>
              <p className="text-sm text-red-800">User data not found. Please log in again.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="rounded-lg border border-[#6b2fa5]/20 bg-white shadow-sm">
          <div className="p-6 text-center space-y-4">
            <div className="mx-auto w-24 h-24 bg-[#6b2fa5]/10 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-[#6b2fa5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-[#6b2fa5]">Booker Verification</h2>
              <p className="mt-2 text-base text-gray-600">
                The verification process is free and we don't publicly share the details that have been uploaded here.
                Your information is securely stored and used only for verification purposes.
              </p>
            </div>
          </div>
        </div>

        {/* Age Error Alert */}
        {ageError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-900">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <h5 className="font-semibold">Age Verification Failed</h5>
                <div className="text-sm text-red-800 space-y-2">
                  <p>{ageError}</p>
                  <p>You must be at least 18 years old to be verified as a booker on Spotix.</p>
                  <Button variant="outline" onClick={() => router.push("/profile")} className="mt-2">
                    Return to Profile
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Personal Information */}
        <div className="rounded-lg border border-[#6b2fa5]/20 bg-white shadow-sm">
          <div className="p-6">
            <h3 className="text-xl font-semibold text-[#6b2fa5] mb-4">Personal Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="fullName" className="text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <Input id="fullName" value={userData.fullName} readOnly className="bg-gray-50" />
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email
                </label>
                <Input id="email" type="email" value={userData.email} readOnly className="bg-gray-50" />
              </div>
              <div className="space-y-2">
                <label htmlFor="phoneNumber" className="text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <Input
                  id="phoneNumber"
                  type="text"
                  value={phoneNumber}
                  onChange={handlePhoneNumberChange}
                  placeholder="Enter your phone number"
                  maxLength={11}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="age" className="text-sm font-medium text-gray-700">
                  Age
                </label>
                <Input
                  id="age"
                  value={userData.dateOfBirth ? calculateAge(userData.dateOfBirth) : "Not provided"}
                  readOnly
                  className={`bg-gray-50 ${Number.parseInt(calculateAge(userData.dateOfBirth)) < 18 ? "border-red-500" : ""}`}
                />
                {Number.parseInt(calculateAge(userData.dateOfBirth)) < 18 && (
                  <p className="text-xs text-red-500">Must be at least 18 years old</p>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="verificationId" className="text-sm font-medium text-gray-700">
                  Verification ID
                </label>
                <div className="flex gap-2">
                  <Input
                    id="verificationId"
                    value={verificationId}
                    readOnly
                    placeholder="No verification ID yet"
                    className="bg-gray-50"
                  />
                  {verificationId && (
                    <Button
                      onClick={copyVerificationId}
                      variant="outline"
                      className={`${copiedToClipboard ? "bg-green-50 text-green-700" : "text-[#6b2fa5]"} border-[#6b2fa5]/20`}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      {copiedToClipboard ? "Copied!" : "Copy"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Banking Information */}
        <div className="rounded-lg border border-[#6b2fa5]/20 bg-white shadow-sm">
          <div className="p-6">
            <h3 className="text-xl font-semibold text-[#6b2fa5] mb-4">Banking Information</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="accountName" className="text-sm font-medium text-gray-700">
                  Account Name
                </label>
                <Input id="accountName" value={userData.accountName} readOnly className="bg-gray-50" />
              </div>
              <div className="space-y-2">
                <label htmlFor="accountNumber" className="text-sm font-medium text-gray-700">
                  Account Number
                </label>
                <Input id="accountNumber" value={userData.accountNumber} readOnly className="bg-gray-50" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label htmlFor="bankName" className="text-sm font-medium text-gray-700">
                  Bank Name
                </label>
                <Input id="bankName" value={userData.bankName} readOnly className="bg-gray-50" />
              </div>
            </div>
          </div>
        </div>

        {/* Address Information */}
        <div className="rounded-lg border border-[#6b2fa5]/20 bg-white shadow-sm">
          <div className="p-6">
            <h3 className="text-xl font-semibold text-[#6b2fa5] mb-4">Address Information</h3>
            <div className="space-y-2">
              <label htmlFor="address" className="text-sm font-medium text-gray-700">
                Residential Address
              </label>
              <Textarea
                id="address"
                value={verificationData.address}
                onChange={handleAddressChange}
                placeholder="Enter your full residential address"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Upload Documents */}
        <div className="rounded-lg border border-[#6b2fa5]/20 bg-white shadow-sm">
          <div className="p-6">
            <h3 className="text-xl font-semibold text-[#6b2fa5] mb-4">Upload Documents</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#6b2fa5]/20">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#6b2fa5]">Document</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#6b2fa5]">Action</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#6b2fa5]">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#6b2fa5]">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#6b2fa5]">Time</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#6b2fa5]">Provider</th>
                  </tr>
                </thead>
                <tbody>
                  {(["nin", "selfie", "proofOfAddress"] as const).map((docType) => (
                    <tr key={docType} className="border-b border-gray-100">
                      <td className="py-3 px-4 flex items-center gap-2">
                        {getDocumentIcon(docType)}
                        <span className="text-sm">{getDocumentName(docType)}</span>
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          onClick={() => handleUploadClick(docType)}
                          variant="default"
                          className="bg-[#6b2fa5] hover:bg-[#5a2589] text-white"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {verificationData[docType].status === "completed" ? "Replace" : "Upload"}
                        </Button>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            verificationData[docType].status === "completed"
                              ? "bg-green-500 text-white"
                              : "bg-gray-200 text-gray-700"
                          }`}
                        >
                          {verificationData[docType].status === "completed" ? "Completed" : "Pending"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm">{verificationData[docType].dateUploaded || "-"}</td>
                      <td className="py-3 px-4 text-sm">{verificationData[docType].timeUploaded || "-"}</td>
                      <td className="py-3 px-4 text-sm">{verificationData[docType].provider || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Verification State */}
        <div className="rounded-lg border border-[#6b2fa5]/20 bg-white shadow-sm">
          <div className="p-6">
            <h3 className="text-xl font-semibold text-[#6b2fa5] mb-4">Verification State</h3>
            <span
              className={`inline-flex items-center rounded-full border px-4 py-2 text-lg font-medium ${
                verificationData.verificationState === "Verified"
                  ? "bg-green-50 text-green-700 border-green-300"
                  : verificationData.verificationState === "Awaiting Verification"
                    ? "bg-yellow-50 text-yellow-700 border-yellow-300"
                    : "bg-gray-50 text-gray-700 border-gray-300"
              }`}
            >
              {verificationData.verificationState}
            </span>
          </div>
        </div>

        {/* Verification Complete Message */}
        {allRequirementsMet && (
          <div className="rounded-lg border border-green-500 bg-green-50 p-4 text-green-900">
            <div className="flex gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-3 flex-1">
                <h5 className="font-semibold text-green-800">All Verification Requirements Completed!</h5>
                <div className="text-sm text-green-700 space-y-3">
                  <p>
                    You have successfully uploaded all required documents and completed all required fields. Please copy
                    your Verification ID and share it with our customer service team to complete your verification
                    process.
                  </p>
                  <div className="bg-white p-4 rounded-lg border border-green-200">
                    <p className="font-semibold text-green-800 mb-2">Your Verification ID:</p>
                    <div className="flex gap-2">
                      <Input value={verificationId} readOnly className="bg-white" />
                      <Button
                        onClick={copyVerificationId}
                        className={`${copiedToClipboard ? "bg-green-600" : "bg-[#6b2fa5]"} hover:bg-[#5a2589]`}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        {copiedToClipboard ? "Copied!" : "Copy ID"}
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm">
                    Contact our customer service team at <strong>support@spotix.com</strong> or through the chat widget.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4 justify-end">
          <Button variant="outline" onClick={() => router.push("/profile")} className="border-[#6b2fa5]/20">
            Cancel
          </Button>
          <Button
            onClick={saveVerification}
            disabled={!!ageError || loading}
            className="bg-[#6b2fa5] hover:bg-[#5a2589] text-white"
          >
            Save Verification
          </Button>
        </div>

        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileChange}
          accept={showUploadDialog === "selfie" ? "image/*" : "image/*,.pdf"}
        />

        {/* Upload Dialog */}
        {showUploadDialog && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowUploadDialog(null)}
          >
            <div className="max-w-md w-full rounded-lg border bg-white shadow-sm" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <h3 className="text-xl font-semibold text-[#6b2fa5] mb-4">
                  Upload {getDocumentName(showUploadDialog)}
                </h3>
                <div className="space-y-4">
                  <div
                    className="border-2 border-dashed border-[#6b2fa5]/30 rounded-lg p-12 text-center cursor-pointer hover:bg-[#6b2fa5]/5 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-12 w-12 mx-auto text-[#6b2fa5] mb-4" />
                    <p className="text-[#6b2fa5] font-medium">Click to Upload</p>
                    <p className="text-xs text-gray-500 mt-2">Secured by Spotix. All uploads are safe and secure</p>
                  </div>
                  {uploadProgress[showUploadDialog] > 0 && (
                    <div className="space-y-2">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className="bg-[#6b2fa5] h-2.5 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress[showUploadDialog]}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-center text-[#6b2fa5]">{uploadProgress[showUploadDialog]}%</p>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => setShowUploadDialog(null)}
                    className="w-full border-[#6b2fa5]/20"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function calculateAge(dateOfBirth: string): string {
  try {
    const dob = new Date(dateOfBirth)
    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const monthDiff = today.getMonth() - dob.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--
    }

    return age.toString()
  } catch (error) {
    return "Unknown"
  }
}
// End of file: app/verification/page.tsx