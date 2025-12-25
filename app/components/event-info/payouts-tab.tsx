"use client"
import { Copy, Check, AlertCircle, Wallet, X, EyeOff, Eye } from "lucide-react"
import { useState, useEffect } from "react"
import { db } from "@/lib/firebase"
import { doc, getDoc, collection, getDocs, addDoc, setDoc } from "firebase/firestore"
import { useRouter } from "next/navigation"

interface PayoutData {
  id?: string
  date: string
  amount: number
  status: string
  actionCode?: string
  reference?: string
  createdAt?: any
  payoutAmount?: number
  payableAmount?: number
  agentName?: string
  transactionTime?: string
}

interface PayoutsTabProps {
  payouts: PayoutData[]
  availableBalance: number
  totalPaidOut: number
  selectedPayoutId: string | null
  actionCode: string
  copiedField: string | null
  visibleActionCodes: Record<string, boolean>
  setSelectedPayoutId: (id: string | null) => void
  setActionCode: (code: string) => void
  handleConfirmPayout: (payoutId: string) => void
  copyToClipboard: (text: string, field: string) => void
  toggleActionCodeVisibility: (payoutId: string) => void
  formatTransactionTime: (timestamp: any) => string
  eventData: any
  userId: string
  eventId: string
  currentUserId: string
  attendees: any[]
}

export default function PayoutsTab({
  payouts,
  availableBalance,
  totalPaidOut,
  selectedPayoutId,
  actionCode,
  copiedField,
  visibleActionCodes,
  setSelectedPayoutId,
  setActionCode,
  handleConfirmPayout,
  copyToClipboard,
  toggleActionCodeVisibility,
  formatTransactionTime,
  eventData,
  userId,
  eventId,
  currentUserId,
  attendees,
}: PayoutsTabProps) {
  const router = useRouter()
  const [showInitialPopup, setShowInitialPopup] = useState(false)
  const [showVerificationPopup, setShowVerificationPopup] = useState(false)
  const [verificationStep, setVerificationStep] = useState<string>("")
  const [verificationMessage, setVerificationMessage] = useState<string>("")
  const [verificationStatus, setVerificationStatus] = useState<"loading" | "success" | "error">("loading")
  const [showAccountDetailsPopup, setShowAccountDetailsPopup] = useState(false)
  const [accountDetails, setAccountDetails] = useState<any>(null)
  const [isInPayQueue, setIsInPayQueue] = useState(false)
  const [checkingPayQueue, setCheckingPayQueue] = useState(true)

  const ticketsSold = attendees.length
  const platformFee = eventData?.isFree ? 0 : availableBalance * 0.05 + ticketsSold * 100
  const payableAmount = eventData?.isFree ? 0 : availableBalance - platformFee

  useEffect(() => {
    if (eventId) {
      checkPayQueueStatus()
    }
  }, [eventId])

  const checkPayQueueStatus = async () => {
    try {
      const payQueueDocRef = doc(db, "payQueue", eventId)
      const payQueueDoc = await getDoc(payQueueDocRef)
      setIsInPayQueue(payQueueDoc.exists())
    } catch (error) {
      console.error("Error checking payQueue:", error)
    } finally {
      setCheckingPayQueue(false)
    }
  }

  const handleRequestPayout = () => {
    setShowInitialPopup(true)
  }

  const handleProceedVerification = async () => {
    setShowInitialPopup(false)
    setShowVerificationPopup(true)
    setVerificationStatus("loading")
    setVerificationMessage("Starting verification process...")

    // Start verification logic
    await runVerificationChecks()
  }

  // ============================================
  // VERIFICATION LOGIC STARTS HERE
  // ============================================
  const runVerificationChecks = async () => {
    const logData: any = {
      timestamp: new Date().toISOString(),
      eventId: eventId,
      userId: currentUserId,
      passed: false,
      failedAt: null,
    }

    try {
      // Step 1: Verify event start and end dates
      setVerificationStep("Checking event dates...")
      const dateCheckResult = await verifyEventDates()
      if (!dateCheckResult.passed) {
        logData.failedAt = "Event Dates"
        await logPayoutRequest(logData)
        setVerificationStatus("error")
        setVerificationMessage(dateCheckResult.message)
        return
      }

      // Step 2: Verify attendance (60% verified tickets)
      setVerificationStep("Verifying ticket attendance...")
      const attendanceCheckResult = await verifyAttendance()
      if (!attendanceCheckResult.passed) {
        logData.failedAt = "Attendance Verification"
        await logPayoutRequest(logData)
        setVerificationStatus("error")
        setVerificationMessage(attendanceCheckResult.message)
        return
      }

      // Step 3: Check for unresolved/pending reports
      setVerificationStep("Checking for reports...")
      const reportsCheckResult = await checkForReports()
      if (!reportsCheckResult.passed) {
        logData.failedAt = "Reports Check"
        await logPayoutRequest(logData)
        setVerificationStatus("error")
        setVerificationMessage(reportsCheckResult.message)
        return
      }

      // Step 4: Check if user has BVT
      setVerificationStep("Verifying booker status...")
      const bvtCheckResult = await checkUserBVT()
      if (!bvtCheckResult.passed) {
        logData.failedAt = "BVT Verification"
        await logPayoutRequest(logData)
        setVerificationStatus("error")
        setVerificationMessage(bvtCheckResult.message)
        return
      }

      // Step 5: Check if event is flagged
      setVerificationStep("Checking event status...")
      const flagCheckResult = await checkEventFlagged()
      if (!flagCheckResult.passed) {
        logData.failedAt = "Event Flagged"
        await logPayoutRequest(logData)
        setVerificationStatus("error")
        setVerificationMessage(flagCheckResult.message)
        return
      }

      // All checks passed!
      logData.passed = true
      await logPayoutRequest(logData)

      // Fetch account details
      const accountInfo = await fetchAccountDetails()
      if (accountInfo) {
        setAccountDetails(accountInfo)
        setShowVerificationPopup(false)
        setShowAccountDetailsPopup(true)
      } else {
        setVerificationStatus("error")
        setVerificationMessage("Could not retrieve your account details. Please update your profile.")
      }
    } catch (error) {
      console.error("Verification error:", error)
      logData.failedAt = "System Error"
      await logPayoutRequest(logData)
      setVerificationStatus("error")
      setVerificationMessage("An error occurred during verification. Please try again.")
    }
  }

  // Verification Check 1: Event Dates
  const verifyEventDates = async (): Promise<{ passed: boolean; message: string }> => {
    const now = new Date()
    const eventStartDate = new Date(eventData.eventDate + " " + eventData.eventStart)
    const eventEndDate = new Date(eventData.eventEndDate + " " + eventData.eventEnd)

    if (now < eventStartDate) {
      return {
        passed: false,
        message: "We can't process your payout as your event is yet to start",
      }
    }

    if (now < eventEndDate) {
      return {
        passed: false,
        message: "We can't process your payout as your event is yet to end",
      }
    }

    return { passed: true, message: "" }
  }

  // Verification Check 2: Attendance (60% verified)
  const verifyAttendance = async (): Promise<{ passed: boolean; message: string }> => {
    const totalTickets = attendees.length
    if (totalTickets === 0) {
      return {
        passed: false,
        message: "We can't process your payment as there are no attendees for this event.",
      }
    }

    const verifiedTickets = attendees.filter((attendee) => attendee.verified).length
    const verificationPercentage = (verifiedTickets / totalTickets) * 100

    if (verificationPercentage < 60) {
      return {
        passed: false,
        message: `We can't process your payment as there's not enough credibility of verified tickets. Only ${verificationPercentage.toFixed(1)}% have been verified but we need at least 60% of tickets to be verified.`,
      }
    }

    return { passed: true, message: "" }
  }

  // Verification Check 3: Check for Reports
  const checkForReports = async (): Promise<{ passed: boolean; message: string }> => {
    try {
      console.log("[v0] Checking reports for userId:", userId, "eventId:", eventId)

      const reportsCollectionRef = collection(db, "reports", userId, "events", eventId, "reports")
      const reportsSnapshot = await getDocs(reportsCollectionRef)

      console.log("[v0] Found", reportsSnapshot.size, "report(s)")

      if (!reportsSnapshot.empty) {
        // Check if any report has unresolved or pending status
        let hasUnresolvedOrPending = false
        const problematicReports: string[] = []

        reportsSnapshot.forEach((reportDoc) => {
          const reportData = reportDoc.data()
          console.log("[v0] Report ID:", reportDoc.id, "Status:", reportData.status)

          if (reportData.status === "unresolved" || reportData.status === "pending") {
            hasUnresolvedOrPending = true
            problematicReports.push(reportDoc.id)
          }
        })

        if (hasUnresolvedOrPending) {
          console.log("[v0] Blocking payout due to unresolved/pending reports:", problematicReports)
          return {
            passed: false,
            message:
              "We can't process your payout as there's reports about your event that need your attention. Please check the reports page",
          }
        }

        console.log("[v0] All reports are resolved/settled")
      } else {
        console.log("[v0] No reports found for this event")
      }

      return { passed: true, message: "" }
    } catch (error) {
      console.error("[v0] Error checking reports:", error)
      return { passed: true, message: "" } // If no reports collection, pass the check
    }
  }

  // Verification Check 4: Check User BVT
  const checkUserBVT = async (): Promise<{ passed: boolean; message: string }> => {
    try {
      const userDocRef = doc(db, "users", currentUserId)
      const userDoc = await getDoc(userDocRef)

      if (userDoc.exists()) {
        const userData = userDoc.data()
        if (!userData.isVerified) {
          return {
            passed: false,
            message: "verification_required",
          }
        }
      }

      return { passed: true, message: "" }
    } catch (error) {
      console.error("Error checking BVT:", error)
      return { passed: false, message: "Could not verify your booker status." }
    }
  }

  // Verification Check 5: Check if Event is Flagged
  const checkEventFlagged = async (): Promise<{ passed: boolean; message: string }> => {
    try {
      console.log("[v0] Checking if event is flagged")
      console.log("[v0] Fetching event from path: events/{userId}/userEvents/{eventId}")
      console.log("[v0] userId (creatorId):", userId)
      console.log("[v0] eventId:", eventId)

      // Fetch event document directly from Firestore to get the most current flagged status
      const eventDocRef = doc(db, "events", userId, "userEvents", eventId)
      const eventDoc = await getDoc(eventDocRef)

      if (!eventDoc.exists()) {
        console.log("[v0] Event document not found")
        return {
          passed: false,
          message: "Event not found. Unable to verify event status.",
        }
      }

      const eventDocData = eventDoc.data()
      const flaggedValue = eventDocData?.flagged

      console.log("[v0] Event document data:", {
        eventId: eventDoc.id,
        eventName: eventDocData?.eventName,
        flagged: flaggedValue,
        flaggedType: typeof flaggedValue,
        flaggedIsExplicitlyTrue: flaggedValue === true,
      })

      // CRITICAL: If flagged is explicitly true (boolean true), BLOCK payout immediately
      // DO NOT PROCEED if flagged === true
      if (flaggedValue === true) {
        console.log("[v0] CRITICAL: Event is flagged with true value - BLOCKING PAYOUT")
        return {
          passed: false,
          message:
            "Your event has been flagged and payouts have been paused. Please contact customer support immediately to resolve this.",
        }
      }

      // Only allow payout if flagged is false or absent (undefined/null)
      // This includes: flagged === false, flagged === undefined, flagged === null
      console.log("[v0] Event flagged field is not true (value:", flaggedValue, ") - allowing payout to proceed")
      return { passed: true, message: "" }
    } catch (error) {
      console.error("[v0] Error checking event flagged status:", error)
      return {
        passed: false,
        message: "Unable to verify event status. Please try again later.",
      }
    }
  }

  // Fetch Account Details
  const fetchAccountDetails = async () => {
    try {
      const userDocRef = doc(db, "users", currentUserId)
      const userDoc = await getDoc(userDocRef)

      if (userDoc.exists()) {
        const userData = userDoc.data()
        return {
          accountName: userData.accountName || "Not provided",
          accountNumber: userData.accountNumber || "Not provided",
          bankName: userData.bankName || "Not provided",
        }
      }
    } catch (error) {
      console.error("Error fetching account details:", error)
    }
    return null
  }

  // Log Payout Request
  const logPayoutRequest = async (logData: any) => {
    try {
      const logsCollectionRef = collection(db, "events", userId, "userEvents", eventId, "payoutLogs")
      await addDoc(logsCollectionRef, logData)
    } catch (error) {
      console.error("Error logging payout request:", error)
    }
  }

  // Handle Final Payout Confirmation
  const handleFinalPayoutConfirmation = async () => {
    try {
      const payQueueDocRef = doc(db, "payQueue", eventId)
      await setDoc(payQueueDocRef, {
        eventId: eventId,
        userId: userId,
        creatorId: currentUserId,
        accountName: accountDetails.accountName,
        accountNumber: accountDetails.accountNumber,
        bankName: accountDetails.bankName,
        dateRequested: new Date().toISOString(),
        totalAmount: availableBalance,
        payableAmount: payableAmount,
        fee: platformFee,
        paid: false,
        eventName: eventData.eventName,
      })

      setShowAccountDetailsPopup(false)
      setIsInPayQueue(true)
      alert("Your payout request has been submitted successfully!")
    } catch (error) {
      console.error("Error submitting payout request:", error)
      alert("Failed to submit payout request. Please try again.")
    }
  }

  return (
    <div className="space-y-8">
      {/* Request Payout Button - Only show if not in payQueue */}
      {!checkingPayQueue && !isInPayQueue && (
        <div className="flex justify-end">
          {eventData?.isFree ? (
            <div className="text-right">
              <p className="text-gray-600 font-medium">This is a free event</p>
              <p className="text-sm text-gray-500">No payouts needed for free events</p>
            </div>
          ) : (
            <button
              onClick={handleRequestPayout}
              className="px-6 py-3 bg-[#6b2fa5] text-white font-semibold rounded-lg hover:bg-[#5a2589] transition-colors shadow-lg hover:shadow-xl"
            >
              Request Payout
            </button>
          )}
        </div>
      )}

      {/* Initial Popup */}
      {showInitialPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Request Payout</h3>
              <button onClick={() => setShowInitialPopup(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            <p className="text-gray-700 mb-6">
              We will check if your event is set for payout. This includes verifying dates, attendance, reports, and
              your account status.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowInitialPopup(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleProceedVerification}
                className="flex-1 px-4 py-2 bg-[#6b2fa5] text-white rounded-lg hover:bg-[#5a2589] transition-colors"
              >
                Alright, go on
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification Popup */}
      {showVerificationPopup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Verifying Event</h3>
              {verificationStatus === "error" && (
                <button onClick={() => setShowVerificationPopup(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              )}
            </div>

            <div className="space-y-4">
              {verificationStatus === "loading" && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-12 h-12 border-4 border-[#6b2fa5] border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-700 text-center">{verificationStep}</p>
                </div>
              )}

              {verificationStatus === "error" && (
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-700">{verificationMessage}</p>
                  </div>

                  {verificationMessage === "verification_required" ? (
                    <div className="space-y-4">
                      <p className="text-gray-700">
                        You're not yet a verified booker on Spotix. Please submit some information for KYC purposes at
                        the verification page.
                      </p>
                      <button
                        onClick={() => router.push("/verification")}
                        className="w-full px-4 py-2 bg-[#6b2fa5] text-white rounded-lg hover:bg-[#5a2589] transition-colors"
                      >
                        Go to Verification Page
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowVerificationPopup(false)}
                      className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Close
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Account Details Confirmation Popup */}
      {showAccountDetailsPopup && accountDetails && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Payout Approved!</h3>
              <button onClick={() => setShowAccountDetailsPopup(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-700 font-medium mb-2">You have passed all the checks for payouts!</p>
                <p className="text-sm text-green-600">
                  We shall be paying you to the account details you have provided below.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Account Name</p>
                  <p className="text-gray-900 font-semibold">{accountDetails.accountName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Account Number</p>
                  <p className="text-gray-900 font-semibold">{accountDetails.accountNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Bank Name</p>
                  <p className="text-gray-900 font-semibold">{accountDetails.bankName}</p>
                </div>
                <div className="border-t pt-3">
                  <p className="text-xs text-gray-500 font-medium">Payout Amount</p>
                  <p className="text-2xl text-[#6b2fa5] font-bold">₦{payableAmount.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAccountDetailsPopup(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFinalPayoutConfirmation}
                  className="flex-1 px-4 py-2 bg-[#6b2fa5] text-white rounded-lg hover:bg-[#5a2589] transition-colors"
                >
                  Proceed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Alert */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
        <AlertCircle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700">
          Your payout will be processed after all verifications are complete. The payable amount excludes our platform
          fee of 5% + ₦100 of each ticket sold.
        </p>
      </div>

      {/* Balance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-purple-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-purple-100 rounded-lg">
              <Wallet size={24} className="text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Available Balance</p>
              <p className="text-2xl font-bold text-gray-900">₦{availableBalance.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-orange-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-orange-100 rounded-lg">
              <AlertCircle size={24} className="text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Platform Fee (5% + ₦100)</p>
              <p className="text-2xl font-bold text-gray-900">₦{platformFee.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-green-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-green-100 rounded-lg">
              <Wallet size={24} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 font-medium">Payable Amount</p>
              <p className="text-2xl font-bold text-green-600">₦{payableAmount.toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {isInPayQueue && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-800 mb-2">Payout Request Submitted</h3>
          <p className="text-green-700">
            Your payout request is currently being processed. You will be notified once the payment is completed.
          </p>
        </div>
      )}

      {/* Payouts Table */}
      <div className="bg-white rounded-lg border border-purple-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-purple-50 border-b-2 border-purple-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Time</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Reference</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Amount</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Agent</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Action Code</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
              </tr>
            </thead>
            <tbody>
              {payouts.length > 0 ? (
                payouts.map((payout) => (
                  <tr key={payout.id} className="border-b border-gray-200 hover:bg-purple-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-700">{payout.date}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {payout.transactionTime || formatTransactionTime(payout.createdAt) || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-mono">{payout.reference || "N/A"}</td>
                    <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                      ₦{(payout.payoutAmount || payout.amount).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">{payout.agentName || "Unknown"}</td>
                    <td className="px-6 py-4 text-sm">
                      {payout.actionCode ? (
                        <div className="flex items-center gap-2">
                          <code
                            className={`px-2 py-1 rounded bg-gray-100 text-sm font-mono ${
                              visibleActionCodes[payout.id || ""] ? "text-gray-900" : "text-gray-500"
                            }`}
                          >
                            {visibleActionCodes[payout.id || ""] ? payout.actionCode : "••••••"}
                          </code>
                          <button
                            onClick={() => toggleActionCodeVisibility(payout.id || "")}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            title={visibleActionCodes[payout.id || ""] ? "Hide code" : "Show code"}
                          >
                            {visibleActionCodes[payout.id || ""] ? (
                              <EyeOff size={16} className="text-gray-600" />
                            ) : (
                              <Eye size={16} className="text-gray-600" />
                            )}
                          </button>
                          <button
                            onClick={() => copyToClipboard(payout.actionCode || "", `actionCode-${payout.id}`)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                            title="Copy code"
                          >
                            {copiedField === `actionCode-${payout.id}` ? (
                              <Check size={16} className="text-green-600" />
                            ) : (
                              <Copy size={16} className="text-gray-600" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          payout.status === "Confirmed"
                            ? "bg-green-100 text-green-700"
                            : payout.status === "Pending"
                              ? "bg-yellow-100 text-yellow-700"
                              : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {payout.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                    No payouts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
