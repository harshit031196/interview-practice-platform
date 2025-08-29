'use client'

import { useEffect, useState } from 'react'

interface LoadingAnimationProps {
  message?: string
}

export function LoadingAnimation({ message = 'Loading...' }: LoadingAnimationProps) {
  const [dotIndex, setDotIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setDotIndex((prev) => (prev + 1) % 3)
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Logo and Title */}
      <div className="flex items-center gap-4 mb-12">
        <img 
          src="/images/wingman-logo.png" 
          alt="Wingman Logo" 
          className="w-20 h-20 animate-pulse"
        />
        <span className="text-5xl font-bold text-gray-900">Wingman</span>
      </div>

      {/* Loading Message */}
      <div className="text-center">
        <div className="text-xl font-semibold text-gray-700 mb-4">{message}</div>
        <div className="flex items-center justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-3 h-3 bg-blue-500 rounded-full transition-all duration-300 ${
                dotIndex === i ? 'scale-125 bg-blue-600' : 'scale-100'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
