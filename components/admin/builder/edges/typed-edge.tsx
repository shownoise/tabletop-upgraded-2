"use client"

import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react"

type EdgeKind = "sequence" | "inject" | "branch" | "outcome"

const STYLE: Record<EdgeKind, { stroke: string; width: number; animated: boolean; dash?: string; glow?: boolean }> = {
  sequence: { stroke: "#64748b", width: 2, animated: false },
  inject:   { stroke: "#f59e0b", width: 2, animated: true, dash: "6 4" },
  branch:   { stroke: "#8b5cf6", width: 2.5, animated: false, glow: true },
  outcome:  { stroke: "#10b981", width: 2, animated: false },
}

export function TypedEdge(props: EdgeProps) {
  const kind = ((props.data as { kind?: EdgeKind } | undefined)?.kind ?? "sequence") as EdgeKind
  const style = STYLE[kind] ?? STYLE.sequence
  const [path] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
  })
  return (
    <BaseEdge
      id={props.id}
      path={path}
      markerEnd={props.markerEnd}
      style={{
        stroke: style.stroke,
        strokeWidth: style.width,
        strokeDasharray: style.dash,
        filter: style.glow ? "drop-shadow(0 0 4px rgba(139,92,246,0.5))" : undefined,
        animation: style.animated ? "rf-edge-dash 500ms linear infinite" : undefined,
      }}
    />
  )
}
