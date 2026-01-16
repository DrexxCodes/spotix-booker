"use client"

import React from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export default function NotBookerPage() {
  return (
    <div className="not-booker-page">
      <div className="container">
        <div className="content-card">
          {/* Image */}
          <div className="image-wrapper">
            <img 
              src="/not-booker.svg" 
              alt="Not a booker illustration" 
              className="illustration"
            />
          </div>

          {/* Heading */}
          <h1 className="heading">Become a Booker</h1>

          {/* Text Content */}
          <div className="text-content">
            <p>
              Seems like the system has detected you are not a booker. A booker is an event 
              organizer on Spotix. Becoming one is super easy. Just click the link below and 
              it will take you to your profile. Scroll down and click become booker. Follow 
              onscreen prompts and that's it.
            </p>
            <p className="highlight">
              Be sure to add profile first. Could even be a logo!
            </p>
          </div>

          {/* Button */}
          <Link href="https://spotix.com.ng/profile">
            <button className="cta-button">
              <span>Go to Profile</span>
              <ArrowRight size={20} />
            </button>
          </Link>
        </div>
      </div>

      <style jsx>{`
        .not-booker-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 50%, #faf5ff 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }

        .container {
          width: 100%;
          max-width: 600px;
        }

        .content-card {
          background: white;
          border-radius: 24px;
          padding: 3rem 2.5rem;
          box-shadow: 0 10px 40px rgba(107, 47, 165, 0.1);
          text-align: center;
          border: 1px solid rgba(107, 47, 165, 0.1);
        }

        .image-wrapper {
          margin-bottom: 2rem;
          display: flex;
          justify-content: center;
        }

        .illustration {
          width: 100%;
          max-width: 280px;
          height: auto;
          object-fit: contain;
        }

        .heading {
          font-size: 2.5rem;
          font-weight: 800;
          color: #1e293b;
          margin: 0 0 1.5rem 0;
          background: linear-gradient(135deg, #6b2fa5, #8a4bd6);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .text-content {
          margin-bottom: 2.5rem;
        }

        .text-content p {
          color: #475569;
          font-size: 1.05rem;
          line-height: 1.7;
          margin: 0 0 1rem 0;
        }

        .text-content p:last-child {
          margin-bottom: 0;
        }

        .highlight {
          color: #6b2fa5;
          font-weight: 600;
          background: rgba(107, 47, 165, 0.08);
          padding: 0.75rem 1rem;
          border-radius: 12px;
          display: inline-block;
          margin-top: 0.5rem;
        }

        .cta-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          background: linear-gradient(135deg, #6b2fa5, #8a4bd6);
          color: white;
          border: none;
          padding: 1rem 2.5rem;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 6px 20px rgba(107, 47, 165, 0.3);
          font-family: inherit;
        }

        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(107, 47, 165, 0.4);
        }

        .cta-button:active {
          transform: translateY(0);
        }

        /* Responsive Design */
        @media (max-width: 640px) {
          .not-booker-page {
            padding: 1.5rem;
          }

          .content-card {
            padding: 2rem 1.5rem;
            border-radius: 20px;
          }

          .illustration {
            max-width: 220px;
          }

          .heading {
            font-size: 2rem;
          }

          .text-content p {
            font-size: 1rem;
          }

          .cta-button {
            padding: 0.875rem 2rem;
            font-size: 1rem;
            width: 100%;
          }
        }

        @media (max-width: 400px) {
          .heading {
            font-size: 1.75rem;
          }

          .illustration {
            max-width: 180px;
          }
        }
      `}</style>
    </div>
  )
}