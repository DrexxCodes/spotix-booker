"use client"

import React, { useState, useEffect, useRef } from "react"
import { Copy, Check, Link2, Loader2, Download, ExternalLink } from "lucide-react"
import { db } from "@/lib/firebase"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import QRCodeStyling from "qr-code-styling"

interface EventLinkTabProps {
  eventData: {
    id: string
    eventName: string
    createdBy: string
  }
  userId: string
  currentUserId: string
}

const EventLinkTab: React.FC<EventLinkTabProps> = ({ eventData, userId, currentUserId }) => {
  const [checkingLink, setCheckingLink] = useState(true)
  const [creating, setCreating] = useState(false)
  const [existingSlug, setExistingSlug] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const [copiedShort, setCopiedShort] = useState(false)
  const qrCodeRef = useRef<HTMLDivElement>(null)
  const qrCodeInstance = useRef<any>(null)

  const origin = typeof window !== "undefined" ? window.location.origin : ""

  // Generate slug from event name
  const slugFromName = (name: string): string => {
    if (!name || typeof name !== "string") return ""
    return name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/[^\w-]/g, "")
      .replace(/^-+|-+$/g, "")
  }

  const slugCandidate = slugFromName(eventData?.eventName || "")
  const shortlinkUrl = existingSlug ? `${origin}/discover/${existingSlug}` : ""

  // Initialize QR code when shortlink exists
  useEffect(() => {
    if (existingSlug && qrCodeRef.current && !qrCodeInstance.current) {
      qrCodeInstance.current = new QRCodeStyling({
        width: 300,
        height: 300,
        data: `${origin}/discover/${existingSlug}`,
        margin: 10,
        image: "/full-logo.png",
        qrOptions: {
          typeNumber: 0,
          mode: "Byte",
          errorCorrectionLevel: "H"
        },
        imageOptions: {
          hideBackgroundDots: true,
          imageSize: 0.35,
          margin: 8,
          crossOrigin: "anonymous"
        },
        dotsOptions: {
          color: "#6b2fa5",
          type: "rounded"
        },
        backgroundOptions: {
          color: "#ffffff"
        },
        cornersSquareOptions: {
          color: "#6b2fa5",
          type: "extra-rounded"
        },
        cornersDotOptions: {
          color: "#6b2fa5",
          type: "dot"
        }
      })

      qrCodeInstance.current.append(qrCodeRef.current)
    }

    // Update QR code data if slug changes
    if (qrCodeInstance.current && existingSlug) {
      qrCodeInstance.current.update({
        data: `${origin}/discover/${existingSlug}`
      })
    }
  }, [existingSlug, origin])

  // Check if shortlink exists on load
  useEffect(() => {
    let active = true

    async function checkExisting() {
      setLinkError(null)
      setCheckingLink(true)

      if (!slugCandidate) {
        setExistingSlug(null)
        setCheckingLink(false)
        return
      }

      try {
        const linkDocRef = doc(db, "Links", slugCandidate)
        const snapshot = await getDoc(linkDocRef)

        if (!active) return

        if (snapshot.exists()) {
          setExistingSlug(slugCandidate)
        } else {
          setExistingSlug(null)
        }
      } catch (e: any) {
        console.error("Error checking shortlink:", e)
        if (active) {
          setLinkError(`Failed to check shortlink: ${e?.message || "Unknown error"}`)
          setExistingSlug(null)
        }
      } finally {
        if (active) {
          setCheckingLink(false)
        }
      }
    }

    checkExisting()
    return () => {
      active = false
    }
  }, [slugCandidate])

  const handleCreateShortlink = async () => {
    setLinkError(null)

    // Validate required data
    if (!eventData.eventName) {
      setLinkError("Event name is required to create a shortlink.")
      return
    }
    if (!eventData.id) {
      setLinkError("Event ID is missing.")
      return
    }
    if (!currentUserId) {
      setLinkError("User must be logged in to create a shortlink.")
      return
    }
    if (!slugCandidate) {
      setLinkError("Could not generate a shortlink slug from the event name.")
      return
    }

    try {
      setCreating(true)

      const linkDocRef = doc(db, "Links", slugCandidate)

      // Double-check if it exists
      const existing = await getDoc(linkDocRef)
      if (existing.exists()) {
        setExistingSlug(slugCandidate)
        setCreating(false)
        return
      }

      // Create the shortlink document
      const linkData = {
        slug: slugCandidate,
        eventName: eventData.eventName,
        eventId: eventData.id,
        bookerId: currentUserId,
        createdAt: serverTimestamp()
      }

      await setDoc(linkDocRef, linkData)

      // Verify creation
      const verifyDoc = await getDoc(linkDocRef)
      if (verifyDoc.exists()) {
        setExistingSlug(slugCandidate)
      } else {
        setLinkError("Failed to verify shortlink creation")
      }
    } catch (e: any) {
      console.error("Error creating shortlink:", e)
      setLinkError(`Failed to create shortlink: ${e?.message || "Unknown error"}`)
    } finally {
      setCreating(false)
    }
  }

  const handleCopyShortlink = async () => {
    if (!shortlinkUrl) return
    try {
      await navigator.clipboard.writeText(shortlinkUrl)
      setCopiedShort(true)
      setTimeout(() => setCopiedShort(false), 2000)
    } catch (error) {
      console.error("Failed to copy shortlink:", error)
    }
  }

  const handleDownloadQR = () => {
    if (qrCodeInstance.current) {
      qrCodeInstance.current.download({
        name: `${slugCandidate}-qr-code`,
        extension: "png"
      })
    }
  }

  const isButtonDisabled = creating || checkingLink || !eventData.eventName || !eventData.id || !currentUserId || !slugCandidate

  return (
    <div className="event-link-tab">
      <div className="header-section">
        <div className="header-content">
          <h2 className="section-title">Event Shortlink & QR Code</h2>
          <p className="section-description">
            Create a memorable shortlink and QR code for your event that's easy to share
          </p>
        </div>
      </div>

      {linkError && (
        <div className="alert alert-error" role="alert">
          <span className="alert-icon">⚠️</span>
          <span>{linkError}</span>
        </div>
      )}

      {checkingLink ? (
        <div className="loading-state">
          <Loader2 className="spin" size={20} />
          <span>Checking for existing shortlink...</span>
        </div>
      ) : existingSlug ? (
        <div className="link-created-section">
          {/* Shortlink Display */}
          <div className="shortlink-card">
            <div className="shortlink-header">
              <Link2 size={20} className="link-icon" />
              <h3>Your Event Shortlink</h3>
            </div>
            
            <div className="shortlink-display">
              <a 
                href={shortlinkUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="shortlink-url"
              >
                {shortlinkUrl}
                <ExternalLink size={14} className="external-icon" />
              </a>
            </div>

            <div className="shortlink-actions">
              <button
                className="btn btn-copy"
                onClick={handleCopyShortlink}
                type="button"
              >
                {copiedShort ? (
                  <>
                    <Check size={16} />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>Copy Link</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="qr-code-card">
            <div className="qr-code-header">
              <h3>QR Code</h3>
              <p>Scan to view event page</p>
            </div>

            <div className="qr-code-container">
              <div ref={qrCodeRef} className="qr-code-wrapper" />
            </div>

            <button
              className="btn btn-download"
              onClick={handleDownloadQR}
              type="button"
            >
              <Download size={16} />
              <span>Download QR Code</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="create-link-section">
          <div className="create-card">
            <div className="icon-wrapper">
              <Link2 size={32} />
            </div>
            <h3>Create Your Event Shortlink</h3>
            <p>Generate a custom shortlink and QR code to make sharing your event easier</p>
            
            <div className="preview-slug">
              <span className="preview-label">Your shortlink will be:</span>
              <code className="preview-url">{origin}/discover/{slugCandidate || "..."}</code>
            </div>

            <button
              className="btn btn-primary btn-large"
              onClick={handleCreateShortlink}
              disabled={isButtonDisabled}
              type="button"
            >
              {creating ? (
                <>
                  <Loader2 className="spin" size={18} />
                  <span>Creating Shortlink...</span>
                </>
              ) : (
                <>
                  <Link2 size={18} />
                  <span>Create Shortlink</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .event-link-tab {
          max-width: 900px;
          margin: 0 auto;
        }

        .header-section {
          margin-bottom: 2rem;
        }

        .section-title {
          font-size: 1.75rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 0.5rem 0;
        }

        .section-description {
          color: #64748b;
          font-size: 1rem;
          margin: 0;
        }

        .alert {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          border-radius: 12px;
          margin-bottom: 1.5rem;
          font-size: 0.95rem;
        }

        .alert-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
        }

        .alert-icon {
          font-size: 1.25rem;
        }

        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 3rem;
          color: #64748b;
          font-size: 1rem;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .link-created-section {
          display: grid;
          gap: 2rem;
        }

        .shortlink-card,
        .qr-code-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 2rem;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .shortlink-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1.25rem;
        }

        .link-icon {
          color: #6b2fa5;
        }

        .shortlink-header h3,
        .qr-code-header h3 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #1e293b;
          margin: 0;
        }

        .shortlink-display {
          background: #f8fafc;
          border: 2px dashed #cbd5e1;
          border-radius: 12px;
          padding: 1.25rem;
          margin-bottom: 1rem;
        }

        .shortlink-url {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-family: 'Monaco', 'Courier New', monospace;
          color: #6b2fa5;
          font-size: 1rem;
          font-weight: 500;
          text-decoration: none;
          word-break: break-all;
        }

        .shortlink-url:hover {
          text-decoration: underline;
        }

        .external-icon {
          flex-shrink: 0;
        }

        .shortlink-actions {
          display: flex;
          gap: 0.75rem;
        }

        .qr-code-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .qr-code-header p {
          color: #64748b;
          font-size: 0.9rem;
          margin: 0.25rem 0 0 0;
        }

        .qr-code-container {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 1.5rem;
          background: #f8fafc;
          border-radius: 12px;
          margin-bottom: 1.5rem;
        }

        .qr-code-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .create-link-section {
          display: flex;
          justify-content: center;
          padding: 2rem 0;
        }

        .create-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 3rem 2.5rem;
          max-width: 500px;
          width: 100%;
          text-align: center;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .icon-wrapper {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #6b2fa5, #8a4bd6);
          color: white;
          border-radius: 16px;
          margin-bottom: 1.5rem;
        }

        .create-card h3 {
          font-size: 1.5rem;
          font-weight: 700;
          color: #1e293b;
          margin: 0 0 0.75rem 0;
        }

        .create-card p {
          color: #64748b;
          font-size: 1rem;
          margin: 0 0 1.5rem 0;
          line-height: 1.6;
        }

        .preview-slug {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 1.5rem;
        }

        .preview-label {
          display: block;
          font-size: 0.85rem;
          color: #64748b;
          margin-bottom: 0.5rem;
        }

        .preview-url {
          font-family: 'Monaco', 'Courier New', monospace;
          color: #6b2fa5;
          font-size: 0.95rem;
          word-break: break-all;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 10px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-copy {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .btn-copy:hover:not(:disabled) {
          background: #e2e8f0;
        }

        .btn-download {
          width: 100%;
          background: #f8fafc;
          color: #475569;
          border: 1px solid #e2e8f0;
        }

        .btn-download:hover:not(:disabled) {
          background: #f1f5f9;
          border-color: #cbd5e1;
        }

        .btn-primary {
          background: linear-gradient(135deg, #6b2fa5, #8a4bd6);
          color: white;
          box-shadow: 0 4px 12px rgba(107, 47, 165, 0.3);
        }

        .btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(107, 47, 165, 0.4);
        }

        .btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }

        .btn-large {
          padding: 1rem 2rem;
          font-size: 1rem;
        }

        @media (max-width: 640px) {
          .section-title {
            font-size: 1.5rem;
          }

          .shortlink-card,
          .qr-code-card,
          .create-card {
            padding: 1.5rem;
          }

          .btn {
            font-size: 0.9rem;
            padding: 0.625rem 1.25rem;
          }
        }
      `}</style>
    </div>
  )
}

export default EventLinkTab