import { useState } from 'react'

function App() {
  const [selectedAnchor, setSelectedAnchor] = useState(null)

  return (
    <div
      id="room-viewport"
      className="flex items-center justify-center w-screen h-screen bg-gray-50"
    >
      <div className="relative w-full max-w-5xl aspect-video overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: '#fbe6df',
            clipPath: 'polygon(20% 20%, 80% 20%, 80% 75%, 20% 75%)',
          }}
        />

        <div
          className="absolute inset-0"
          style={{
            backgroundColor: '#f3d5cb',
            clipPath: 'polygon(0% 0%, 20% 20%, 20% 75%, 0% 100%)',
          }}
        />

        <div
          className="absolute inset-0"
          style={{
            backgroundColor: '#f3d5cb',
            clipPath: 'polygon(80% 20%, 100% 0%, 100% 100%, 80% 75%)',
          }}
        />

        <div
          className="absolute inset-0"
          style={{
            backgroundColor: '#fbe6df',
            clipPath: 'polygon(0% 0%, 100% 0%, 80% 20%, 20% 20%)',
          }}
        />

        <div
          className="absolute inset-0"
          style={{
            backgroundColor: '#f6d2b5',
            clipPath: 'polygon(20% 75%, 80% 75%, 100% 100%, 0% 100%)',
          }}
        />

        <svg
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: 'none', overflow: 'visible' }}
        >
          <rect x="20%" y="20%" width="60%" height="55%" fill="none" stroke="#dca796" strokeWidth="2" />
          <line x1="0%" y1="0%" x2="20%" y2="20%" stroke="#dca796" strokeWidth="2" />
          <line x1="20%" y1="20%" x2="20%" y2="75%" stroke="#dca796" strokeWidth="2" />
          <line x1="20%" y1="75%" x2="0%" y2="100%" stroke="#dca796" strokeWidth="2" />
          <line x1="0%" y1="0%" x2="0%" y2="100%" stroke="#dca796" strokeWidth="2" />
          <line x1="80%" y1="20%" x2="100%" y2="0%" stroke="#dca796" strokeWidth="2" />
          <line x1="80%" y1="75%" x2="100%" y2="100%" stroke="#dca796" strokeWidth="2" />
          <line x1="100%" y1="0%" x2="100%" y2="100%" stroke="#dca796" strokeWidth="2" />
          <line x1="0%" y1="0%" x2="100%" y2="0%" stroke="#dca796" strokeWidth="2" />
          <line x1="0%" y1="100%" x2="100%" y2="100%" stroke="#dca796" strokeWidth="2" />

          <line x1="20%" y1="47.5%" x2="80%" y2="47.5%" stroke="#dca796" strokeWidth="1" strokeDasharray="4" />
          <line x1="50%" y1="20%" x2="50%" y2="75%" stroke="#dca796" strokeWidth="1" strokeDasharray="4" />
        </svg>

        {[
          { id: 'W-Left', top: '33.75%', left: '35%' },
          { id: 'W-Right', top: '33.75%', left: '65%' },
          { id: 'T-Left', top: '61.25%', left: '35%' },
          { id: 'T-Right', top: '61.25%', left: '65%' },
        ].map((anchor) => (
          <button
            key={anchor.id}
            type="button"
            onClick={() => setSelectedAnchor(selectedAnchor === anchor.id ? null : anchor.id)}
            className="absolute flex items-center justify-center transition-all duration-200 z-10"
            style={{
              position: 'absolute',
              top: anchor.top,
              left: anchor.left,
              transform: 'translate(-50%, -50%)',
              width: '28px',
              height: '28px',
              border: selectedAnchor === anchor.id ? '2px solid #dca796' : '1.5px solid #dca796',
              borderRadius: '9999px',
              background: 'transparent',
              color: selectedAnchor === anchor.id ? '#dca796' : '#b5887a',
              fontSize: '16px',
              fontWeight: selectedAnchor === anchor.id ? '700' : '400',
              boxShadow: selectedAnchor === anchor.id ? '0 0 6px rgba(220, 167, 150, 0.45)' : 'none',
              cursor: 'pointer',
              padding: 0,
            }}
            title={`Select ${anchor.id}`}
          >
            +
          </button>
        ))}
      </div>
    </div>
  )
}

export default App
