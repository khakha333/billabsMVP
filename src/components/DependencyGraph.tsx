
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
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

export const DependencyGraph: React.FC<{ graphData: DependencyGraphData | null }> = ({ graphData }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [draggingNode, setDraggingNode] = useState<Node | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
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
  
  // Force-directed layout simulation
  useEffect(() => {
    if (nodes.length === 0 || draggingNode) {
      if (simulationRef.current) {
        cancelAnimationFrame(simulationRef.current);
      }
      return;
    }

    const simulation = () => {
      setNodes(currentNodes => {
        const newNodes = currentNodes.map(n => ({ ...n }));

        // Forces
        const k = Math.sqrt((VIEWBOX_WIDTH * VIEWBOX_HEIGHT) / newNodes.length);
        const repulsionStrength = -2000;
        const attractionStrength = 0.5;
        const idealEdgeLength = 100;

        // Apply repulsion between all nodes
        for (let i = 0; i < newNodes.length; i++) {
          for (let j = i + 1; j < newNodes.length; j++) {
            const ni = newNodes[i];
            const nj = newNodes[j];
            const dx = nj.x - ni.x;
            const dy = nj.y - ni.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) dist = 0.1;
            
            const force = (repulsionStrength / (dist * dist));
            const forceX = (dx / dist) * force;
            const forceY = (dy / dist) * force;

            ni.vx += forceX;
            ni.vy += forceY;
            nj.vx -= forceX;
            nj.vy -= forceY;
          }
        }
        
        // Apply attraction along edges
        for (const edge of edges) {
          const source = newNodes.find(n => n.id === edge.source.id)!;
          const target = newNodes.find(n => n.id === edge.target.id)!;
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const displacement = dist - idealEdgeLength;
          const force = attractionStrength * displacement;
          const forceX = (dx / dist) * force;
          const forceY = (dy / dist) * force;

          source.vx += forceX;
          source.vy += forceY;
          target.vx -= forceX;
          target.vy -= forceY;
        }

        // Update positions
        newNodes.forEach(node => {
          if (node.fx != null) {
            node.x = node.fx;
            node.vx = 0;
          } else {
            node.x += node.vx;
          }
          if (node.fy != null) {
            node.y = node.fy;
            node.vy = 0;
          } else {
            node.y += node.vy;
          }

          // Damping
          node.vx *= 0.95;
          node.vy *= 0.95;
          
          // Boundary check
          node.x = Math.max(10, Math.min(VIEWBOX_WIDTH - 10, node.x));
          node.y = Math.max(10, Math.min(VIEWBOX_HEIGHT - 10, node.y));
        });

        return newNodes;
      });

      simulationRef.current = requestAnimationFrame(simulation);
    };

    simulationRef.current = requestAnimationFrame(simulation);

    return () => {
      if (simulationRef.current) {
        cancelAnimationFrame(simulationRef.current);
      }
    };
  }, [nodes, edges, draggingNode]);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>, node: Node) => {
    e.preventDefault();
    setDraggingNode(node);
    if(simulationRef.current) cancelAnimationFrame(simulationRef.current);
  };
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingNode || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    setNodes(prevNodes =>
      prevNodes.map(n => {
        if (n.id === draggingNode.id) {
          return { ...n, fx: x, fy: y, x: x, y: y };
        }
        return n;
      })
    );
  }, [draggingNode, zoom, pan.x, pan.y]);

  const handleMouseUp = useCallback(() => {
    if (!draggingNode) return;
    setNodes(prevNodes => prevNodes.map(n => n.id === draggingNode.id ? { ...n, fx: null, fy: null } : n));
    setDraggingNode(null);
  }, [draggingNode]);

  useEffect(() => {
    if (!draggingNode) return;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
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
        <CardDescription>파일 간의 import 관계를 시각화합니다. 노드를 드래그할 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow relative border rounded-md overflow-hidden" ref={containerRef}>
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <Button variant="outline" size="icon" onClick={() => setZoom(z => z * 1.2)}><ZoomIn/></Button>
          <Button variant="outline" size="icon" onClick={() => setZoom(z => z / 1.2)}><ZoomOut/></Button>
          <Button variant="outline" size="icon" onClick={resetSimulation}><RefreshCw/></Button>
        </div>
        <div className='w-full h-full'>
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            className="bg-muted/20"
          >
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {edges.map((edge, i) => (
                <line
                  key={i}
                  x1={edge.source.x}
                  y1={edge.source.y}
                  x2={edge.target.x}
                  y2={edge.target.y}
                  stroke="hsl(var(--border))"
                  strokeWidth={1 / zoom}
                />
              ))}
            </g>
          </svg>
          <div className="absolute inset-0 pointer-events-none">
            <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', width: `${VIEWBOX_WIDTH}px`, height: `${VIEWBOX_HEIGHT}px` }}>
              {nodes.map(node => (
                <div
                  key={node.id}
                  onMouseDown={e => handleMouseDown(e, node)}
                  className="absolute bg-card border rounded-md px-2 py-1 text-xs shadow-md cursor-grab active:cursor-grabbing pointer-events-auto"
                  style={{
                    left: `${node.x}px`,
                    top: `${node.y}px`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  title={node.id}
                >
                  {getShortName(node.id)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
