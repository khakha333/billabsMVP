
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
const NODE_WIDTH = 150;
const NODE_HEIGHT = 30;

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
  const simulationRef = useRef<number>();

  const resetSimulation = useCallback(() => {
    if (!graphData) return;
    
    const initialNodes: Node[] = graphData.nodes.map(node => ({
      ...node,
      x: Math.random() * VIEWBOX_WIDTH,
      y: Math.random() * VIEWBOX_HEIGHT,
      vx: 0,
      vy: 0,
    }));

    const nodeMap = new Map(initialNodes.map(n => [n.id, n]));
    const initialEdges: Edge[] = graphData.edges
      .map(({ source, target }) => ({
        source: nodeMap.get(source)!,
        target: nodeMap.get(target)!,
      }))
      .filter(edge => edge.source && edge.target);

    setNodes(initialNodes);
    setEdges(initialEdges);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [graphData]);

  useEffect(() => {
    resetSimulation();
  }, [graphData, resetSimulation]);

  const { highlightedNodes, highlightedEdges } = useMemo(() => {
    if (!highlightedNodeId || !graphData) {
      return { highlightedNodes: new Set<string>(), highlightedEdges: new Set<string>() };
    }
    const nodes = new Set<string>([highlightedNodeId]);
    const edges = new Set<string>();

    graphData.edges.forEach(edge => {
      const edgeId = `${edge.source}->${edge.target}`;
      if (edge.source === highlightedNodeId) {
        nodes.add(edge.target);
        edges.add(edgeId);
      }
      if (edge.target === highlightedNodeId) {
        nodes.add(edge.source);
        edges.add(edgeId);
      }
    });
    
    return { highlightedNodes: nodes, highlightedEdges: edges };
  }, [highlightedNodeId, graphData]);
  
  // Force-directed layout simulation
  useEffect(() => {
    if (edges.length === 0 || draggingNode) {
      if (simulationRef.current) cancelAnimationFrame(simulationRef.current);
      return;
    }

    const simulation = () => {
      setNodes(currentNodes => {
        if (currentNodes.length === 0) return [];
        
        const newNodes = currentNodes.map(n => ({ ...n }));

        const repulsionStrength = -3000;
        const attractionStrength = 0.6;
        const idealEdgeLength = 150;
        const centerGravity = 0.05;

        for (let i = 0; i < newNodes.length; i++) {
          const ni = newNodes[i];
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
            ni.vx += dx * force;
            ni.vy += dy * force;
            nj.vx -= dx * force;
            nj.vy -= dy * force;
          }
        }
        
        edges.forEach(edge => {
          const source = newNodes.find(n => n.id === edge.source.id)!;
          const target = newNodes.find(n => n.id === edge.target.id)!;
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist === 0) return;
          const displacement = dist - idealEdgeLength;
          const force = attractionStrength * displacement * 0.1;
          const forceX = (dx / dist) * force;
          const forceY = (dy / dist) * force;
          source.vx += forceX;
          source.vy += forceY;
          target.vx -= forceX;
          target.vy -= forceY;
        });

        newNodes.forEach(node => {
          if (node.fx != null) node.x = node.fx; else node.x += node.vx;
          if (node.fy != null) node.y = node.fy; else node.y += node.vy;
          node.vx *= 0.95;
          node.vy *= 0.95;
          node.x = Math.max(NODE_WIDTH/2, Math.min(VIEWBOX_WIDTH - NODE_WIDTH/2, node.x));
          node.y = Math.max(NODE_HEIGHT/2, Math.min(VIEWBOX_HEIGHT - NODE_HEIGHT/2, node.y));
        });

        return newNodes;
      });

      simulationRef.current = requestAnimationFrame(simulation);
    };

    simulationRef.current = requestAnimationFrame(simulation);
    return () => { if (simulationRef.current) cancelAnimationFrame(simulationRef.current); };
  }, [edges, draggingNode]);

  const handleMouseDown = (e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingNode(node);
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
    setNodes(prevNodes => prevNodes.map(n => n.id === draggingNode.id ? { ...n, fx: null, fy: null } : n));
    setDraggingNode(null);
  }, [draggingNode]);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!draggingNode || !svgElement) return;
    svgElement.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp, { once: true });
    return () => {
      svgElement.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
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
          <rect width={VIEWBOX_WIDTH} height={VIEWBOX_HEIGHT} fill="transparent" onClick={() => onNodeClick(null)} />
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {edges.map((edge, i) => {
              const edgeId = `${edge.source.id}->${edge.target.id}`;
              const isHighlighted = highlightedEdges.has(edgeId);
              const opacity = highlightedNodeId ? (isHighlighted ? 0.8 : 0.1) : 0.5;
              return (
                <line
                  key={i}
                  x1={edge.source.x}
                  y1={edge.source.y}
                  x2={edge.target.x}
                  y2={edge.target.y}
                  stroke="hsl(var(--border))"
                  strokeWidth={isHighlighted ? 2 / zoom : 1 / zoom}
                  style={{ opacity, transition: 'opacity 0.2s' }}
                />
              );
            })}
            {nodes.map(node => {
              const isPrimary = node.id === highlightedNodeId;
              const isNeighbor = highlightedNodes.has(node.id) && !isPrimary;
              const opacity = highlightedNodeId ? (isPrimary || isNeighbor ? 1 : 0.3) : 1;
              const shortName = getShortName(node.id);
              return (
                <g 
                  key={node.id} 
                  transform={`translate(${node.x}, ${node.y})`}
                  onMouseDown={e => handleMouseDown(e, node)}
                  onClick={e => { e.stopPropagation(); onNodeClick(node.id); }}
                  className="cursor-pointer"
                  style={{ opacity, transition: 'opacity 0.2s' }}
                >
                  <title>{node.id}</title>
                  <rect 
                    x={-NODE_WIDTH / 2} 
                    y={-NODE_HEIGHT / 2}
                    width={NODE_WIDTH} 
                    height={NODE_HEIGHT}
                    rx="8"
                    fill={isPrimary ? 'hsl(var(--primary))' : 'hsl(var(--card))'}
                    stroke={isPrimary ? 'hsl(var(--primary))' : isNeighbor ? 'hsl(var(--accent))' : 'hsl(var(--border))'}
                    strokeWidth={isPrimary ? 2 / zoom : 1 / zoom}
                  />
                  <text
                    fill={isPrimary ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))'}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="12"
                    className="pointer-events-none select-none font-medium"
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
