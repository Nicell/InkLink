// Copyright 2015 - 2025 Krasimir Tsonev, Nick Winans
// SPDX-License-Identifier: MIT

// This is a modified version of the PxBrush class from the original project https://github.com/kozo002/px-brush

import StampMaker from './StampMaker'

export default class PxBrush {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  stampMaker: StampMaker

  constructor (canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.context = canvas.getContext('2d')!
    this.stampMaker = new StampMaker()
    this.configPixelRatio()
  }

  get dpr () {
    return window.devicePixelRatio || 1
  }

  configPixelRatio () {
    this.context.imageSmoothingEnabled = false
  }

  distanceBetween (point1: { x: number; y: number }, point2: { x: number; y: number }) {
    return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2))
  }

  angleBetween (point1: { x: number; y: number }, point2: { x: number; y: number }) {
    return Math.atan2(point2.x - point1.x, point2.y - point1.y)
  }

  draw ({ from, to, size, color }: { from: { x: number; y: number }; to: { x: number; y: number }; size: number; color: string }) {
    this.context.globalCompositeOperation = 'source-over'
    this.brush({ from, to, size, color })
  }

  erase ({ from, to, size }: { from: { x: number; y: number }; to: { x: number; y: number }; size: number }) {
    this.context.globalCompositeOperation = 'destination-out'
    this.brush({ from, to, size, color: '#000000' })
  }

  brush ({ from, to, size, color }: { from: { x: number; y: number }; to: { x: number; y: number }; size: number; color: string }) {
    const halfSize = (size - (size % 2)) / 2
    const stamp = this.stampMaker.make({ size, color })!
    if (from.x === to.x && from.y === to.y) {
      const x = from.x - halfSize
      const y = from.y - halfSize
      this.context.drawImage(stamp, Math.round(x), Math.round(y), size, size)
      return
    }
    const dist = this.distanceBetween(from, to)
    const angle = this.angleBetween(from, to)
    for (let i = 0; i < dist; i += 1) {
      const x = from.x + (Math.sin(angle) * i) - halfSize
      const y = from.y + (Math.cos(angle) * i) - halfSize
      this.context.drawImage(stamp, Math.round(x), Math.round(y), size, size)
    }
  }
}
