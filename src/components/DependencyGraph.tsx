
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { DependencyGraphData, GraphNode as DepNode } from '@/lib/dependency-parser';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from './ui/button';
import { ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

interface Node extends DepNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
}

interface Edge {
  source: Node;
  target: Node;
}

const VIEWBOX_WIDTH = 1000;
const VIEWBOX_HEIGHT = 800;
const NODE_WIDTH = 160;
const NODE_HEIGHT = 32;

interface DependencyGraphProps {
  graphData: DependencyGraphData | null;
  highlightedNodeId: string | null;
  onNodeClick: (nodeId: string | null) => void;
}


const getEdgeEndpoints = (source: Node, target: Node) => {
  // Vector from source to target
  const dx = target.x - source.x;
  const dy = target.y - source.y;

  // Function to calculate intersection point on a node's boundary, relative to its center
  const calculateIntersection = (angle: number) => {
    const w = NODE_WIDTH / 2;
    const h = NODE_HEIGHT / 2;
    
    // Angle of the rectangle's corner diagonal
    const rectCornerAngle = Math.atan2(h, w);
    
    // The angle of the line from the node center, normalized to be between 0 and PI/2
    const lineAngle = Math.abs((angle % Math.PI + Math.PI) % Math.PI);

    let x, y;
    // Determine which side the line intersects based on its angle relative to the corner angle
    if (lineAngle > rectCornerAngle && lineAngle < Math.PI - rectCornerAngle) {
        // Intersects top or bottom side
        const sign = Math.sin(angle) > 0 ? 1 : -1;
        y = h * sign;
        x = y / Math.tan(angle);
    } else {
        // Intersects left or right side
        const sign = Math.cos(angle) > 0 ? 1 : -1;
        x = w * sign;
        y = x * Math.tan(angle);
    }

    return { x, y };
  };

  // Angle from source to target
  const angleToTarget = Math.atan2(dy, dx);
  // Angle from target to source
  const angleToSource = Math.atan2(-dy, -dx);

  const sourceOffset = calculateIntersection(angleToTarget);
  const targetOffset = calculateIntersection(angleToSource);
  
  // Return absolute coordinates
  return { 
    sourcePoint: { x: source.x + sourceOffset.x, y: source.y + sourceOffset.y },
    targetPoint: { x: target.x + targetOffset.x, y: target.y + targetOffset.y }
  };
};


export const DependencyGraph: React.FC<DependencyGraphProps> = ({ graphData, highlightedNodeId, onNodeClick }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [draggingNode, setDraggingNode] = useState<Node | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const isDark = useMemo(() => {
      if (!isClient) return false;
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, [isClient]);

  const runSimulation = useCallback((currentNodes: Node[], currentEdges: Edge[]) => {
    let newNodes: Node[] = JSON.parse(JSON.stringify(currentNodes));

    const nodeMap = new Map(newNodes.map((n: Node) => [n.id, n]));
    const simEdges = currentEdges.map(edge => ({
        source: nodeMap.get(edge.source.id)!,
        target: nodeMap.get(edge.target.id)!,
    }));
    
    if (simEdges.some(e => !e.source || !e.target)) return;

    const iterations = 250;
    const repulsionStrength = -5000;
    const attractionStrength = 0.3;
    const idealEdgeLength = 220;
    const centerGravity = 0.1;

    for (let k = 0; k < iterations; k++) {
        for (let i = 0; i < newNodes.length; i++) {
            const ni = newNodes[i];
            if (k === 0) { ni.vx = 0; ni.vy = 0; }
            const dxToCenter = VIEWBOX_WIDTH / 2 - ni.x;
            const dyToCenter = VIEWBOX_HEIGHT / 2 - ni.y;
            ni.vx += dxToCenter * centerGravity * 0.01;
            ni.vy += dyToCenter * centerGravity * 0.01;

            for (let j = i + 1; j < newNodes.length; j++) {
                const nj = newNodes[j];
                const dx = nj.x - ni.x;
                const dy = nj.y - ni.y;
                let distSq = dx * dx + dy * dy;
                if (distSq === 0) distSq = 0.1;
                const force = repulsionStrength / distSq;
                const forceX = (dx / Math.sqrt(distSq)) * force;
                const forceY = (dy / Math.sqrt(distSq)) * force;
                ni.vx += forceX; ni.vy += forceY;
                nj.vx -= forceX; nj.vy -= forceY;
            }
        }
        
        simEdges.forEach(edge => {
            const source = edge.source; const target = edge.target;
            const dx = target.x - source.x; const dy = target.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) return;
            const displacement = dist - idealEdgeLength;
            const force = attractionStrength * displacement * 0.1;
            const forceX = (dx / dist) * force; const forceY = (dy / dist) * force;
            source.vx += forceX; source.vy += forceY;
            target.vx -= forceX; target.vy -= forceY;
        });

        newNodes.forEach((node: Node) => {
            if (node.fx != null) { node.x = node.fx; node.vx = 0; } else { node.x += node.vx; }
            if (node.fy != null) { node.y = node.fy; node.vy = 0; } else { node.y += node.vy; }
            node.vx *= 0.90; node.vy *= 0.90;
            node.x = Math.max(NODE_WIDTH/2, Math.min(VIEWBOX_WIDTH - NODE_WIDTH/2, node.x));
            node.y = Math.max(NODE_HEIGHT/2, Math.min(VIEWBOX_HEIGHT - NODE_HEIGHT/2, node.y));
        });
    }

    setNodes(newNodes);
  }, []);

  const resetSimulation = useCallback(() => {
    if (!graphData) return;
    
    const initialNodes: Node[] = graphData.nodes.map(node => ({
      ...node,
      x: Math.random() * VIEWBOX_WIDTH * 0.6 + VIEWBOX_WIDTH * 0.2,
      y: Math.random() * VIEWBOX_HEIGHT* 0.6 + VIEWBOX_HEIGHT * 0.2,
      vx: 0, vy: 0,
    }));

    const nodeMap = new Map(initialNodes.map(n => [n.id, n]));
    const initialEdges: Edge[] = graphData.edges
      .map(({ source, target }) => ({ source: nodeMap.get(source)!, target: nodeMap.get(target)! }))
      .filter(edge => edge.source && edge.target);

    setEdges(initialEdges);
    runSimulation(initialNodes, initialEdges);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [graphData, runSimulation]);

  useEffect(() => { resetSimulation(); }, [graphData, resetSimulation]);
  
  const { highlightedNodes, highlightedEdges } = useMemo(() => {
    if (!highlightedNodeId || !graphData) {
      return { highlightedNodes: new Set<string>(), highlightedEdges: new Set<string>() };
    }
    const nodes = new Set<string>([highlightedNodeId]);
    const edgesSet = new Set<string>();
    graphData.edges.forEach(edge => {
      const edgeId = `${edge.source}->${edge.target}`;
      if (edge.source === highlightedNodeId) { nodes.add(edge.target); edgesSet.add(edgeId); }
      if (edge.target === highlightedNodeId) { nodes.add(edge.source); edgesSet.add(edgeId); }
    });
    return { highlightedNodes: nodes, highlightedEdges: edgesSet };
  }, [highlightedNodeId, graphData]);

  const handleMouseDown = (e: React.MouseEvent, node: Node) => {
    e.preventDefault(); e.stopPropagation();
    setDraggingNode({ ...node, vx: 0, vy: 0 });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingNode || !svgRef.current) return;
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return;
    const svgPoint = svgRef.current.createSVGPoint();
    svgPoint.x = e.clientX;
    svgPoint.y = e.clientY;
    const { x, y } = svgPoint.matrixTransform(CTM.inverse());
    setNodes(prevNodes => prevNodes.map(n => n.id === draggingNode.id ? { ...n, fx: x, fy: y, x, y } : n));
  }, [draggingNode]);

  const handleMouseUp = useCallback(() => {
    if (!draggingNode) return;
    const unpinnedNodes = nodes.map(n => n.id === draggingNode.id ? { ...n, fx: null, fy: null } : n);
    setDraggingNode(null);
    runSimulation(unpinnedNodes, edges);
  }, [draggingNode, nodes, edges, runSimulation]);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!draggingNode || !svgElement) return;
    const onMove = (e: MouseEvent) => handleMouseMove(e);
    const onUp = () => handleMouseUp();
    svgElement.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp, { once: true });
    return () => {
      svgElement.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draggingNode, handleMouseMove, handleMouseUp]);

  if (!graphData || nodes.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>의존성 그래프</CardTitle>
          <CardDescription>파일 간의 import 관계를 시각화합니다.</CardDescription>
        </CardHeader>
        <CardContent className="h-96 flex items-center justify-center text-muted-foreground">
          <p>그래프를 생성하기 위해 프로젝트를 로드해주세요.</p>
        </CardContent>
      </Card>
    );
  }
  
  const getShortName = (id: string) => id.split('/').pop() || id;

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle>의존성 그래프</CardTitle>
        <CardDescription>파일 간의 import 관계를 시각화합니다. 노드를 클릭하거나 드래그할 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow relative border rounded-md overflow-hidden bg-muted/20">
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <Button variant="outline" size="icon" onClick={() => setZoom(z => z * 1.2)}><ZoomIn/></Button>
          <Button variant="outline" size="icon" onClick={() => setZoom(z => z / 1.2)}><ZoomOut/></Button>
          <Button variant="outline" size="icon" onClick={resetSimulation}><RefreshCw/></Button>
        </div>
        <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}>
          <defs>
            <marker id="arrowhead" viewBox="-0 -4 8 8" refX="8" refY="0" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0,-4L8,0L0,4Z" fill="hsl(var(--border))" opacity="0.6" />
            </marker>
            <marker id="arrowhead-highlight" viewBox="-0 -4 8 8" refX="8" refY="0" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0,-4L8,0L0,4Z" fill="hsl(var(--primary))" opacity="1" />
            </marker>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="1" dy="2" stdDeviation="2" floodColor={isDark ? '#000000' : '#000000'} floodOpacity="0.2" />
            </filter>
          </defs>
          <rect width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="transparent" onClick={() => onNodeClick(null)} />
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {edges.map((edge, i) => {
              const edgeId = `${edge.source.id}->${edge.target.id}`;
              const isHighlighted = highlightedEdges.has(edgeId);
              const opacity = highlightedNodeId ? (isHighlighted ? 0.9 : 0.1) : 0.6;
              const { sourcePoint, targetPoint } = getEdgeEndpoints(edge.source, edge.target);

              return (
                <line
                  key={i}
                  x1={sourcePoint.x} y1={sourcePoint.y}
                  x2={targetPoint.x} y2={targetPoint.y}
                  stroke={isHighlighted ? "hsl(var(--primary))" : "hsl(var(--border))"}
                  strokeWidth={isHighlighted ? 1.5 / zoom : 0.8 / zoom}
                  style={{ opacity, transition: 'all 0.3s' }}
                  markerEnd={isHighlighted ? "url(#arrowhead-highlight)" : "url(#arrowhead)"}
                />
              );
            })}
            {nodes.map(node => {
              const isPrimary = node.id === highlightedNodeId;
              const isNeighbor = highlightedNodes.has(node.id) && !isPrimary;
              const opacity = highlightedNodeId ? (isPrimary || isNeighbor ? 1 : 0.2) : 1;
              const shortName = getShortName(node.id);
              return (
                <g 
                  key={node.id} 
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseDown={e => handleMouseDown(e, node)}
                  onClick={e => { e.stopPropagation(); onNodeClick(node.id); }}
                  className="cursor-pointer group"
                  style={{ opacity, transition: 'opacity 0.3s' }}
                  filter="url(#shadow)"
                >
                  <title>{node.id}</title>
                  <rect 
                    x={-NODE_WIDTH / 2} y={-NODE_HEIGHT / 2}
                    width={NODE_WIDTH} height={NODE_HEIGHT}
                    rx="8"
                    fill={isPrimary ? 'hsl(var(--primary))' : 'hsl(var(--card))'}
                    stroke={isPrimary ? 'hsl(var(--primary))' : isNeighbor ? 'hsl(var(--accent))' : 'hsl(var(--border))'}
                    strokeWidth={isPrimary ? 2 / zoom : 1 / zoom}
                    className="transition-colors"
                  />
                  <text
                    fill={isPrimary ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))'}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize="12"
                    className="pointer-events-none select-none font-medium transition-colors"
                    style={{ letterSpacing: '0.2px' }}
                  >
                    {shortName.length > 22 ? `${shortName.substring(0, 20)}...` : shortName}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
      </CardContent>
    </Card>
  );
};
