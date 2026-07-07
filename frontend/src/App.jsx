import { useRef, useState, useCallback } from 'react'

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

  // --- Phase 3: Lamp Persistent Global State ---
  // Saved (committed) lamp position index and on/off state that persists across zoom sessions
  const [savedLampPosition, setSavedLampPosition] = useState(2)
  const [savedIsLampOn, setSavedIsLampOn] = useState(false)

  // --- Phase 3: Lamp Session State (active only inside zoom overlay) ---
  // Local working copies initialized from saved state when zoom opens
  const [lampPosition, setLampPosition] = useState(2)
  const [isLampOn, setIsLampOn] = useState(false)

  // Lamp drag tracking inside the zoom overlay
  const [isLampDragging, setIsLampDragging] = useState(false)
  const lampHasDraggedRef = useRef(false)
  const lampDragStartRef = useRef({ x: 0, y: 0 })
  const lampDragCurrentRef = useRef({ x: 0, y: 0 })
  const [lampDragOffset, setLampDragOffset] = useState({ x: 0, y: 0 })
  const zoomSvgRef = useRef(null)

  // ── Normalized Snap Grid ──────────────────────────────────────────────────
  // Each snap point is defined as (xFrac, yFrac) where:
  //   xFrac  0.0 = left edge of tabletop,  1.0 = right edge
  //   yFrac  0.0 = back (top) edge,         1.0 = front (bottom) edge
  // These fractions are then mapped to pixel coords in BOTH SVG viewBoxes
  // using the exact trapezoid geometry of each view, keeping positions in sync.
  const SNAP_GRID = [
    { id: 'TL', xFrac: 0.10, yFrac: 0.20 }, // Top-Left
    { id: 'TC', xFrac: 0.50, yFrac: 0.20 }, // Top-Center
    { id: 'TR', xFrac: 0.90, yFrac: 0.20 }, // Top-Right
    { id: 'BL', xFrac: 0.10, yFrac: 0.75 }, // Bottom-Left
    { id: 'BC', xFrac: 0.50, yFrac: 0.75 }, // Bottom-Center
    { id: 'BR', xFrac: 0.90, yFrac: 0.75 }, // Bottom-Right
  ]

  // Helper: interpolate a point on a trapezoidal tabletop surface.
  // trapGeom = { tlX, tlY, trX, trY, blX, blY, brX, brY }
  const trapPoint = (trapGeom, xFrac, yFrac) => {
    const { tlX, tlY, trX, trY, blX, blY, brX, brY } = trapGeom
    const leftX  = tlX + yFrac * (blX - tlX)
    const rightX = trX + yFrac * (brX - trX)
    const y      = tlY + yFrac * (blY - tlY)
    return { x: leftX + xFrac * (rightX - leftX), y }
  }

  // ── Zoom SVG geometry  (viewBox 600×400) ─────────────────────────────────
  // Tabletop polygon: top edge (40,130)→(560,130), bottom edge (10,290)→(590,290)
  const ZOOM_TRAP = { tlX: 40, tlY: 130, trX: 560, trY: 130, blX: 10, blY: 290, brX: 590, brY: 290 }

  // ── Mini-room desk SVG geometry  (viewBox 200×140) ───────────────────────
  // Tabletop polygon: top edge (20,40)→(180,40), bottom edge (10,55)→(190,55)
  const MINI_TRAP = { tlX: 20, tlY: 40, trX: 180, trY: 40, blX: 10, blY: 55, brX: 190, brY: 55 }

  // Derived pixel-coordinate arrays used by the renderers
  const closeUpSnapPoints = SNAP_GRID.map((sp) => ({
    id: `CU-${sp.id}`,
    ...trapPoint(ZOOM_TRAP, sp.xFrac, sp.yFrac),
  }))
  const miniSnapPoints = SNAP_GRID.map((sp) => ({
    id: `M-${sp.id}`,
    ...trapPoint(MINI_TRAP, sp.xFrac, sp.yFrac),
  }))

  // Predefined coordinates for desk snap points in room percentages
  const snapPoints = [
    { id: 'T-Left', top: 61.25, left: 35 },
    { id: 'T-Right', top: 61.25, left: 65 },
  ]

  // --- Zoom Open Handler: Initialize lamp session from saved state ---
  const openZoom = useCallback(() => {
    setLampPosition(savedLampPosition)
    setIsLampOn(savedIsLampOn)
    setIsLampDragging(false)
    lampHasDraggedRef.current = false
    setLampDragOffset({ x: 0, y: 0 })
    setIsDeskZoomed(true)
  }, [savedLampPosition, savedIsLampOn])

  // --- Zoom Save Handler: Commit session state to saved globals ---
  const handleZoomSave = useCallback(() => {
    setSavedLampPosition(lampPosition)
    setSavedIsLampOn(isLampOn)
    setIsDeskZoomed(false)
  }, [lampPosition, isLampOn])

  // --- Zoom Cancel Handler: Discard session changes, revert to saved ---
  const handleZoomCancel = useCallback(() => {
    setIsDeskZoomed(false)
  }, [])

  // --- Lamp Drag Handlers inside the Zoom SVG ---
  const svgPointFromEvent = useCallback((event) => {
    const svg = zoomSvgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = event.clientX
    pt.y = event.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return { x: 0, y: 0 }
    const svgPt = pt.matrixTransform(ctm.inverse())
    return { x: svgPt.x, y: svgPt.y }
  }, [])

  const handleLampPointerDown = useCallback((event) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsLampDragging(true)
    lampHasDraggedRef.current = false
    const svgPt = svgPointFromEvent(event)
    lampDragStartRef.current = svgPt
    lampDragCurrentRef.current = svgPt
    setLampDragOffset({ x: 0, y: 0 })
  }, [svgPointFromEvent])

  const handleLampPointerMove = useCallback((event) => {
    if (!isLampDragging) return
    event.preventDefault()
    event.stopPropagation()
    lampHasDraggedRef.current = true
    const svgPt = svgPointFromEvent(event)
    lampDragCurrentRef.current = svgPt
    setLampDragOffset({
      x: svgPt.x - lampDragStartRef.current.x,
      y: svgPt.y - lampDragStartRef.current.y,
    })
  }, [isLampDragging, svgPointFromEvent])

  const handleLampPointerUp = useCallback((event) => {
    if (!isLampDragging) return
    event.preventDefault()
    event.stopPropagation()

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (lampHasDraggedRef.current) {
      // Find nearest snap point to where the lamp was dropped
      const currentSnap = closeUpSnapPoints[lampPosition]
      const dropX = currentSnap.x + lampDragOffset.x
      const dropY = currentSnap.y + lampDragOffset.y

      let nearestIdx = 0
      let shortestDist = Number.POSITIVE_INFINITY
      closeUpSnapPoints.forEach((pt, idx) => {
        const dist = Math.sqrt((dropX - pt.x) ** 2 + (dropY - pt.y) ** 2)
        if (dist < shortestDist) {
          shortestDist = dist
          nearestIdx = idx
        }
      })
      setLampPosition(nearestIdx)
    } else {
      // Pure click with no drag: toggle lamp on/off
      setIsLampOn((prev) => !prev)
    }

    setIsLampDragging(false)
    lampHasDraggedRef.current = false
    setLampDragOffset({ x: 0, y: 0 })
  }, [isLampDragging, lampPosition, lampDragOffset, closeUpSnapPoints])

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

  // Compute the active lamp snap point coordinates for rendering
  const activeLampSnap = closeUpSnapPoints[lampPosition]
  const savedLampSnap = closeUpSnapPoints[savedLampPosition]

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
              openZoom()
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

            {/* --- Phase 3: Mini Lamp on Main Room Tabletop (non-interactive) --- */}
            {(() => {
              // Derived from the same normalized SNAP_GRID → MINI_TRAP mapping,
              // guaranteeing pixel-perfect proportional alignment with the zoom view.
              const mp = miniSnapPoints[savedLampPosition]
              const mx = mp.x
              const my = mp.y
              return (
                <g style={{ pointerEvents: 'none' }}>
                  {/* Mini warm glow cone when lamp is on (drawn behind lamp body) */}
                  {savedIsLampOn && (
                    <g>
                      <ellipse cx={mx + 7} cy={my - 5} rx="12" ry="6" fill="rgba(255, 220, 100, 0.30)" />
                    </g>
                  )}
                  {/* Mini base shadow */}
                  <ellipse cx={mx} cy={my + 0.3} rx="8" ry="0.4" fill="rgba(0, 0, 0, 0.15)" />
                  {/* Mini circular base */}
                  <ellipse cx={mx} cy={my} rx="8" ry="0.4" fill="#F5F2E9" stroke="#5c4b3f" strokeWidth="1.1" />
                  {/* Mini vertical stem outline & fill */}
                  <line x1={mx} y1={my} x2={mx} y2={my - 18} stroke="#5c4b3f" strokeWidth="2.6" strokeLinecap="round" />
                  <line x1={mx} y1={my} x2={mx} y2={my - 18} stroke="#D2C4B4" strokeWidth="1.4" strokeLinecap="round" />
                  {/* Mini joint circle */}
                  <circle cx={mx} cy={my - 18} r="2.0" fill="#D2C4B4" stroke="#5c4b3f" strokeWidth="0.8" />
                  {/* Mini horizontal LED bar outline & fill */}
                  <line x1={mx - 8} y1={my - 17.2} x2={mx + 24} y2={my - 20.8} stroke="#5c4b3f" strokeWidth="2.6" strokeLinecap="round" />
                  <line x1={mx - 8} y1={my - 17.2} x2={mx + 24} y2={my - 20.8} stroke="#D2C4B4" strokeWidth="1.4" strokeLinecap="round" />
                  {/* Mini LED light strip */}
                  <line x1={mx + 1} y1={my - 17.8} x2={mx + 22} y2={my - 20.3} stroke={savedIsLampOn ? '#ffdc78' : '#e3d5ca'} strokeWidth="1.0" strokeLinecap="round" />
                </g>
              )
            })()}

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
          {/* Close Button to return to main room view (discards changes) */}
          <button 
            onClick={handleZoomCancel} 
            className="absolute top-6 right-6 text-5xl font-light text-white/80 hover:text-white hover:scale-110 transition-all cursor-pointer bg-transparent border-none outline-none select-none"
            aria-label="Close zoom view"
          >
            &times;
          </button>
          
          <div className="flex flex-col items-end gap-6">
            {/* Hand-Drawn / Classic Oval Tabletop Container */}
            <div 
              className="w-[90vw] max-w-[900px] max-h-[85vh] aspect-[3/2] bg-[#f4ebd0] rounded-full border-4 border-[#5c4b3f] relative shadow-2xl overflow-hidden"
            >
              <svg
                ref={zoomSvgRef}
                viewBox="0 0 600 400"
                width="100%"
                height="100%"
                style={{ overflow: 'visible' }}
              >
                <defs>
                  <filter id="lamp-glow-blur" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="12" />
                  </filter>
                </defs>

                {/* Tabletop Surface (A large detailed perspective trapezoid matching the shallow room angle) */}
                <polygon 
                  points="40,130 560,130 590,290 10,290" 
                  fill="#fdfbf7" 
                  stroke="#5c4b3f" 
                  strokeWidth="4" 
                  strokeLinejoin="round" 
                />

                {/* Tabletop Front Edge (Thickness) */}
                <polygon 
                  points="10,290 590,290 590,312 10,312" 
                  fill="#f3e8e0" 
                  stroke="#5c4b3f" 
                  strokeWidth="4" 
                  strokeLinejoin="round" 
                />
                {/* Highlight line just under the lip */}
                <line x1="12" y1="292" x2="588" y2="292" stroke="#ffffff" strokeWidth="2" />

                {/* // Future close-up tabletop assets and interior snap targets go here */}

                {/* --- Phase 3: Lamp warm light cone (rendered behind snap points, in front of desk) --- */}
                {isLampOn && (() => {
                  const lx = activeLampSnap.x + (isLampDragging ? lampDragOffset.x : 0)
                  const ly = activeLampSnap.y + (isLampDragging ? lampDragOffset.y : 0)
                  const drawY = ly + 20 // Shift all drawing Y coordinates down by +20px to anchor base squarely over crosshairs
                  // Light source: bottom of the LED bar running from lx+10 to lx+140 (offset Y by 20px down)
                  const coneX1 = lx + 10
                  const coneY1 = drawY - 119
                  const coneX2 = lx + 140
                  const coneY2 = drawY - 139
                  return (
                    <g style={{ pointerEvents: 'none' }}>
                      {/* Wide warm translucent light cone fanning downward from LED bar underside */}
                      <polygon
                        points={`${coneX1},${coneY1} ${coneX2},${coneY2} ${lx + 260},${drawY + 40} ${lx - 100},${drawY + 40}`}
                        fill="rgba(255, 220, 120, 0.12)"
                        filter="url(#lamp-glow-blur)"
                      />
                      {/* Inner bright core cone for depth */}
                      <polygon
                        points={`${lx + 25},${drawY - 121} ${lx + 125},${drawY - 137} ${lx + 190},${drawY + 10} ${lx - 30},${drawY + 10}`}
                        fill="rgba(255, 230, 140, 0.14)"
                        filter="url(#lamp-glow-blur)"
                      />
                      {/* Soft warm glow pool on the desk surface */}
                      <ellipse
                        cx={lx + 80}
                        cy={drawY + 30}
                        rx="180"
                        ry="25"
                        fill="rgba(255, 210, 100, 0.18)"
                        filter="url(#lamp-glow-blur)"
                      />
                    </g>
                  )
                })()}

                {/* Structured Grid of 6 Snap Points (Top row of 3, Bottom row of 3) */}
                {closeUpSnapPoints.map((pt) => (
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

                {/* --- Phase 3: Draggable Lamp Asset on the Close-up Tabletop --- */}
                {(() => {
                  const lx = activeLampSnap.x + (isLampDragging ? lampDragOffset.x : 0)
                  const ly = activeLampSnap.y + (isLampDragging ? lampDragOffset.y : 0)
                  const drawY = ly + 20 // Shift all drawing Y coordinates down slightly to ground base over crosshair targets

                  return (
                    <g
                      onPointerDown={handleLampPointerDown}
                      onPointerMove={handleLampPointerMove}
                      onPointerUp={handleLampPointerUp}
                      onPointerCancel={handleLampPointerUp}
                      style={{
                        cursor: isLampDragging ? 'grabbing' : 'grab',
                        touchAction: 'none',
                      }}
                    >
                      {/* ── BASE SHADOW (grounding base, sits under base) ── */}
                      <ellipse cx={lx} cy={drawY + 4} rx="48" ry="10" fill="rgba(0, 0, 0, 0.15)" />

                      {/* ── SOLID 2D CYLINDER BASE ── */}
                      {/* Bottom outline ellipse */}
                      <ellipse
                        cx={lx}
                        cy={drawY}
                        rx="48"
                        ry="10"
                        fill="#F5F2E9"
                        stroke="#5c4b3f"
                        strokeWidth="3"
                      />
                      {/* Vertical thickness connector block */}
                      <rect
                        x={lx - 48}
                        y={drawY - 12}
                        width="96"
                        height="12"
                        fill="#F5F2E9"
                      />
                      {/* Left and right vertical outline steps */}
                      <line
                        x1={lx - 48} y1={drawY - 12}
                        x2={lx - 48} y2={drawY}
                        stroke="#5c4b3f"
                        strokeWidth="3"
                      />
                      <line
                        x1={lx + 48} y1={drawY - 12}
                        x2={lx + 48} y2={drawY}
                        stroke="#5c4b3f"
                        strokeWidth="3"
                      />
                      {/* Top outline ellipse */}
                      <ellipse
                        cx={lx}
                        cy={drawY - 12}
                        rx="48"
                        ry="10"
                        fill="#F5F2E9"
                        stroke="#5c4b3f"
                        strokeWidth="3"
                      />

                      {/* ── SLEEK VERTICAL STEM ── */}
                      {/* Stem background outline */}
                      <line
                        x1={lx} y1={drawY - 12}
                        x2={lx} y2={drawY - 120}
                        stroke="#5c4b3f"
                        strokeWidth="18"
                        strokeLinecap="round"
                      />
                      {/* Stem flat body fill */}
                      <line
                        x1={lx} y1={drawY - 12}
                        x2={lx} y2={drawY - 120}
                        stroke="#D2C4B4"
                        strokeWidth="12"
                        strokeLinecap="round"
                      />

                      {/* ── MINIMAL LINEAR JOINT at top of stem ── */}
                      <circle cx={lx} cy={drawY - 120} r="10" fill="#D2C4B4" stroke="#5c4b3f" strokeWidth="3" />
                      <circle cx={lx} cy={drawY - 120} r="4" fill="#5c4b3f" />

                      {/* ── LONG SLEEK HORIZONTAL LED BAR ARM ── */}
                      {/* LED bar background outline */}
                      <line
                        x1={lx - 40} y1={drawY - 114}
                        x2={lx + 150} y2={drawY - 144}
                        stroke="#5c4b3f"
                        strokeWidth="18"
                        strokeLinecap="round"
                      />
                      {/* LED bar flat body fill */}
                      <line
                        x1={lx - 40} y1={drawY - 114}
                        x2={lx + 150} y2={drawY - 144}
                        stroke="#D2C4B4"
                        strokeWidth="12"
                        strokeLinecap="round"
                      />

                      {/* ── LED LIGHT STRIP (underside) ── */}
                      <line
                        x1={lx + 10} y1={drawY - 119}
                        x2={lx + 140} y2={drawY - 139}
                        stroke={isLampOn ? '#ffdc78' : '#e3d5ca'}
                        strokeWidth="4"
                        strokeLinecap="round"
                      />
                    </g>
                  )
                })()}
              </svg>
            </div>

            {/* Action Buttons floating at the bottom right beneath the oval ring layout */}
            <div className="flex gap-4">
              <button 
                onClick={handleZoomCancel}
                className="px-6 py-2 bg-[#fdfbf7] border-2 border-[#5c4b3f] text-[#5c4b3f] font-medium rounded-[12px_8px_12px_10px] shadow-[3px_3px_0px_#5c4b3f] hover:shadow-[1px_1px_0px_#5c4b3f] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[3px] active:translate-y-[3px] transition-all cursor-pointer font-mono text-sm"
              >
                Cancel
              </button>
              <button 
                onClick={handleZoomSave}
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
