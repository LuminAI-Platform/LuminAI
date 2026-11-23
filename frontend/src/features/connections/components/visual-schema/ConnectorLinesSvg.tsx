import React from "react";
import type { ConnectorLine } from "./visualSchemaTypes";

interface ConnectorLinesSvgProps {
  connectorLines: ConnectorLine[];
  dragPreviewLine: ConnectorLine | null;
}

export const ConnectorLinesSvg: React.FC<ConnectorLinesSvgProps> = ({
  connectorLines,
  dragPreviewLine,
}) => {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      style={{ overflow: "visible" }}
    >
      <defs>
        <marker
          id="arrow-head"
          markerWidth="6"
          markerHeight="6"
          refX="3"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L0,6 L6,3 z" fill="#3b82f6" opacity="0.7" />
        </marker>
      </defs>
      {connectorLines.map((line) => {
        const cx1 = line.x1 + (line.x2 - line.x1) * 0.4;
        const cx2 = line.x1 + (line.x2 - line.x1) * 0.6;
        return (
          <path
            key={line.id ?? `${line.x1}-${line.y1}-${line.x2}-${line.y2}`}
            d={`M ${line.x1} ${line.y1} C ${cx1} ${line.y1}, ${cx2} ${line.y2}, ${line.x2} ${line.y2}`}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.5"
            strokeOpacity="0.6"
            markerEnd="url(#arrow-head)"
          />
        );
      })}
      {dragPreviewLine && (
        <path
          d={`M ${dragPreviewLine.x1} ${dragPreviewLine.y1} C ${
            dragPreviewLine.x1 + (dragPreviewLine.x2 - dragPreviewLine.x1) * 0.4
          } ${dragPreviewLine.y1}, ${
            dragPreviewLine.x1 + (dragPreviewLine.x2 - dragPreviewLine.x1) * 0.6
          } ${dragPreviewLine.y2}, ${dragPreviewLine.x2} ${dragPreviewLine.y2}`}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeOpacity="0.9"
          strokeDasharray="5 3"
        />
      )}
    </svg>
  );
};
