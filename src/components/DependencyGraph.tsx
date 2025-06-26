
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

const VIEWBOX_WIDTH = 1200;
const VIEWBOX_HEIGHT = 900;
const NODE_RADIUS = 50;

interface DependencyGraphProps {
  graphData: DependencyGraphData | null;
  highlightedNodeId: string | null;
  onNodeClick: (nodeId: string | null) => void;
}

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

    const iterations = 300;
    const repulsionStrength = -90000;
    const attractionStrength = 0.06; // Increased attraction
    const idealEdgeLength = 300; // Reduced length for tighter clusters
    const centerGravity = 0.02;

    for (let k = 0; k < iterations; k++) {
        for (let i = 0; i < newNodes.length; i++) {
            const ni = newNodes[i];
            if (k === 0) { ni.vx = 0; ni.vy = 0; }
            if (ni.fx == null) {
              const dxToCenter = VIEWBOX_WIDTH / 2 - ni.x;
              const dyToCenter = VIEWBOX_HEIGHT / 2 - ni.y;
              ni.vx += dxToCenter * centerGravity * 0.01;
              ni.vy += dyToCenter * centerGravity * 0.01;
            }


            for (let j = i + 1; j < newNodes.length; j++) {
                const nj = newNodes[j];
                const dx = nj.x - ni.x;
                const dy = nj.y - ni.y;
                let distSq = dx * dx + dy * dy;
                if (distSq === 0) distSq = 0.1;
                const force = repulsionStrength / distSq;
                const forceX = (dx / Math.sqrt(distSq)) * force;
                const forceY = (dy / Math.sqrt(distSq)) * force;
                if(ni.fx == null) {
                  ni.vx += forceX; ni.vy += forceY;
                }
                if(nj.fx == null) {
                  nj.vx -= forceX; nj.vy -= forceY;
                }
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
            if(source.fx == null) {
              source.vx += forceX; source.vy += forceY;
            }
            if(target.fx == null) {
              target.vx -= forceX; target.vy -= forceY;
            }
        });

        newNodes.forEach((node: Node) => {
            if (node.fx != null) { node.x = node.fx; node.vx = 0; } else { node.x += node.vx; }
            if (node.fy != null) { node.y = node.fy; node.vy = 0; } else { node.y += node.vy; }
            node.vx *= 0.95; node.vy *= 0.95;
            node.x = Math.max(NODE_RADIUS, Math.min(VIEWBOX_WIDTH - NODE_RADIUS, node.x));
            node.y = Math.max(NODE_RADIUS, Math.min(VIEWBOX_HEIGHT - NODE_RADIUS, node.y));
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
      fx: null, fy: null,
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
    
    setNodes(prevNodes => prevNodes.map(n => 
        n.id === draggingNode.id 
        ? { ...n, fx: x, fy: y, x: x, y: y }
        : n
    ));
  }, [draggingNode]);

  const handleMouseUp = useCallback(() => {
    if (draggingNode) {
        setNodes(prevNodes => prevNodes.map(n => 
            n.id === draggingNode.id ? { ...n, fx: n.x, fy: n.y } : n
        ));
        setDraggingNode(null);
    }
  }, [draggingNode]);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!draggingNode || !svgElement) return;

    const onMove = (e: MouseEvent) => handleMouseMove(e);
    const onUp = () => handleMouseUp();

    svgElement.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);

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
  
  const getShortName = (id: string) => {
    const parts = id.split('/');
    const name = parts.pop() || id;
    return name.replace(/\.(ts|js)x?$/, '');
  };

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
            <marker id="arrowhead" viewBox="-0 -5 10 10" refX="7" refY="0" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0,-5L10,0L0,5" fill="hsl(var(--border))" opacity="0.6" />
            </marker>
            <marker id="arrowhead-highlight" viewBox="-0 -5 10 10" refX="7" refY="0" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0,-5L10,0L0,5" fill="hsl(var(--primary))" opacity="1" />
            </marker>
            <radialGradient id="node-gradient" cx="30%" cy="30%" r="70%" fx="30%" fy="30%">
                <stop offset="0%" style={{stopColor: 'hsl(var(--card))', stopOpacity: 1}} />
                <stop offset="100%" style={{stopColor: 'hsl(var(--muted))', stopOpacity: 1}} />
            </radialGradient>
            <radialGradient id="node-gradient-primary" cx="30%" cy="30%" r="70%" fx="30%" fy="30%">
                <stop offset="0%" style={{stopColor: 'hsl(var(--primary))', stopOpacity: 1}} />
                <stop offset="100%" style={{stopColor: 'hsl(var(--primary) / 0.7)', stopOpacity: 1}} />
            </radialGradient>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="2" dy="3" stdDeviation="3" floodColor={isDark ? '#000' : '#000'} floodOpacity="0.2" />
            </filter>
          </defs>
          <rect width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="transparent" onClick={() => onNodeClick(null)} />
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {edges.map((edge, i) => {
              const edgeId = `${edge.source.id}->${edge.target.id}`;
              const isHighlighted = highlightedEdges.has(edgeId);
              const opacity = highlightedNodeId ? (isHighlighted ? 1 : 0.1) : 0.6;
              
              const dx = edge.target.x - edge.source.x;
              const dy = edge.target.y - edge.source.y;
              const dist = Math.sqrt(dx*dx + dy*dy);
              
              if (dist === 0) return null;

              const x1 = edge.source.x + (dx / dist) * NODE_RADIUS;
              const y1 = edge.source.y + (dy / dist) * NODE_RADIUS;
              const x2 = edge.target.x - (dx / dist) * (NODE_RADIUS + 5);
              const y2 = edge.target.y - (dy / dist) * (NODE_RADIUS + 5);

              return (
                <line
                  key={i}
                  x1={x1} y1={y1}
                  x2={x2} y2={y2}
                  stroke={isHighlighted ? "hsl(var(--primary))" : "hsl(var(--border))"}
                  strokeWidth={isHighlighted ? 2 / zoom : 0.75 / zoom}
                  style={{ opacity, transition: 'all 0.3s' }}
                  markerEnd={isHighlighted ? "url(#arrowhead-highlight)" : "url(#arrowhead)"}
                />
              );
            })}
            {nodes.map(node => {
              const isPrimary = node.id === highlightedNodeId;
              const isNeighbor = highlightedNodes.has(node.id) && !isPrimary;
              const opacity = highlightedNodeId ? (isPrimary || isNeighbor ? 1 : 0.3) : 1;
              const shortName = getShortName(node.id);
              
              const textLines = shortName.length > 10 
                  ? [shortName.substring(0, Math.ceil(shortName.length/2)), shortName.substring(Math.ceil(shortName.length/2))]
                  : [shortName];

              return (
                <g 
                  key={node.id} 
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseDown={e => handleMouseDown(e, node)}
                  onClick={e => { e.stopPropagation(); onNodeClick(node.id); }}
                  className="cursor-pointer group"
                  style={{ opacity, transition: 'opacity 0.3s' }}
                >
                  <title>{node.id}</title>
                  <circle
                    r={NODE_RADIUS}
                    fill={isPrimary ? "url(#node-gradient-primary)" : "url(#node-gradient)"}
                    stroke={isPrimary ? 'hsl(var(--primary))' : isNeighbor ? 'hsl(var(--accent))' : 'hsl(var(--border))'}
                    strokeWidth={isPrimary ? 2.5 / zoom : 1.5 / zoom}
                    className="transition-colors"
                    filter="url(#shadow)"
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={textLines.length > 1 ? "12px" : "14px"}
                    fontWeight="500"
                    fill={isPrimary ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))'}
                    className="pointer-events-none select-none transition-colors"
                    style={{ letterSpacing: '0.2px' }}
                  >
                    {textLines.map((line, index) => (
                       <tspan key={index} x="0" dy={index === 0 && textLines.length > 1 ? "-0.6em" : "1.2em"}>{line}</tspan>
                    ))}
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
