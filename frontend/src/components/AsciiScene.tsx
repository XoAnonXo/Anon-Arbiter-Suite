import { useState, useEffect, useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { EffectComposer } from "@react-three/postprocessing"
import { Center } from "@react-three/drei"
import { Vector2, Shape, ExtrudeGeometry, Group } from "three"
import { AsciiEffect } from "./AsciiEffect"

// Create the Anon logo shape from SVG paths
function createLogoShapes() {
  const shapes: Shape[] = []
  
  // First path - the curved part with the vertical bar
  const shape1 = new Shape()
  // Simplified approximation of the first SVG path
  // Starting from the top of the vertical bar
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

  // Second path - the circle with hole (donut shape)
  const shape2 = new Shape()
  // Outer circle
  const centerX = 19.42
  const centerY = 27.04
  const outerRadius = 8.97
  const innerRadius = 6.22
  
  // Draw outer circle
  shape2.absarc(centerX, centerY, outerRadius, 0, Math.PI * 2, false)
  
  // Draw inner circle (hole) - counterclockwise
  const hole = new Shape()
  hole.absarc(centerX, centerY, innerRadius, 0, Math.PI * 2, true)
  shape2.holes.push(hole)
  
  shapes.push(shape2)
  
  return shapes
}

// 3D Logo component
function AnonLogo3D() {
  const groupRef = useRef<Group>(null)
  
  // Slow rotation
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.3
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.1
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
      <group ref={groupRef} scale={[0.08, -0.08, 0.08]} rotation={[0, 0, 0]}>
        <mesh geometry={geometry} position={[-24, -24, -2]}>
          <meshStandardMaterial 
            color="#b0b0b0" 
            roughness={0.3} 
            metalness={0.1}
            side={2}
          />
        </mesh>
      </group>
    </Center>
  )
}

export function AsciiScene() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [mousePos, setMousePos] = useState(new Vector2(0, 0))
  const [resolution, setResolution] = useState(new Vector2(678, 724))

  // Track mouse position for glow effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left
        // Flip Y coordinate to match shader UV space (bottom-up instead of top-down)
        const y = rect.height - (e.clientY - rect.top)
        setMousePos(new Vector2(x, y))
      }
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener("mousemove", handleMouseMove)

      // Set initial resolution
      const rect = container.getBoundingClientRect()
      setResolution(new Vector2(rect.width, rect.height))

      // Update resolution on resize
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
    <div ref={containerRef} className="ascii-canvas-container">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <color attach="background" args={["#5c5c5c"]} />

        {/* Lighting */}
        <hemisphereLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={2} />
        <directionalLight position={[-5, 3, -5]} intensity={1.2} />

        {/* 3D Anon Logo */}
        <AnonLogo3D />

        {/* ASCII Effect with PostFX */}
        <EffectComposer>
          <AsciiEffect
            style="standard"
            cellSize={4}
            invert={false}
            color={true}
            resolution={resolution}
            mousePos={mousePos}
            postfx={{
              scanlineIntensity: 0,
              scanlineCount: 200,
              targetFPS: 0,
              jitterIntensity: 0,
              jitterSpeed: 1,
              mouseGlowEnabled: false,
              mouseGlowRadius: 200,
              mouseGlowIntensity: 1.5,
              vignetteIntensity: 0,
              vignetteRadius: 0.8,
              colorPalette: 0,
              curvature: 0,
              aberrationStrength: 0,
              noiseIntensity: 0,
              noiseScale: 1,
              noiseSpeed: 1,
              waveAmplitude: 0,
              waveFrequency: 10,
              waveSpeed: 1,
              glitchIntensity: 0,
              glitchFrequency: 0,
              brightnessAdjust: 0,
              contrastAdjust: 1,
            }}
          />
        </EffectComposer>
      </Canvas>
    </div>
  )
}











