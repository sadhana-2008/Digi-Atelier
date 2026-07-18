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

  // --- Phase 4: Book Persistent Global State ---
  // savedBookPosition defaults to index 4 (BC – bottom-center), away from lamp default (2=TR)
  const [savedBookPosition, setSavedBookPosition] = useState(4)
  const [savedBookText, setSavedBookText] = useState('')

  // --- Phase 4: Book Session State (active only inside zoom overlay) ---
  const [bookPosition, setBookPosition] = useState(4)
  const [isBookDragging, setIsBookDragging] = useState(false)
  const bookHasDraggedRef = useRef(false)
  const bookDragStartRef = useRef({ x: 0, y: 0 })
  const [bookDragOffset, setBookDragOffset] = useState({ x: 0, y: 0 })

  // --- Phase 4: Note Modal State ---
  const [isBookModalOpen, setIsBookModalOpen] = useState(false)
  const [currentBookText, setCurrentBookText] = useState('')

  // --- Phase 6: Plant Persistent Global State ---
  // Default to index 0 (TL - top-left), distinct from lamp (2) and book (4)
  const [savedPlantPosition, setSavedPlantPosition] = useState(0)

  // --- Phase 6: Plant Session State (active only inside zoom overlay) ---
  const [plantPosition, setPlantPosition] = useState(0)
  const [isPlantDragging, setIsPlantDragging] = useState(false)
  const plantHasDraggedRef = useRef(false)
  const plantDragStartRef = useRef({ x: 0, y: 0 })
  const [plantDragOffset, setPlantDragOffset] = useState({ x: 0, y: 0 })

  // --- Occupancy Registry ---
  const occupiedSlotsRef = useRef({
    2: 'lamp',
    4: 'book',
    0: 'plant',
  })

  // --- Phase 3: Day/Night Sync State ---
  const [isNightMode, setIsNightMode] = useState(false)

  // --- Phase 5: Window Persistent Global State ---
  // Default to wall snap index 0 (W-Left)
  const [savedWindowPosition, setSavedWindowPosition] = useState(0)

  // --- Phase 5: Window Drag State (operates on room viewport, not zoom SVG) ---
  const [isDraggingWindow, setIsDraggingWindow] = useState(false)
  const windowHasDraggedRef = useRef(false)
  const windowDragStartRef = useRef({ x: 0, y: 0 })
  const [windowDragDelta, setWindowDragDelta] = useState({ x: 0, y: 0 })

  // Wall snap points — percentage-based positions on the back wall
  const WALL_SNAPS = [
    { id: 'W-Left',  top: 33.75, left: 35 },
    { id: 'W-Right', top: 33.75, left: 65 },
  ]

  // --- Phase 5: Window theme variables (swap later for day/night) ---
  const windowSkyColor   = isNightMode ? '#1A1A2E' : '#D3E3FD'  // indigo or morning blue
  const windowCloudColor = '#F5F2E9'  // warm cream
  const windowSunColor   = 'rgba(255,220,120,0.35)'

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

  // --- Zoom Open Handler: Initialize lamp + book + plant session from saved state ---
  const openZoom = useCallback(() => {
    setLampPosition(savedLampPosition)
    setIsLampOn(savedIsLampOn)
    setIsLampDragging(false)
    lampHasDraggedRef.current = false
    setLampDragOffset({ x: 0, y: 0 })
    // Book session init
    setBookPosition(savedBookPosition)
    setIsBookDragging(false)
    bookHasDraggedRef.current = false
    setBookDragOffset({ x: 0, y: 0 })
    // Plant session init
    setPlantPosition(savedPlantPosition)
    setIsPlantDragging(false)
    plantHasDraggedRef.current = false
    setPlantDragOffset({ x: 0, y: 0 })
    // Sync registry
    occupiedSlotsRef.current = {
      [savedLampPosition]: 'lamp',
      [savedBookPosition]: 'book',
      [savedPlantPosition]: 'plant',
    }
    setIsDeskZoomed(true)
  }, [savedLampPosition, savedIsLampOn, savedBookPosition, savedPlantPosition])

  // --- Zoom Save Handler: Commit lamp + book + plant session state to saved globals ---
  const handleZoomSave = useCallback(() => {
    setSavedLampPosition(lampPosition)
    setSavedIsLampOn(isLampOn)
    setSavedBookPosition(bookPosition)
    setSavedPlantPosition(plantPosition)
    setIsDeskZoomed(false)
  }, [lampPosition, isLampOn, bookPosition, plantPosition])

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
      const slotOwner = occupiedSlotsRef.current[nearestIdx]
      if (slotOwner == null || slotOwner === 'lamp') {
        if (lampPosition !== nearestIdx) {
          occupiedSlotsRef.current[lampPosition] = null
          occupiedSlotsRef.current[nearestIdx] = 'lamp'
        }
        setLampPosition(nearestIdx)
      }
    } else {
      // Pure click with no drag: toggle lamp on/off
      setIsLampOn((prev) => !prev)
    }

    setIsLampDragging(false)
    lampHasDraggedRef.current = false
    setLampDragOffset({ x: 0, y: 0 })
  }, [isLampDragging, lampPosition, lampDragOffset, closeUpSnapPoints])

  // --- Phase 4: Book Drag Handlers inside the Zoom SVG ---
  const handleBookPointerDown = useCallback((event) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsBookDragging(true)
    bookHasDraggedRef.current = false
    const svgPt = svgPointFromEvent(event)
    bookDragStartRef.current = svgPt
    setBookDragOffset({ x: 0, y: 0 })
  }, [svgPointFromEvent])

  const handleBookPointerMove = useCallback((event) => {
    if (!isBookDragging) return
    event.preventDefault()
    event.stopPropagation()
    bookHasDraggedRef.current = true
    const svgPt = svgPointFromEvent(event)
    setBookDragOffset({
      x: svgPt.x - bookDragStartRef.current.x,
      y: svgPt.y - bookDragStartRef.current.y,
    })
  }, [isBookDragging, svgPointFromEvent])

  const handleBookPointerUp = useCallback((event) => {
    if (!isBookDragging) return
    event.preventDefault()
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (bookHasDraggedRef.current) {
      // Find nearest snap point to drop position
      const currentSnap = closeUpSnapPoints[bookPosition]
      const dropX = currentSnap.x + bookDragOffset.x
      const dropY = currentSnap.y + bookDragOffset.y
      let nearestIdx = 0
      let shortestDist = Number.POSITIVE_INFINITY
      closeUpSnapPoints.forEach((pt, idx) => {
        const dist = Math.sqrt((dropX - pt.x) ** 2 + (dropY - pt.y) ** 2)
        if (dist < shortestDist) { shortestDist = dist; nearestIdx = idx }
      })
      const slotOwner = occupiedSlotsRef.current[nearestIdx]
      if (slotOwner == null || slotOwner === 'book') {
        if (bookPosition !== nearestIdx) {
          occupiedSlotsRef.current[bookPosition] = null
          occupiedSlotsRef.current[nearestIdx] = 'book'
        }
        setBookPosition(nearestIdx)
      }
    } else {
      // Pure click: open note modal
      setCurrentBookText(savedBookText)
      setIsBookModalOpen(true)
    }
    setIsBookDragging(false)
    bookHasDraggedRef.current = false
    setBookDragOffset({ x: 0, y: 0 })
  }, [isBookDragging, bookPosition, bookDragOffset, closeUpSnapPoints, savedBookText])

  // --- Phase 6: Plant Drag Handlers inside the Zoom SVG ---
  const handlePlantPointerDown = useCallback((event) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsPlantDragging(true)
    plantHasDraggedRef.current = false
    const svgPt = svgPointFromEvent(event)
    plantDragStartRef.current = svgPt
    setPlantDragOffset({ x: 0, y: 0 })
  }, [svgPointFromEvent])

  const handlePlantPointerMove = useCallback((event) => {
    if (!isPlantDragging) return
    event.preventDefault()
    event.stopPropagation()
    plantHasDraggedRef.current = true
    const svgPt = svgPointFromEvent(event)
    setPlantDragOffset({
      x: svgPt.x - plantDragStartRef.current.x,
      y: svgPt.y - plantDragStartRef.current.y,
    })
  }, [isPlantDragging, svgPointFromEvent])

  const handlePlantPointerUp = useCallback((event) => {
    if (!isPlantDragging) return
    event.preventDefault()
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (plantHasDraggedRef.current) {
      // Find nearest snap point to drop position
      const currentSnap = closeUpSnapPoints[plantPosition]
      const dropX = currentSnap.x + plantDragOffset.x
      const dropY = currentSnap.y + plantDragOffset.y
      let nearestIdx = 0
      let shortestDist = Number.POSITIVE_INFINITY
      closeUpSnapPoints.forEach((pt, idx) => {
        const dist = Math.sqrt((dropX - pt.x) ** 2 + (dropY - pt.y) ** 2)
        if (dist < shortestDist) { shortestDist = dist; nearestIdx = idx }
      })
      const slotOwner = occupiedSlotsRef.current[nearestIdx]
      if (slotOwner == null || slotOwner === 'plant') {
        if (plantPosition !== nearestIdx) {
          occupiedSlotsRef.current[plantPosition] = null
          occupiedSlotsRef.current[nearestIdx] = 'plant'
        }
        setPlantPosition(nearestIdx)
      }
    }
    setIsPlantDragging(false)
    plantHasDraggedRef.current = false
    setPlantDragOffset({ x: 0, y: 0 })
  }, [isPlantDragging, plantPosition, plantDragOffset, closeUpSnapPoints])

  // --- Phase 5: Window Drag Handlers (operates on room viewport, not zoom SVG) ---
  const handleWindowPointerDown = useCallback((event) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDraggingWindow(true)
    windowHasDraggedRef.current = false
    windowDragStartRef.current = { x: event.clientX, y: event.clientY }
    setWindowDragDelta({ x: 0, y: 0 })
  }, [])

  const handleWindowPointerMove = useCallback((event) => {
    if (!isDraggingWindow) return
    event.preventDefault()
    event.stopPropagation()
    windowHasDraggedRef.current = true
    setWindowDragDelta({
      x: event.clientX - windowDragStartRef.current.x,
      y: event.clientY - windowDragStartRef.current.y,
    })
  }, [isDraggingWindow])

  const handleWindowPointerUp = useCallback((event) => {
    if (!isDraggingWindow) return
    event.preventDefault()
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (windowHasDraggedRef.current) {
      // Convert current rendered position to room percentages and snap
      const roomRect = roomRef.current?.getBoundingClientRect()
      if (roomRect) {
        const currentSnap = WALL_SNAPS[savedWindowPosition]
        const renderedLeftPx = (currentSnap.left / 100) * roomRect.width + windowDragDelta.x
        const renderedLeftPct = (renderedLeftPx / roomRect.width) * 100
        // Find nearest wall snap point by horizontal distance
        let nearestIdx = 0
        let shortestDist = Number.POSITIVE_INFINITY
        WALL_SNAPS.forEach((wp, idx) => {
          const dist = Math.abs(renderedLeftPct - wp.left)
          if (dist < shortestDist) { shortestDist = dist; nearestIdx = idx }
        })
        setSavedWindowPosition(nearestIdx)
      }
    }
    setIsDraggingWindow(false)
    windowHasDraggedRef.current = false
    setWindowDragDelta({ x: 0, y: 0 })
  }, [isDraggingWindow, savedWindowPosition, windowDragDelta, WALL_SNAPS])

  // --- Phase 4: Note Modal Handlers ---
  const handleNoteModalSave = useCallback(() => {
    setSavedBookText(currentBookText)
    setIsBookModalOpen(false)
  }, [currentBookText])

  const handleNoteModalCancel = useCallback(() => {
    setCurrentBookText(savedBookText)
    setIsBookModalOpen(false)
  }, [savedBookText])

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

        {/* --- Phase 5: Draggable Window Asset on the Back Wall --- */}
        <div
          onPointerDown={handleWindowPointerDown}
          onPointerMove={handleWindowPointerMove}
          onPointerUp={handleWindowPointerUp}
          onPointerCancel={handleWindowPointerUp}
          style={{
            position: 'absolute',
            top: `${WALL_SNAPS[savedWindowPosition].top}%`,
            left: `${WALL_SNAPS[savedWindowPosition].left}%`,
            width: '13%',
            aspectRatio: '9 / 10',
            transform: `translate(-50%, -50%) translate(${windowDragDelta.x}px, ${windowDragDelta.y}px)`,
            zIndex: 12,
            touchAction: 'none',
            cursor: isDraggingWindow ? 'grabbing' : 'grab',
            overflow: 'hidden',
          }}
        >
          <svg viewBox="0 0 180 200" width="100%" height="100%">
            {/* ── WINDOW FRAME (outer) ── */}
            <rect x="4" y="4" width="172" height="172" rx="5" fill="#E8D5B5" stroke="#5C4B3F" strokeWidth="5" strokeLinejoin="round" />

            {/* ── SKY PANES (4 quadrants, expanded to fill space freed by slim muntins) ── */}
            <rect x="14" y="12" width="72" height="76" rx="3" fill={windowSkyColor} style={{ transition: 'fill 1.5s ease-in-out' }} />
            <rect x="94" y="12" width="72" height="76" rx="3" fill={windowSkyColor} style={{ transition: 'fill 1.5s ease-in-out' }} />
            <rect x="14" y="96" width="72" height="74" rx="3" fill={windowSkyColor} style={{ transition: 'fill 1.5s ease-in-out' }} />
            <rect x="94" y="96" width="72" height="74" rx="3" fill={windowSkyColor} style={{ transition: 'fill 1.5s ease-in-out' }} />

            {/* ── SKY CONTENT (Sun/Clouds or Moon/Stars) ── */}
            <g style={{ transition: 'opacity 1.5s ease-in-out', opacity: isNightMode ? 0 : 1 }}>
              {/* MORNING SUN GLOW (top-right pane) */}
              <circle cx="148" cy="28" r="18" fill={windowSunColor} />
              <circle cx="148" cy="28" r="10" fill="rgba(255,235,160,0.5)" />
              {/* CLOUDS */}
              <ellipse cx="38" cy="52" rx="16" ry="7" fill={windowCloudColor} opacity="0.9" />
              <ellipse cx="52" cy="50" rx="12" ry="6" fill={windowCloudColor} opacity="0.85" />
              <ellipse cx="44" cy="48" rx="10" ry="5" fill={windowCloudColor} opacity="0.95" />
              <ellipse cx="118" cy="58" rx="14" ry="6" fill={windowCloudColor} opacity="0.85" />
              <ellipse cx="130" cy="56" rx="10" ry="5" fill={windowCloudColor} opacity="0.9" />
              <ellipse cx="52" cy="128" rx="13" ry="5.5" fill={windowCloudColor} opacity="0.8" />
              <ellipse cx="42" cy="126" rx="9" ry="4.5" fill={windowCloudColor} opacity="0.85" />
            </g>

            <g style={{ transition: 'opacity 1.5s ease-in-out', opacity: isNightMode ? 1 : 0 }}>
              {/* CRESCENT MOON */}
              <path d="M148,22 C148,22 142,32 152,38 C144,38 138,30 148,22 Z" fill="#F5F2E9" />
              {/* STARS */}
              <circle cx="38" cy="32" r="1" fill="#F5F2E9" opacity="0.8" />
              <circle cx="62" cy="50" r="1.5" fill="#F5F2E9" opacity="0.9" />
              <circle cx="24" cy="68" r="1" fill="#F5F2E9" opacity="0.6" />
              <circle cx="128" cy="68" r="1" fill="#F5F2E9" opacity="0.8" />
              <circle cx="108" cy="48" r="1.5" fill="#F5F2E9" opacity="0.7" />
              <circle cx="48" cy="128" r="1" fill="#F5F2E9" opacity="0.9" />
              <circle cx="132" cy="118" r="1.5" fill="#F5F2E9" opacity="0.8" />
            </g>

            {/* ── CROSSBAR MUNTINS (slim, delicate, drawn on top of panes) ── */}
            <rect x="86" y="8" width="8" height="164" rx="2" fill="#E8D5B5" stroke="#5C4B3F" strokeWidth="1.5" />
            <rect x="8" y="88" width="164" height="8" rx="2" fill="#E8D5B5" stroke="#5C4B3F" strokeWidth="1.5" />

            {/* ── WINDOW SILL ── */}
            <rect x="-2" y="174" width="184" height="14" rx="4" fill="#E8D5B5" stroke="#5C4B3F" strokeWidth="4" />
            {/* Sill highlight */}
            <line x1="6" y1="177" x2="174" y2="177" stroke="#ffffff" strokeWidth="1.5" opacity="0.5" />
          </svg>
        </div>

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
                <g 
                  onClick={() => setIsNightMode(!isNightMode)}
                  style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                >
                  {/* Mini warm glow cone removed (now handled by global lighting overlay) */}
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

            {/* --- Phase 4: Mini Book on Main Room Tabletop (non-interactive) --- */}
            {(() => {
              const mp = miniSnapPoints[savedBookPosition]
              const bx = mp.x
              const by = mp.y

              // Flat-lying book: parallelogram matching the desk perspective shear
              const mW  = 18    // width (screen horizontal)
              const mD  = 8     // depth (into screen / upward)
              const mT  = 2     // page thickness (drops DOWN on Y-axis)
              const mSx = 0.30  // horizontal shear per depth unit
              const mSpW = 2.5  // spine strip width

              // Cover top-face corners
              const flX = bx - mW / 2,             flY = by
              const frX = bx + mW / 2,             frY = by
              const brX = bx + mW / 2 + mSx * mD,  brY = by - mD
              const blX = bx - mW / 2 + mSx * mD,  blY = by - mD

              // Polygon point strings
              const coverPts    = `${flX},${flY} ${frX},${frY} ${brX},${brY} ${blX},${blY}`
              const spinePts    = `${flX},${flY} ${flX + mSpW},${flY} ${blX + mSpW},${blY} ${blX},${blY}`
              const frontPgPts  = `${flX},${flY} ${frX},${frY} ${frX},${frY + mT} ${flX},${flY + mT}`
              const rightPgPts  = `${frX},${frY} ${brX},${brY} ${brX},${brY + mT} ${frX},${frY + mT}`
              const shadowPts   = `${flX - 1},${flY + mT + 2} ${frX + 2},${frY + mT + 2} ${brX + 2},${brY + mT + 2} ${blX - 1},${blY + mT + 2}`

              // Bookmark sticky-tab: sticks out from right pages edge, anchored by depth fractions
              const mTabOut = 5
              const mTabF1 = 0.35, mTabF2 = 0.58
              // Right edge runs from (frX, frY+mT) to (brX, brY+mT)
              const mTX1 = frX + (brX - frX) * mTabF1, mTY1 = (frY + mT) + ((brY + mT) - (frY + mT)) * mTabF1
              const mTX2 = frX + (brX - frX) * mTabF2, mTY2 = (frY + mT) + ((brY + mT) - (frY + mT)) * mTabF2
              const mTabPts = `${mTX1},${mTY1} ${mTX2},${mTY2} ${mTX2 + mTabOut},${mTY2} ${mTX1 + mTabOut},${mTY1}`

              // Title line at depth fraction 0.40
              const t1f = 0.40
              const t1y = by - mD * t1f
              const t1x1 = flX + mSx * mD * t1f + mSpW + 1
              const t1x2 = frX + mSx * mD * t1f - 2

              return (
                <g style={{ pointerEvents: 'none' }}>
                  {/* Shadow */}
                  <polygon points={shadowPts} fill="rgba(0,0,0,0.16)" />
                  {/* Front-edge pages (cream, drops down by mT) */}
                  <polygon points={frontPgPts} fill="#F5F2E9" stroke="#5c4b3f" strokeWidth="0.7" strokeLinejoin="round" />
                  {/* Right-side pages (cream, drops down by mT) */}
                  <polygon points={rightPgPts} fill="#F4EAE1" stroke="#5c4b3f" strokeWidth="0.6" strokeLinejoin="round" />
                  {/* Main cover face (red) */}
                  <polygon points={coverPts} fill="#C0392B" stroke="#5c4b3f" strokeWidth="0.9" strokeLinejoin="round" />
                  {/* Spine strip */}
                  <polygon points={spinePts} fill="#8B2C2C" stroke="#5c4b3f" strokeWidth="0.6" strokeLinejoin="round" />
                  {/* Title line */}
                  <line x1={t1x1} y1={t1y} x2={t1x2} y2={t1y} stroke="#F5F2E9" strokeWidth="0.9" strokeLinecap="round" />
                  {/* Bookmark sticky-tab */}
                  <polygon points={mTabPts} fill="#F2C94C" stroke="#5c4b3f" strokeWidth="0.5" strokeLinejoin="round" />
                  {/* Note indicator dot */}
                  {savedBookText && <circle cx={(mTX1 + mTX2) / 2 + mTabOut - 1} cy={(mTY1 + mTY2) / 2} r="1.2" fill="#5c4b3f" opacity="0.7" />}
                </g>
              )
            })()}

            {/* --- Phase 6: Mini Plant on Main Room Tabletop (non-interactive) --- */}
            {(() => {
              const mp = miniSnapPoints[savedPlantPosition]
              const px = mp.x
              const py = mp.y
              // Mini pot: tapered trapezoid — wider at top, narrower at base
              // All coords relative to (px, py) = base-center anchor
              const ptW = 7   // half-width at pot top rim
              const pbW = 5   // half-width at pot base
              const pH  = 8   // pot height
              const potTop    = py - pH
              const potBottom = py
              // Pot bottom curve sag (matches rim ellipse perspective)
              const bSag = 1.5
              return (
                <g style={{ pointerEvents: 'none' }}>
                  {/* Shadow */}
                  <ellipse cx={px} cy={py + 1} rx={ptW + 1.5} ry="1.2" fill="rgba(0,0,0,0.15)" />
                  {/* Pot body — curved bottom edge */}
                  <path
                    d={`M ${px - ptW},${potTop} L ${px - pbW},${potBottom} Q ${px},${potBottom + bSag} ${px + pbW},${potBottom} L ${px + ptW},${potTop} Z`}
                    fill="#E8D5B5" stroke="#5c4b3f" strokeWidth="0.8" strokeLinejoin="round"
                  />
                  {/* Curved rib line */}
                  {(() => {
                    const f = 0.55
                    const rY = potTop + pH * f
                    const rHW = ptW + (pbW - ptW) * f
                    const rSag = bSag * f * 0.6
                    return <path d={`M ${px - rHW + 0.5},${rY} Q ${px},${rY + rSag} ${px + rHW - 0.5},${rY}`} fill="none" stroke="#5c4b3f" strokeWidth="0.5" opacity="0.5" />
                  })()}
                  {/* Soil ellipse */}
                  <ellipse cx={px} cy={potTop} rx={ptW - 0.5} ry="1.5" fill="#5C3A21" stroke="#5c4b3f" strokeWidth="0.6" />
                  {/* Stem */}
                  <line x1={px} y1={potTop} x2={px} y2={potTop - 9} stroke="#5c4b3f" strokeWidth="1.4" strokeLinecap="round" />
                  <line x1={px} y1={potTop} x2={px} y2={potTop - 9} stroke="#7CB342" strokeWidth="0.8" strokeLinecap="round" />
                  {/* Leaf L — pointed via two beziers */}
                  <path d={`M ${px},${potTop - 5} Q ${px - 5},${potTop - 7} ${px - 4},${potTop - 12} Q ${px - 2},${potTop - 8} ${px},${potTop - 5} Z`} fill="#7CB342" stroke="#5c4b3f" strokeWidth="0.5" />
                  {/* Leaf R — pointed */}
                  <path d={`M ${px},${potTop - 7} Q ${px + 5},${potTop - 8} ${px + 5},${potTop - 14} Q ${px + 2},${potTop - 10} ${px},${potTop - 7} Z`} fill="#7CB342" stroke="#5c4b3f" strokeWidth="0.5" />
                  {/* Leaf top — pointed */}
                  <path d={`M ${px},${potTop - 9} Q ${px - 2},${potTop - 13} ${px},${potTop - 17} Q ${px + 2},${potTop - 13} ${px},${potTop - 9} Z`} fill="#7CB342" stroke="#5c4b3f" strokeWidth="0.5" />
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

        {/* --- Phase 3: Global Lighting Overlay --- */}
        <div
          className="absolute inset-0 pointer-events-none transition-all duration-[1500ms] ease-in-out"
          style={{
            zIndex: 30, // Over table (20) and window (12)
            background: isNightMode
              ? 'radial-gradient(circle at 35% 60%, rgba(255, 230, 150, 0.1) 0%, rgba(20, 20, 40, 0.6) 40%, rgba(10, 10, 25, 0.85) 100%)'
              : 'transparent',
            mixBlendMode: isNightMode ? 'multiply' : 'normal',
          }}
        />

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
              className="w-[90vw] max-w-[900px] max-h-[85vh] aspect-[3/2] rounded-full border-4 border-[#5c4b3f] relative shadow-2xl overflow-hidden transition-all duration-[1500ms]"
              style={{
                background: isNightMode
                  ? 'radial-gradient(circle at 30% 40%, rgba(255, 220, 130, 0.15) 0%, rgba(40, 40, 60, 0.8) 50%, rgba(20, 20, 35, 0.95) 100%)'
                  : '#f4ebd0'
              }}
            >
              <svg
                ref={zoomSvgRef}
                viewBox="0 0 600 400"
                width="100%"
                height="100%"
                style={{ overflow: 'visible' }}
              >
                {/* SVG Defs removed */}
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

                {/* --- Phase 3: Lamp warm light cone removed (now handled by global lighting overlay) --- */}

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

                {/* --- Phase 4: Draggable Book Asset on the Close-up Tabletop --- */}
                {(() => {
                  const activeBookSnap = closeUpSnapPoints[bookPosition]
                  const bx = activeBookSnap.x + (isBookDragging ? bookDragOffset.x : 0)
                  const by = activeBookSnap.y + (isBookDragging ? bookDragOffset.y : 0)
                  // Snap anchor sits at the front-center of the book base
                  const drawY = by + 6  // slight downward shift to ground on crosshair

                  // Flat-lying book geometry — parallelogram matching desk perspective
                  const W   = 100  // cover width  (screen horizontal)
                  const D   = 68   // cover depth  (into screen / upward on-screen)
                  const T   = 10   // page thickness (drops DOWN on Y-axis)
                  const sx  = 0.30 // horizontal shear per depth unit
                  const spW = 14   // spine strip width (left edge)

                  // Four corners of the flat cover top-face (parallelogram)
                  const flX = bx - W / 2,            flY = drawY
                  const frX = bx + W / 2,            frY = drawY
                  const brX = bx + W / 2 + sx * D,   brY = drawY - D
                  const blX = bx - W / 2 + sx * D,   blY = drawY - D

                  // Spine inner edge (spW from left)
                  const sflX = flX + spW
                  const sblX = blX + spW

                  // Polygon point strings
                  const coverPts   = `${flX},${flY} ${frX},${frY} ${brX},${brY} ${blX},${blY}`
                  const spinePts   = `${flX},${flY} ${sflX},${flY} ${sblX},${blY} ${blX},${blY}`
                  const frontPgPts = `${flX},${flY} ${frX},${frY} ${frX},${frY + T} ${flX},${flY + T}`
                  const rightPgPts = `${frX},${frY} ${brX},${brY} ${brX},${brY + T} ${frX},${frY + T}`

                  // Shadow polygon (sits below the bottom faces)
                  const shOff = 6
                  const shadowPts = `${flX - 4},${flY + T + shOff} ${frX + 4},${frY + T + shOff} ${brX + 4},${brY + T + shOff} ${blX - 4},${blY + T + shOff}`

                  // Title lines — at depth fractions on the cover face
                  const t1f = 0.32
                  const t1y = drawY - D * t1f
                  const t1x1 = flX + sx * D * t1f + spW + 10
                  const t1x2 = frX + sx * D * t1f - 10

                  const t2f = 0.50
                  const t2y = drawY - D * t2f
                  const t2x1 = flX + sx * D * t2f + spW + 10
                  const t2x2 = frX + sx * D * t2f - 16

                  // Heart center — at depth 0.68, horizontally centered on cover
                  const hf  = 0.68
                  const hcx = (flX + frX) / 2 + sx * D * hf
                  const hcy = drawY - D * hf

                  // Bookmark sticky-tab: sticks out from the right pages face
                  // Right-side bottom edge runs from (frX, frY+T) to (brX, brY+T)
                  const tabOut = 16
                  const tabF1 = 0.35, tabF2 = 0.58
                  const tX1 = frX + (brX - frX) * tabF1, tY1 = (frY + T) + ((brY + T) - (frY + T)) * tabF1
                  const tX2 = frX + (brX - frX) * tabF2, tY2 = (frY + T) + ((brY + T) - (frY + T)) * tabF2
                  const tabPts = `${tX1},${tY1} ${tX2},${tY2} ${tX2 + tabOut},${tY2} ${tX1 + tabOut},${tY1}`

                  return (
                    <g
                      onPointerDown={handleBookPointerDown}
                      onPointerMove={handleBookPointerMove}
                      onPointerUp={handleBookPointerUp}
                      onPointerCancel={handleBookPointerUp}
                      style={{ cursor: isBookDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
                    >
                      {/* ── SHADOW polygon ── */}
                      <polygon points={shadowPts} fill="rgba(0,0,0,0.15)" />

                      {/* ── FRONT-EDGE PAGES (cream, drops down by T) ── */}
                      <polygon points={frontPgPts} fill="#F5F2E9" stroke="#5c4b3f" strokeWidth="2.5" strokeLinejoin="round" />

                      {/* ── RIGHT-SIDE PAGES (cream, drops down by T) ── */}
                      <polygon points={rightPgPts} fill="#F4EAE1" stroke="#5c4b3f" strokeWidth="2" strokeLinejoin="round" />

                      {/* ── MAIN COVER FACE (red parallelogram, on top) ── */}
                      <polygon points={coverPts} fill="#C0392B" stroke="#5c4b3f" strokeWidth="3" strokeLinejoin="round" />

                      {/* ── SPINE STRIP (darker red, left edge, topmost) ── */}
                      <polygon points={spinePts} fill="#8B2C2C" stroke="#5c4b3f" strokeWidth="2" strokeLinejoin="round" />

                      {/* ── TITLE LINE 1 ── */}
                      <line x1={t1x1} y1={t1y} x2={t1x2} y2={t1y} stroke="#F5F2E9" strokeWidth="3" strokeLinecap="round" />

                      {/* ── TITLE LINE 2 ── */}
                      <line x1={t2x1} y1={t2y} x2={t2x2} y2={t2y} stroke="#F5F2E9" strokeWidth="2" strokeLinecap="round" />

                      {/* ── HEART DOODLE ── */}
                      <path
                        d={`M ${hcx},${hcy + 4} c 0,-6 -9,-6 -9,0 c 0,6 9,10 9,10 c 0,0 9,-4 9,-10 c 0,-6 -9,-6 -9,0`}
                        fill="#F5F2E9"
                        opacity="0.78"
                      />

                      {/* ── BOOKMARK STICKY-TAB (against the right pages face) ── */}
                      <polygon
                        points={tabPts}
                        fill="#F2C94C"
                        stroke="#5c4b3f" strokeWidth="1.5" strokeLinejoin="round"
                      />

                      {/* ── NOTE INDICATOR dot on tab ── */}
                      {savedBookText && (
                        <circle
                          cx={(tX1 + tX2) / 2 + tabOut - 4}
                          cy={(tY1 + tY2) / 2}
                          r="5"
                          fill="#5c4b3f"
                          opacity="0.7"
                        />
                      )}
                    </g>
                  )
                })()}

                {/* --- Phase 6: Draggable Plant Asset on the Close-up Tabletop --- */}
                {(() => {
                  const activePlantSnap = closeUpSnapPoints[plantPosition]
                  const px = activePlantSnap.x + (isPlantDragging ? plantDragOffset.x : 0)
                  const py = activePlantSnap.y + (isPlantDragging ? plantDragOffset.y : 0)
                  // drawY: anchor at base-center of pot; shift slightly down to sit on crosshair
                  const drawY = py + 8

                  // Pot geometry — tapered trapezoid (wider top, narrower base)
                  const ptW = 36   // half-width at pot top rim
                  const pbW = 26   // half-width at pot base
                  const pH  = 55   // total pot height
                  const rimY = drawY - pH  // y of top rim

                  return (
                    <g
                      onPointerDown={handlePlantPointerDown}
                      onPointerMove={handlePlantPointerMove}
                      onPointerUp={handlePlantPointerUp}
                      onPointerCancel={handlePlantPointerUp}
                      style={{ cursor: isPlantDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
                    >
                      {/* ── GROUNDING SHADOW ── */}
                      <ellipse cx={px} cy={drawY + 5} rx={ptW + 10} ry="10" fill="rgba(0,0,0,0.15)" />

                      {/* ── POT BODY — curved bottom edge for 3D perspective ── */}
                      {(() => {
                        const bSag = 8  // how much the bottom edge curves downward
                        return (
                          <path
                            d={`M ${px - ptW},${rimY} L ${px - pbW},${drawY} Q ${px},${drawY + bSag} ${px + pbW},${drawY} L ${px + ptW},${rimY} Z`}
                            fill="#E8D5B5"
                            stroke="#5c4b3f" strokeWidth="3" strokeLinejoin="round"
                          />
                        )
                      })()}

                      {/* ── CURVED RIB LINES on pot body ── */}
                      {[0.35, 0.60, 0.82].map((f, i) => {
                        const lineY = rimY + pH * f
                        const hw = ptW + (pbW - ptW) * f
                        const ribSag = 8 * f * 0.6  // sag scales down toward the top
                        return (
                          <path
                            key={i}
                            d={`M ${px - hw + 2},${lineY} Q ${px},${lineY + ribSag} ${px + hw - 2},${lineY}`}
                            fill="none"
                            stroke="#5c4b3f" strokeWidth="1.5" opacity="0.4"
                          />
                        )
                      })}

                      {/* ── POT RIM ELLIPSE (3D top opening) ── */}
                      <ellipse cx={px} cy={rimY} rx={ptW} ry="9"
                        fill="#D4B896" stroke="#5c4b3f" strokeWidth="3"
                      />

                      {/* ── SOIL ELLIPSE inside rim ── */}
                      <ellipse cx={px} cy={rimY} rx={ptW - 5} ry="6"
                        fill="#5C3A21" stroke="#5c4b3f" strokeWidth="2"
                      />

                      {/* ── STEM ── */}
                      <line
                        x1={px} y1={rimY}
                        x2={px} y2={rimY - 90}
                        stroke="#5c4b3f" strokeWidth="7" strokeLinecap="round"
                      />
                      <line
                        x1={px} y1={rimY}
                        x2={px} y2={rimY - 90}
                        stroke="#7CB342" strokeWidth="4" strokeLinecap="round"
                      />

                      {/* ── LEAF 1: left, lower — pointed via two opposing beziers ── */}
                      <path
                        d={`M ${px},${rimY - 35} Q ${px - 38},${rimY - 30} ${px - 30},${rimY - 62} Q ${px - 18},${rimY - 50} ${px},${rimY - 35} Z`}
                        fill="#7CB342" stroke="#5c4b3f" strokeWidth="2" strokeLinejoin="round"
                      />

                      {/* ── LEAF 2: right, mid — pointed ── */}
                      <path
                        d={`M ${px},${rimY - 55} Q ${px + 40},${rimY - 48} ${px + 35},${rimY - 82} Q ${px + 20},${rimY - 72} ${px},${rimY - 55} Z`}
                        fill="#7CB342" stroke="#5c4b3f" strokeWidth="2" strokeLinejoin="round"
                      />

                      {/* ── LEAF 3: top, slightly left — pointed ── */}
                      <path
                        d={`M ${px},${rimY - 78} Q ${px - 22},${rimY - 95} ${px - 8},${rimY - 118} Q ${px + 8},${rimY - 100} ${px},${rimY - 78} Z`}
                        fill="#7CB342" stroke="#5c4b3f" strokeWidth="2" strokeLinejoin="round"
                      />
                    </g>
                  )
                })()}

                {/* --- Phase 3: Draggable Lamp Asset on the Close-up Tabletop --- */}
                {(() => {
                  const lx = activeLampSnap.x + (isLampDragging ? lampDragOffset.x : 0)
                  const ly = activeLampSnap.y + (isLampDragging ? lampDragOffset.y : 0)
                  const drawY = ly + 20 // Shift all drawing Y coordinates down slightly to ground base over crosshair targets

                  return (
                    <g
                      onClick={() => {
                        if (!lampHasDraggedRef.current) {
                          setIsNightMode(!isNightMode)
                        }
                      }}
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

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* Phase 4: Note Modal — Lined paper journal overlay                  */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {isBookModalOpen && (
        <div
          id="note-modal-backdrop"
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ backdropFilter: 'blur(6px)', backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={(e) => { if (e.target.id === 'note-modal-backdrop') handleNoteModalCancel() }}
        >
          {/* Paper card */}
          <div
            style={{
              width: 'clamp(320px, 42vw, 560px)',
              height: 'clamp(420px, 65vh, 720px)',
              backgroundColor: '#FEFCF3',
              borderRadius: '4px 12px 4px 4px',
              border: '2px solid #5c4b3f',
              boxShadow: '6px 6px 0px #5c4b3f, 0 20px 60px rgba(0,0,0,0.35)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Red margin line */}
            <div style={{
              position: 'absolute',
              left: '52px',
              top: 0,
              bottom: 0,
              width: '2px',
              backgroundColor: 'rgba(200,80,80,0.35)',
              pointerEvents: 'none',
              zIndex: 1,
            }} />

            {/* Spiral binding holes */}
            {[60, 110, 160, 210, 260, 310, 360].map((y, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: '14px',
                top: `${y}px`,
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                border: '2px solid #5c4b3f',
                backgroundColor: '#FEFCF3',
                zIndex: 2,
                pointerEvents: 'none',
              }} />
            ))}

            {/* Header: date + title */}
            <div style={{
              padding: '18px 20px 10px 62px',
              borderBottom: '1.5px solid rgba(92,75,63,0.15)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              flexShrink: 0,
            }}>
              <span style={{
                fontFamily: "'Caveat', 'Patrick Hand', cursive, sans-serif",
                fontSize: '22px',
                fontWeight: 700,
                color: '#5c4b3f',
                letterSpacing: '0.02em',
              }}>My Notes</span>
              <span style={{
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#9a7f6e',
                letterSpacing: '0.05em',
              }}>
                {new Date().toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
            </div>

            {/* Lined paper area with textarea */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              {/* Horizontal ruled lines */}
              <svg
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}
                preserveAspectRatio="none"
              >
                {Array.from({ length: 30 }, (_, i) => (
                  <line
                    key={i}
                    x1="0" y1={28 + i * 30}
                    x2="100%" y2={28 + i * 30}
                    stroke="rgba(147,197,253,0.45)" strokeWidth="1"
                  />
                ))}
              </svg>
              {/* Transparent textarea sitting on top of the lines */}
              <textarea
                id="note-textarea"
                autoFocus
                value={currentBookText}
                onChange={(e) => setCurrentBookText(e.target.value)}
                placeholder="Write something cozy..."
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  padding: '8px 20px 8px 62px',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  fontFamily: "'Caveat', 'Patrick Hand', cursive, sans-serif",
                  fontSize: '18px',
                  lineHeight: '30px',
                  color: '#3d2e24',
                  zIndex: 1,
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Footer: action buttons */}
            <div style={{
              padding: '12px 20px 16px 62px',
              borderTop: '1.5px solid rgba(92,75,63,0.15)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              flexShrink: 0,
              backgroundColor: 'rgba(244,235,208,0.6)',
            }}>
              <button
                onClick={handleNoteModalCancel}
                style={{
                  padding: '8px 22px',
                  backgroundColor: '#FEFCF3',
                  border: '2px solid #5c4b3f',
                  borderRadius: '10px 6px 10px 8px',
                  boxShadow: '3px 3px 0px #5c4b3f',
                  color: '#5c4b3f',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '1px 1px 0px #5c4b3f'; e.currentTarget.style.transform = 'translate(2px,2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '3px 3px 0px #5c4b3f'; e.currentTarget.style.transform = '' }}
              >
                Cancel
              </button>
              <button
                onClick={handleNoteModalSave}
                style={{
                  padding: '8px 22px',
                  backgroundColor: '#f3e8e0',
                  border: '2px solid #5c4b3f',
                  borderRadius: '6px 10px 8px 10px',
                  boxShadow: '3px 3px 0px #5c4b3f',
                  color: '#5c4b3f',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '1px 1px 0px #5c4b3f'; e.currentTarget.style.transform = 'translate(2px,2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '3px 3px 0px #5c4b3f'; e.currentTarget.style.transform = '' }}
              >
                Save ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
