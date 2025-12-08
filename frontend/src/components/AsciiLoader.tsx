import { useState, useEffect, useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { EffectComposer } from "@react-three/postprocessing"
import { Center } from "@react-three/drei"
import { Vector2, Shape, ExtrudeGeometry, Group } from "three"
import { AsciiEffect } from "./AsciiEffect"

// Create the Anon logo shape from SVG paths
function createLogoShapes() {
  const shapes: Shape[] = []
  
  const shape1 = new Shape()
  shape1.moveTo(34.65, 36.02)
  shape1.bezierCurveTo(36.82, 35.99, 38.54, 34.20, 38.54, 32.03)
  shape1.lineTo(38.54, 13.63)
  shape1.bezierCurveTo(38.54, 13.28, 38.26, 13.00, 37.91, 13.00)
  shape1.lineTo(36.41, 13.00)
  shape1.bezierCurveTo(36.06, 13.00, 35.78, 13.28, 35.78, 13.63)
  shape1.lineTo(35.78, 32.05)
  shape1.bezierCurveTo(35.78, 32.69, 35.25, 33.24, 34.62, 33.23)
  shape1.bezierCurveTo(33.99, 33.21, 33.49, 32.70, 33.49, 32.08)
  shape1.lineTo(33.49, 27.04)
  shape1.bezierCurveTo(33.49, 25.15, 33.12, 23.31, 32.39, 21.57)
  shape1.bezierCurveTo(31.68, 19.89, 30.66, 18.40, 29.38, 17.10)
  shape1.bezierCurveTo(28.10, 15.81, 26.59, 14.80, 24.91, 14.10)
  shape1.bezierCurveTo(23.18, 13.37, 21.33, 13.00, 19.44, 13.00)
  shape1.lineTo(11.08, 13.00)
  shape1.bezierCurveTo(10.73, 13.00, 10.44, 13.28, 10.44, 13.63)
  shape1.lineTo(10.44, 15.14)
  shape1.bezierCurveTo(10.44, 15.49, 10.73, 15.77, 11.08, 15.77)
  shape1.lineTo(19.42, 15.77)
  shape1.bezierCurveTo(22.42, 15.77, 25.26, 16.95, 27.38, 19.08)
  shape1.bezierCurveTo(29.51, 21.21, 30.69, 24.04, 30.69, 27.04)
  shape1.lineTo(30.69, 32.09)
  shape1.bezierCurveTo(30.69, 34.26, 32.47, 36.04, 34.65, 36.02)
  shapes.push(shape1)

  const shape2 = new Shape()
  const centerX = 19.42
  const centerY = 27.04
  const outerRadius = 8.97
  const innerRadius = 6.22
  
  shape2.absarc(centerX, centerY, outerRadius, 0, Math.PI * 2, false)
  
  const hole = new Shape()
  hole.absarc(centerX, centerY, innerRadius, 0, Math.PI * 2, true)
  shape2.holes.push(hole)
  
  shapes.push(shape2)
  
  return shapes
}

// 3D Logo component for loader
function AnonLogo3D() {
  const groupRef = useRef<Group>(null)
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.4
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.15
    }
  })
  
  const geometry = useMemo(() => {
    const shapes = createLogoShapes()
    const extrudeSettings = {
      depth: 4,
      bevelEnabled: true,
      bevelThickness: 0.8,
      bevelSize: 0.5,
      bevelOffset: 0,
      bevelSegments: 3,
    }
    return new ExtrudeGeometry(shapes, extrudeSettings)
  }, [])
  
  return (
    <Center>
      <group ref={groupRef} scale={[0.12, -0.12, 0.12]} rotation={[0, 0, 0]}>
        <mesh geometry={geometry} position={[-24, -24, -2]}>
          <meshStandardMaterial 
            color="#ededed" 
            roughness={0.3} 
            metalness={0.1}
            side={2}
          />
        </mesh>
      </group>
    </Center>
  )
}

// Skeleton components
function SkeletonHeader() {
  return (
    <div className="skeleton-header">
      <div className="skeleton-header-left">
        <div className="skeleton-logo" />
        <div className="skeleton-nav">
          <div className="skeleton-nav-item" />
          <div className="skeleton-nav-item" />
          <div className="skeleton-nav-item" />
        </div>
      </div>
      <div className="skeleton-header-right">
        <div className="skeleton-button" />
        <div className="skeleton-address" />
      </div>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card-header">
        <div className="skeleton-badge" />
        <div className="skeleton-title" />
      </div>
      <div className="skeleton-card-body">
        <div className="skeleton-line long" />
        <div className="skeleton-line medium" />
        <div className="skeleton-line short" />
      </div>
      <div className="skeleton-card-footer">
        <div className="skeleton-bar" />
        <div className="skeleton-buttons">
          <div className="skeleton-btn" />
          <div className="skeleton-btn" />
        </div>
      </div>
    </div>
  )
}

function SkeletonContent() {
  return (
    <div className="skeleton-content">
      <div className="skeleton-page-header">
        <div className="skeleton-page-title" />
        <div className="skeleton-page-subtitle" />
      </div>
      <div className="skeleton-filters">
        <div className="skeleton-filter" />
        <div className="skeleton-filter" />
        <div className="skeleton-filter" />
      </div>
      <div className="skeleton-cards">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}

export function AsciiLoader() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState(new Vector2(0, 0))
  const [resolution, setResolution] = useState(new Vector2(300, 300))

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = rect.height - (e.clientY - rect.top)
        setMousePos(new Vector2(x, y))
      }
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener("mousemove", handleMouseMove)

      const rect = container.getBoundingClientRect()
      setResolution(new Vector2(rect.width, rect.height))

      const handleResize = () => {
        const rect = container.getBoundingClientRect()
        setResolution(new Vector2(rect.width, rect.height))
      }
      window.addEventListener("resize", handleResize)

      return () => {
        container.removeEventListener("mousemove", handleMouseMove)
        window.removeEventListener("resize", handleResize)
      }
    }
  }, [])

  return (
    <div className="ascii-loader-wrapper">
      {/* Skeleton Background */}
      <div className="skeleton-background">
        <SkeletonHeader />
        <SkeletonContent />
      </div>

      {/* ASCII Logo Overlay */}
      <div className="ascii-logo-overlay">
        <div ref={containerRef} className="ascii-logo-container">
          <Canvas
            camera={{ position: [0, 0, 5], fov: 50 }}
            style={{ width: "100%", height: "100%", background: "#5c5c5c" }}
          >
            <color attach="background" args={["#5c5c5c"]} />

            <hemisphereLight intensity={0.5} />
            <directionalLight position={[5, 5, 5]} intensity={2} />
            <directionalLight position={[-5, 3, -5]} intensity={1.2} />

            <AnonLogo3D />

            <EffectComposer>
              <AsciiEffect
                style="standard"
                cellSize={8}
                invert={false}
                color={true}
                resolution={resolution}
                mousePos={mousePos}
                postfx={{
                  scanlineIntensity: 0,
                  scanlineCount: 200,
                  targetFPS: 22,
                  jitterIntensity: 0,
                  jitterSpeed: 7.2,
                  mouseGlowEnabled: false,
                  mouseGlowRadius: 200,
                  mouseGlowIntensity: 1.5,
                  vignetteIntensity: 0,
                  vignetteRadius: 0.8,
                  colorPalette: 0,
                  curvature: 0,
                  aberrationStrength: 0,
                  noiseIntensity: 0.16,
                  noiseScale: 1,
                  noiseSpeed: 1,
                  waveAmplitude: 0,
                  waveFrequency: 10,
                  waveSpeed: 1,
                  glitchIntensity: 0,
                  glitchFrequency: 0,
                  brightnessAdjust: -0.46,
                  contrastAdjust: 1,
                }}
              />
            </EffectComposer>
          </Canvas>
        </div>
        <p className="loader-text">Loading...</p>
      </div>
    </div>
  )
}


