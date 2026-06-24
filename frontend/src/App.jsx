import { useRef, useState } from 'react'

function App() {
  // State to track currently selected room layout anchor point
  const [selectedAnchor, setSelectedAnchor] = useState(null)
  
  // State to track active coordinate position of the desk asset
  const [tablePosition, setTablePosition] = useState({ top: '61.25%', left: '35%' })
  
  // State to track if user is currently dragging the desk
  const [isDragging, setIsDragging] = useState(false)
  
  // State to hold pointer offset relative to desk anchor center during dragging
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  
  // Ref referencing the main parent room viewport container element
  const roomRef = useRef(null)

  // State to track if the close-up tabletop zoom interface overlay is active
  const [isDeskZoomed, setIsDeskZoomed] = useState(false)

  // Ref to track if the desk was actively dragged during pointer interaction
  const hasDraggedRef = useRef(false)

  // Predefined coordinates for desk snap points in room percentages
  const snapPoints = [
    { id: 'T-Left', top: 61.25, left: 35 },
    { id: 'T-Right', top: 61.25, left: 65 },
  ]

  // Event handler for initiating desk drag
  const handlePointerDown = (event) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
    hasDraggedRef.current = false // Reset drag flag on down

    const roomRect = roomRef.current?.getBoundingClientRect()
    if (!roomRect) return

    const currentLeftPx = (parseFloat(tablePosition.left) / 100) * roomRect.width + roomRect.left
    const currentTopPx = (parseFloat(tablePosition.top) / 100) * roomRect.height + roomRect.top

    setDragOffset({
      x: event.clientX - currentLeftPx,
      y: event.clientY - currentTopPx,
    })
  }

  // Event handler for updating desk position during drag
  const handlePointerMove = (event) => {
    if (!isDragging) return
    hasDraggedRef.current = true // Set drag flag on move

    const roomRect = roomRef.current?.getBoundingClientRect()
    if (!roomRect) return

    const targetLeftPx = event.clientX - dragOffset.x
    const targetTopPx = event.clientY - dragOffset.y

    const nextLeft = ((targetLeftPx - roomRect.left) / roomRect.width) * 100
    const nextTop = ((targetTopPx - roomRect.top) / roomRect.height) * 100

    setTablePosition({
      top: `${Math.max(0, Math.min(100, nextTop))}%`,
      left: `${Math.max(0, Math.min(100, nextLeft))}%`,
    })
  }

  // Event handler for ending desk drag and snapping to nearest target
  const handlePointerUp = (event) => {
    if (!isDragging) return

    const currentLeft = parseFloat(tablePosition.left)
    const currentTop = parseFloat(tablePosition.top)

    let nearest = snapPoints[0]
    let shortestDistance = Number.POSITIVE_INFINITY

    snapPoints.forEach((point) => {
      const distance = Math.sqrt((currentLeft - point.left) ** 2 + (currentTop - point.top) ** 2)

      if (distance < shortestDistance) {
        shortestDistance = distance
        nearest = point
      }
    })

    setTablePosition({ top: `${nearest.top}%`, left: `${nearest.left}%` })
    setIsDragging(false)

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div
      id="room-viewport"
      className="flex items-center justify-center w-screen h-screen bg-gray-50"
    >
      <div ref={roomRef} className="relative w-full max-w-5xl aspect-video overflow-hidden">
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

        <div
          className="table-asset"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={() => {
            if (!hasDraggedRef.current) {
              setIsDeskZoomed(true)
            }
          }}
          style={{
            position: 'absolute',
            top: tablePosition.top,
            left: tablePosition.left,
            width: '28%',
            height: '36%',
            transform: 'translate(-50%, -45%)',
            transformOrigin: 'bottom center',
            zIndex: 20,
            touchAction: 'none',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
        >
          <svg
            viewBox="0 0 200 140"
            width="100%"
            height="100%"
            style={{ overflow: 'visible' }}
          >
            <defs>
              <filter id="desk-shadow-blur" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="5" />
              </filter>
            </defs>

            {/* Faint, very soft ambient footprint shadow under the desk */}
            <polygon 
              points="25,122 175,122 185,138 15,138" 
              fill="rgba(0, 0, 0, 0.04)" 
              filter="url(#desk-shadow-blur)" 
            />

            {/* Back Legs (Drawn first, placed slightly inward) */}
            <line x1="25" y1="43" x2="25" y2="122" stroke="#5c4b3f" strokeWidth="3" strokeLinecap="round" />
            <line x1="25" y1="43" x2="25" y2="122" stroke="#e3d5ca" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="175" y1="43" x2="175" y2="122" stroke="#5c4b3f" strokeWidth="3" strokeLinecap="round" />
            <line x1="175" y1="43" x2="175" y2="122" stroke="#e3d5ca" strokeWidth="1.5" strokeLinecap="round" />

            {/* Tabletop Surface (A very subtle, gentle trapezoid matching the shallow room angle) */}
            <polygon points="20,40 180,40 190,55 10,55" fill="#fdfbf7" stroke="#5c4b3f" strokeWidth="1.5" strokeLinejoin="round" />

            {/* Tabletop Front Edge (Thickness) */}
            <polygon points="10,55 190,55 190,62 10,62" fill="#f3e8e0" stroke="#5c4b3f" strokeWidth="1.5" strokeLinejoin="round" />
            <line x1="11" y1="56" x2="189" y2="56" stroke="#ffffff" strokeWidth="1" />

            {/* Front Legs (Drawn last to sit in front of the desk edge) */}
            <line x1="15" y1="62" x2="15" y2="140" stroke="#5c4b3f" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="15" y1="62" x2="15" y2="140" stroke="#e3d5ca" strokeWidth="1.8" strokeLinecap="round" />
            <line x1="185" y1="62" x2="185" y2="140" stroke="#5c4b3f" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="185" y1="62" x2="185" y2="140" stroke="#e3d5ca" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>

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
      {/* 2.5D Close-up Tabletop Zoom Overlay */}
      {isDeskZoomed && (
        <div className="fixed inset-0 backdrop-blur-md bg-black/30 flex flex-col items-center justify-center z-50 gap-6">
          {/* Close Button to return to main room view */}
          <button 
            onClick={() => setIsDeskZoomed(false)} 
            className="absolute top-6 right-6 text-5xl font-light text-white/80 hover:text-white hover:scale-110 transition-all cursor-pointer bg-transparent border-none outline-none select-none"
            aria-label="Close zoom view"
          >
            &times;
          </button>
          
          <div className="flex flex-col items-end gap-6">
            {/* Hand-Drawn / Classic Oval Tabletop Container */}
            <div 
              className="w-[600px] h-[400px] bg-[#f4ebd0] rounded-full border-4 border-[#5c4b3f] relative shadow-2xl overflow-hidden"
            >
              <svg
                viewBox="0 0 600 400"
                width="100%"
                height="100%"
                style={{ overflow: 'visible' }}
              >
                {/* Tabletop Surface (A large detailed perspective trapezoid matching the shallow room angle) */}
                <polygon 
                  points="60,60 540,60 590,300 10,300" 
                  fill="#fdfbf7" 
                  stroke="#5c4b3f" 
                  strokeWidth="4" 
                  strokeLinejoin="round" 
                />

                {/* Tabletop Front Edge (Thickness) */}
                <polygon 
                  points="10,300 590,300 590,325 10,325" 
                  fill="#f3e8e0" 
                  stroke="#5c4b3f" 
                  strokeWidth="4" 
                  strokeLinejoin="round" 
                />
                {/* Highlight line just under the lip */}
                <line x1="12" y1="302" x2="588" y2="302" stroke="#ffffff" strokeWidth="2" />

                {/* // Future close-up tabletop assets and interior snap targets go here */}

                {/* Structured Grid of 6 Snap Points (Top row of 3, Bottom row of 3) */}
                {[
                  { id: 'CU-TopLeft', x: 150, y: 130, label: 'Top Left' },
                  { id: 'CU-TopCenter', x: 300, y: 130, label: 'Top Center' },
                  { id: 'CU-TopRight', x: 450, y: 130, label: 'Top Right' },
                  { id: 'CU-BottomLeft', x: 130, y: 240, label: 'Bottom Left' },
                  { id: 'CU-BottomCenter', x: 300, y: 240, label: 'Bottom Center' },
                  { id: 'CU-BottomRight', x: 470, y: 240, label: 'Bottom Right' },
                ].map((pt) => (
                  <g key={pt.id} className="group cursor-pointer select-none">
                    {/* Hover highlight circle */}
                    <circle 
                      cx={pt.x} 
                      cy={pt.y} 
                      r="20" 
                      fill="rgba(92, 75, 63, 0.05)" 
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200" 
                    />
                    {/* Grid crosshairs */}
                    <line 
                      x1={pt.x - 24} 
                      y1={pt.y} 
                      x2={pt.x + 24} 
                      y2={pt.y} 
                      stroke="#5c4b3f" 
                      strokeWidth="1.5" 
                      strokeDasharray="3 3" 
                      className="opacity-50 group-hover:opacity-85 transition-opacity" 
                    />
                    <line 
                      x1={pt.x} 
                      y1={pt.y - 24} 
                      x2={pt.x} 
                      y2={pt.y + 24} 
                      stroke="#5c4b3f" 
                      strokeWidth="1.5" 
                      strokeDasharray="3 3" 
                      className="opacity-50 group-hover:opacity-85 transition-opacity" 
                    />
                    {/* Target outer dashed circle */}
                    <circle 
                      cx={pt.x} 
                      cy={pt.y} 
                      r="14" 
                      fill="none" 
                      stroke="#5c4b3f" 
                      strokeWidth="1.5" 
                      strokeDasharray="4 2" 
                      className="opacity-60 group-hover:opacity-100 group-hover:scale-110 origin-center transition-all duration-200" 
                      style={{ transformOrigin: `${pt.x}px ${pt.y}px` }}
                    />
                    {/* Center plus marker */}
                    <path 
                      d={`M ${pt.x - 5} ${pt.y} L ${pt.x + 5} ${pt.y} M ${pt.x} ${pt.y - 5} L ${pt.x} ${pt.y + 5}`} 
                      stroke="#5c4b3f" 
                      strokeWidth="2" 
                      className="opacity-80 group-hover:opacity-100 transition-opacity" 
                    />
                  </g>
                ))}
              </svg>
            </div>

            {/* Action Buttons floating at the bottom right beneath the oval ring layout */}
            <div className="flex gap-4">
              <button 
                onClick={() => setIsDeskZoomed(false)}
                className="px-6 py-2 bg-[#fdfbf7] border-2 border-[#5c4b3f] text-[#5c4b3f] font-medium rounded-[12px_8px_12px_10px] shadow-[3px_3px_0px_#5c4b3f] hover:shadow-[1px_1px_0px_#5c4b3f] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[3px] active:translate-y-[3px] transition-all cursor-pointer font-mono text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  // Save close-up table state or close the view
                  setIsDeskZoomed(false)
                }}
                className="px-6 py-2 bg-[#f3e8e0] border-2 border-[#5c4b3f] text-[#5c4b3f] font-semibold rounded-[8px_12px_10px_12px] shadow-[3px_3px_0px_#5c4b3f] hover:shadow-[1px_1px_0px_#5c4b3f] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[3px] active:translate-y-[3px] transition-all cursor-pointer font-mono text-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
