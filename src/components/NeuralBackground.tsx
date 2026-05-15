"use client"

import { useEffect, useRef } from "react"

type Node = {
  x: number
  y: number
  vx: number
  vy: number
  r: number
}

type Props = {
  avoidRef?: React.RefObject<HTMLElement | null>
}

export default function NeuralBackground({ avoidRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouse = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let W = window.innerWidth
    let H = window.innerHeight
    canvas.width = W
    canvas.height = H

    const COUNT = 70
    const MAX_DIST = 160
    const MOUSE_R = 130
    const CARD_PAD = 40 // soft boundary zone around the card

    const nodes: Node[] = Array.from({ length: COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 1.5,
    }))

    function draw() {
      ctx!.clearRect(0, 0, W, H)
      const mx = mouse.current.x
      const my = mouse.current.y

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < MAX_DIST) {
            ctx!.beginPath()
            ctx!.moveTo(nodes[i].x, nodes[i].y)
            ctx!.lineTo(nodes[j].x, nodes[j].y)
            ctx!.strokeStyle = `rgba(102,79,161,${(1 - d / MAX_DIST) * 0.18})`
            ctx!.lineWidth = 1
            ctx!.stroke()
          }
        }

        const mdx = nodes[i].x - mx
        const mdy = nodes[i].y - my
        const md = Math.sqrt(mdx * mdx + mdy * mdy)
        if (md < MOUSE_R) {
          ctx!.beginPath()
          ctx!.moveTo(nodes[i].x, nodes[i].y)
          ctx!.lineTo(mx, my)
          ctx!.strokeStyle = `rgba(102,79,161,${(1 - md / MOUSE_R) * 0.55})`
          ctx!.lineWidth = 1
          ctx!.stroke()
        }
      }

      for (const n of nodes) {
        ctx!.beginPath()
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2)
        ctx!.fillStyle = "rgba(102,79,161,0.45)"
        ctx!.fill()
      }

      if (mx > 0) {
        ctx!.beginPath()
        ctx!.arc(mx, my, 3, 0, Math.PI * 2)
        ctx!.fillStyle = "rgba(102,79,161,0.7)"
        ctx!.fill()
      }
    }

    function update() {
      const mx = mouse.current.x
      const my = mouse.current.y
      const EDGE = 60
      const rect = avoidRef?.current?.getBoundingClientRect()

      for (const n of nodes) {
        // Mouse repulsion
        const dx = n.x - mx
        const dy = n.y - my
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < MOUSE_R && d > 0) {
          const t = d / MOUSE_R
          const force = (1 - t) * (1 - t) * 0.12
          n.vx += (dx / d) * force
          n.vy += (dy / d) * force
        }

        // Card boundary repulsion
        if (rect) {
          const inside =
            n.x > rect.left && n.x < rect.right &&
            n.y > rect.top && n.y < rect.bottom

          let edgeX: number
          let edgeY: number

          if (inside) {
            // Node crept inside — push toward nearest edge instantly
            const dL = n.x - rect.left
            const dR = rect.right - n.x
            const dT = n.y - rect.top
            const dB = rect.bottom - n.y
            const min = Math.min(dL, dR, dT, dB)
            if (min === dL) { edgeX = rect.left; edgeY = n.y }
            else if (min === dR) { edgeX = rect.right; edgeY = n.y }
            else if (min === dT) { edgeX = n.x; edgeY = rect.top }
            else { edgeX = n.x; edgeY = rect.bottom }
          } else {
            // Soft zone outside card — repel toward nearest edge point
            edgeX = Math.max(rect.left, Math.min(rect.right, n.x))
            edgeY = Math.max(rect.top, Math.min(rect.bottom, n.y))
          }

          const ex = n.x - edgeX
          const ey = n.y - edgeY
          const ed = Math.sqrt(ex * ex + ey * ey) || 1

          if (inside || ed < CARD_PAD) {
            const force = inside
              ? 0.8
              : ((CARD_PAD - ed) / CARD_PAD) * 0.35
            n.vx += (ex / ed) * force
            n.vy += (ey / ed) * force
          }
        }

        // Soft edge walls
        if (n.x < EDGE) n.vx += (EDGE - n.x) * 0.003
        if (n.x > W - EDGE) n.vx -= (n.x - (W - EDGE)) * 0.003
        if (n.y < EDGE) n.vy += (EDGE - n.y) * 0.003
        if (n.y > H - EDGE) n.vy -= (n.y - (H - EDGE)) * 0.003

        n.vx *= 0.97
        n.vy *= 0.97

        const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy)
        if (speed > 1.2) {
          n.vx = (n.vx / speed) * 1.2
          n.vy = (n.vy / speed) * 1.2
        }

        n.x += n.vx
        n.y += n.vy
      }
    }

    let raf: number
    function loop() {
      update()
      draw()
      raf = requestAnimationFrame(loop)
    }
    loop()

    const onMove = (e: MouseEvent) => { mouse.current = { x: e.clientX, y: e.clientY } }
    const onLeave = () => { mouse.current = { x: -9999, y: -9999 } }
    const onResize = () => {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = W
      canvas.height = H
    }

    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseleave", onLeave)
    window.addEventListener("resize", onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseleave", onLeave)
      window.removeEventListener("resize", onResize)
    }
  }, [avoidRef])

  return <canvas ref={canvasRef} className="fixed inset-0 -z-10 bg-zinc-100" />
}
