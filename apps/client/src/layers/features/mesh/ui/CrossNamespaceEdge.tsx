import { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  MarkerType,
  type EdgeProps,
} from '@xyflow/react';
import { usePrefersReducedMotion } from '../lib/use-reduced-motion';

/** Data carried by cross-namespace edges. */
interface CrossNamespaceEdgeData extends Record<string, unknown> {
  label: string;
}

/** Hub-to-hub dashed edge representing a cross-namespace allow rule. */
export function CrossNamespaceEdge(props: EdgeProps) {
  const [hovered, setHovered] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });

  const label = (props.data as CrossNamespaceEdgeData | undefined)?.label;
  const showLabel = hovered || props.selected;

  return (
    <>
      {/* Invisible wider hit area for hover detection */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <BaseEdge
        id={props.id}
        path={edgePath}
        markerEnd={MarkerType.ArrowClosed}
        style={{
          stroke: 'var(--color-primary)',
          strokeWidth: 1.5,
          strokeDasharray: '6 3',
        }}
      />
      {/* Flow particle travelling along the edge */}
      {!prefersReducedMotion && (
        <circle r={3} fill="var(--color-primary)" opacity={0.8}>
          <animateMotion dur="3s" repeatCount="indefinite">
            <mpath xlinkHref={`#${props.id}`} />
          </animateMotion>
        </circle>
      )}
      {showLabel && label && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
