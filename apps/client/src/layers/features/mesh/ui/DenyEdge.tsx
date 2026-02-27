import { useState, useCallback } from 'react';
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';

/** Hub-to-hub solid red dashed edge representing a cross-namespace deny rule. */
export function DenyEdge(props: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    sourcePosition: props.sourcePosition,
    targetX: props.targetX,
    targetY: props.targetY,
    targetPosition: props.targetPosition,
  });

  const handleMouseEnter = useCallback(() => setIsHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsHovered(false), []);

  return (
    <g onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <BaseEdge
        id={props.id}
        path={edgePath}
        style={{
          stroke: 'var(--color-destructive)',
          strokeWidth: 1.5,
          strokeDasharray: '4 4',
          opacity: props.selected || isHovered ? 1 : 0.5,
        }}
      />
    </g>
  );
}
