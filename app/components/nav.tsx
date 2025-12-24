"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import Image from "next/image"

export function Nav() {
  const [isOpen, setIsOpen] = useState(false)

  const toggleMenu = () => {
    setIsOpen(!isOpen)
  }

  const navItems = [
    { href: "/dashboard", label: "Home" },
    { href: "/create-event", label: "Create Event" },
    { href: "/profile", label: "Profile" },
    { href: "/events", label: "Events" },
    { href: "/reports", label: "Reports" },
    { href: "/listings", label: "Spotix Store" },
  ]

  return (
    <nav className="border-b border-white/10 bg-white/40 backdrop-blur-2xl backdrop-saturate-150 sticky top-0 z-50 shadow-xl shadow-black/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 rounded-lg overflow-hidden shadow-md ring-2 ring-[#6b2fa5]/20 group-hover:ring-[#6b2fa5]/40 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
              <Image
                src="/xmas.png"
                alt="Spotix"
                fill
                className="object-cover"
                priority
              />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-[#6b2fa5] via-[#8b3fc5] to-[#6b2fa5] bg-clip-text text-transparent hidden sm:inline group-hover:scale-105 transition-transform duration-300">
              Spotix for Bookers
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group relative px-4 py-2 text-slate-700 hover:text-[#6b2fa5] rounded-lg transition-all duration-300 font-semibold overflow-hidden"
              >
                {/* Animated background on hover */}
                <span className="absolute inset-0 bg-gradient-to-r from-[#6b2fa5]/0 via-[#6b2fa5]/10 to-[#6b2fa5]/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-out"></span>
                
                {/* Bottom border animation */}
                <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-gradient-to-r from-[#6b2fa5] to-purple-600 group-hover:w-full group-hover:left-0 transition-all duration-300"></span>
                
                <span className="relative">{item.label}</span>
              </Link>
            ))}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={toggleMenu}
            className="md:hidden p-2 rounded-lg hover:bg-[#6b2fa5]/10 text-[#6b2fa5] transition-all duration-300 hover:scale-110 active:scale-95"
            aria-label="Toggle menu"
          >
            <div className="relative w-6 h-6">
              <Menu 
                size={24} 
                className={`absolute inset-0 transition-all duration-300 ${
                  isOpen 
                    ? 'opacity-0 rotate-90 scale-0' 
                    : 'opacity-100 rotate-0 scale-100'
                }`}
              />
              <X 
                size={24} 
                className={`absolute inset-0 transition-all duration-300 ${
                  isOpen 
                    ? 'opacity-100 rotate-0 scale-100' 
                    : 'opacity-0 -rotate-90 scale-0'
                }`}
              />
            </div>
          </button>
        </div>

        {/* Mobile Navigation */}
        <div 
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
            isOpen 
              ? 'max-h-96 opacity-100 pb-4' 
              : 'max-h-0 opacity-0'
          }`}
        >
          <div className="space-y-2 border-t-2 border-slate-200 pt-4">
            {navItems.map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                className="group relative block px-4 py-3 text-slate-700 hover:text-[#6b2fa5] rounded-lg transition-all duration-300 font-semibold overflow-hidden"
                onClick={() => setIsOpen(false)}
                style={{
                  animationDelay: `${index * 50}ms`,
                  animation: isOpen ? 'slideInFromLeft 0.3s ease-out forwards' : 'none'
                }}
              >
                {/* Gradient background on hover */}
                <span className="absolute inset-0 bg-gradient-to-r from-[#6b2fa5]/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
                
                {/* Left border accent */}
                <span className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#6b2fa5] to-purple-600 scale-y-0 group-hover:scale-y-100 transition-transform duration-300 rounded-r-full"></span>
                
                <span className="relative ml-2">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideInFromLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </nav>
  )
}