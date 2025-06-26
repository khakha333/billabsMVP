
"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { DependencyGraphData, GraphNode as DepNode } from '@/lib/dependency-parser';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from './ui/button';
import { ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';

interface Node extends DepNode {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Directory {
  path: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: (Node | Directory)[];
  files: Node[];
  subdirectories: Directory[];
}

interface DependencyGraphProps {
  graphData: DependencyGraphData | null;
  highlightedNodeId: string | null;
  onNodeClick: (nodeId: string | null) => void;
  highlightedNeighbors?: Set<string> | null;
}

const PADDING = 20;
const NODE_WIDTH = 180;
const NODE_HEIGHT = 40;
const NODE_MARGIN_X = 20;
const NODE_MARGIN_Y = 15;
const DIR_HEADER_HEIGHT = 40;

const CATEGORY_COLORS: { [key: string]: { bg: string; text: string } } = {
  component: { bg: 'hsl(210, 100%, 95%)', text: 'hsl(210, 80%, 30%)' },
  hook: { bg: 'hsl(140, 100%, 95%)', text: 'hsl(140, 70%, 30%)' },
  route: { bg: 'hsl(260, 100%, 97%)', text: 'hsl(260, 70%, 40%)' },
  utility: { bg: 'hsl(0, 0%, 95%)', text: 'hsl(0, 0%, 40%)' },
  other: { bg: 'hsl(30, 100%, 95%)', text: 'hsl(30, 70%, 40%)' },
};
const DARK_CATEGORY_COLORS: { [key: string]: { bg: string; text: string } } = {
    component: { bg: 'hsl(210, 50%, 20%)', text: 'hsl(210, 100%, 85%)' },
    hook: { bg: 'hsl(140, 50%, 20%)', text: 'hsl(140, 100%, 85%)' },
    route: { bg: 'hsl(260, 50%, 25%)', text: 'hsl(260, 100%, 90%)' },
    utility: { bg: 'hsl(0, 0%, 25%)', text: 'hsl(0, 0%, 70%)' },
    other: { bg: 'hsl(30, 50%, 25%)', text: 'hsl(30, 100%, 85%)' },
};


export const DependencyGraph: React.FC<DependencyGraphProps> = ({ graphData, highlightedNodeId, onNodeClick, highlightedNeighbors }) => {
  const [layout, setLayout] = useState<{ directories: Directory[], nodes: Map<string, Node>, viewBox: {width: number, height: number} } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => { setIsClient(true); }, []);

  const isDark = useMemo(() => {
    if (!isClient) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, [isClient]);

  const colors = isDark ? DARK_CATEGORY_COLORS : CATEGORY_COLORS;

  const calculateLayout = useCallback((data: DependencyGraphData) => {
    const root: Omit<Directory, 'path' | 'x' | 'y' | 'width' | 'height'> = { children: [], files: [], subdirectories: [] };
    const nodeMap = new Map<string, Node>();

    const dirMap = new Map<string, Directory>();
    data.nodes.forEach(node => {
      const pathSegments = node.id.split('/');
      pathSegments.pop(); // remove filename
      let currentPath = '';
      let parentDir: Directory | Omit<Directory, 'path' | 'x' | 'y' | 'width' | 'height'> = root;

      pathSegments.forEach(segment => {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;
        if (!dirMap.has(currentPath)) {
          const newDir: Directory = {
            path: currentPath, x: 0, y: 0, width: 0, height: 0,
            children: [], files: [], subdirectories: []
          };
          dirMap.set(currentPath, newDir);
          (parentDir.children as (Directory|Node)[]).push(newDir);
          parentDir.subdirectories.push(newDir);
        }
        parentDir = dirMap.get(currentPath)!;
      });
      
      const newNode: Node = { ...node, x: 0, y: 0, width: NODE_WIDTH, height: NODE_HEIGHT };
      nodeMap.set(node.id, newNode);
      (parentDir.children as (Directory|Node)[]).push(newNode);
      parentDir.files.push(newNode);
    });

    const positionItem = (item: Directory | Node): { width: number; height: number } => {
        if ('path' in item) { // It's a Directory
            let subdirectoriesTotalWidth = item.subdirectories.length > 0 ? (item.subdirectories.length - 1) * PADDING : 0;
            let maxSubdirectoryHeight = 0;
            item.subdirectories.forEach(sub => {
                const dim = positionItem(sub);
                subdirectoriesTotalWidth += dim.width;
                maxSubdirectoryHeight = Math.max(maxSubdirectoryHeight, dim.height);
            });
    
            const FILES_PER_ROW = Math.max(1, Math.floor((subdirectoriesTotalWidth || 300) / (NODE_WIDTH + NODE_MARGIN_X)));
            const fileRows = Math.ceil(item.files.length / FILES_PER_ROW);
            const fileGridWidth = item.files.length > 0 ? Math.min(item.files.length, FILES_PER_ROW) * (NODE_WIDTH + NODE_MARGIN_X) - NODE_MARGIN_X : 0;
            const fileGridHeight = item.files.length > 0 ? fileRows * (NODE_HEIGHT + NODE_MARGIN_Y) - NODE_MARGIN_Y : 0;
    
            item.width = Math.max(subdirectoriesTotalWidth, fileGridWidth) + 2 * PADDING;
            const subdirectoriesY = DIR_HEADER_HEIGHT;
            const filesY = subdirectoriesY + (item.subdirectories.length > 0 ? maxSubdirectoryHeight + PADDING : 0);
            item.height = filesY + fileGridHeight + (item.files.length > 0 ? PADDING : 0);
    
            // Position children
            let currentSubdirX = PADDING;
            item.subdirectories.forEach(sub => {
                sub.x = currentSubdirX;
                sub.y = subdirectoriesY;
                currentSubdirX += sub.width + PADDING;
            });
    
            item.files.forEach((file, i) => {
                const row = Math.floor(i / FILES_PER_ROW);
                const col = i % FILES_PER_ROW;
                file.x = PADDING + col * (NODE_WIDTH + NODE_MARGIN_X);
                file.y = filesY + row * (NODE_HEIGHT + NODE_MARGIN_Y);
            });
    
            return { width: item.width, height: item.height };
        } else { // It's a Node
            return { width: NODE_WIDTH, height: NODE_HEIGHT };
        }
    };
    
    let currentX = PADDING;
    root.subdirectories.forEach(dir => {
        dir.x = currentX;
        dir.y = PADDING;
        const { width } = positionItem(dir);
        currentX += width + PADDING;
    });

    const setAbsolutePositions = (item: Directory | Node, parentX: number, parentY: number) => {
        item.x += parentX;
        item.y += parentY;
        if ('path' in item) {
            item.children.forEach(child => setAbsolutePositions(child, item.x, item.y));
        }
    };

    root.children.forEach(child => setAbsolutePositions(child, 0, 0));
    
    const viewBoxWidth = Math.max(currentX, 1200);
    const viewBoxHeight = Math.max(root.children.reduce((maxH, item) => Math.max(maxH, item.y + item.height), 0) + PADDING, 900);

    setLayout({ directories: root.subdirectories, nodes: nodeMap, viewBox: { width: viewBoxWidth, height: viewBoxHeight }});
  }, []);

  useEffect(() => {
    if (graphData) {
      calculateLayout(graphData);
      setPan({x: 0, y: 0});
      setZoom(1);
    }
  }, [graphData, calculateLayout]);

  const { visibleNodes, visibleEdges } = useMemo(() => {
    if (!highlightedNodeId || !graphData) {
      return { visibleNodes: new Set<string>(), visibleEdges: new Set<string>() };
    }
    const nodes = new Set<string>([highlightedNodeId]);
    const edgesSet = new Set<string>();

    const neighborsToHighlight = highlightedNeighbors ?? new Set(
        graphData.edges
            .filter(edge => edge.source === highlightedNodeId || edge.target === highlightedNodeId)
            .map(edge => edge.source === highlightedNodeId ? edge.target : edge.source)
    );

    neighborsToHighlight.forEach(neighbor => nodes.add(neighbor));
    
    graphData.edges.forEach(edge => {
      const edgeId = `${edge.source}->${edge.target}`;
      if (
        (nodes.has(edge.source) && nodes.has(edge.target)) && // Both nodes must be visible
        (
            (edge.source === highlightedNodeId && neighborsToHighlight.has(edge.target)) || 
            (edge.target === highlightedNodeId && neighborsToHighlight.has(edge.source)) ||
            (highlightedNeighbors && highlightedNeighbors.has(edge.source) && highlightedNeighbors.has(edge.target))
        )
      ) {
         edgesSet.add(edgeId);
      }
    });

    return { visibleNodes: nodes, visibleEdges: edgesSet };
  }, [highlightedNodeId, highlightedNeighbors, graphData]);

  const renderDirectory = (dir: Directory) => (
    <React.Fragment key={dir.path}>
        <rect
            x={dir.x} y={dir.y}
            width={dir.width} height={dir.height}
            rx="8" ry="8"
            fill={isDark ? 'hsla(0, 0%, 100%, 0.03)' : 'hsla(0, 0%, 0%, 0.02)'}
            stroke={isDark ? 'hsla(0, 0%, 100%, 0.1)' : 'hsla(0, 0%, 0%, 0.1)'}
            strokeWidth="1"
        />
        <text
            x={dir.x + PADDING} y={dir.y + PADDING + 5}
            fontSize="14" fontWeight="500"
            fill={isDark ? 'hsl(0, 0%, 70%)' : 'hsl(0, 0%, 40%)'}
            className="select-none"
        >
            {dir.path}
        </text>
        {dir.subdirectories.map(renderDirectory)}
        {dir.files.map(renderNode)}
    </React.Fragment>
  );

  const renderNode = (node: Node) => {
    const isPrimary = node.id === highlightedNodeId;
    const isNeighbor = highlightedNeighbors ? highlightedNeighbors.has(node.id) : visibleNodes.has(node.id);
    const opacity = highlightedNodeId ? (isPrimary || isNeighbor ? 1 : 0.2) : 1;
    const color = colors[node.category] || colors['other'];
    const shortName = node.id.split('/').pop() || '';
    
    return (
        <g
            key={node.id}
            transform={`translate(${node.x}, ${node.y})`}
            onClick={() => onNodeClick(node.id)}
            className="cursor-pointer group"
            style={{ opacity, transition: 'opacity 0.2s' }}
        >
            <title>{node.id}</title>
            <rect
                width={node.width} height={node.height}
                rx="4" ry="4"
                fill={color.bg}
                stroke={isPrimary ? 'hsl(var(--primary))' : color.text}
                strokeWidth={isPrimary ? 2 : 1}
            />
            <text
                x={node.width / 2} y={node.height / 2}
                textAnchor="middle" dominantBaseline="central"
                fill={color.text}
                fontSize="12"
                fontWeight="500"
                className="select-none pointer-events-none"
            >
                {shortName}
            </text>
        </g>
    );
  };
  
  if (!graphData || !layout) {
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

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle>의존성 그래프</CardTitle>
        <CardDescription>파일 간의 import 관계를 시각화합니다. 노드를 클릭하여 연결성을 확인하세요.</CardDescription>
      </CardHeader>
      <CardContent className="flex-grow relative border rounded-md overflow-hidden bg-muted/20">
        <div className="absolute top-2 right-2 z-10 flex gap-1">
          <Button variant="outline" size="icon" onClick={() => setZoom(z => z * 1.2)}><ZoomIn/></Button>
          <Button variant="outline" size="icon" onClick={() => setZoom(z => z / 1.2)}><ZoomOut/></Button>
          <Button variant="outline" size="icon" onClick={() => calculateLayout(graphData)}><RefreshCw/></Button>
        </div>
        <svg ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${layout.viewBox.width} ${layout.viewBox.height}`}>
           <defs>
              <marker id="arrowhead" viewBox="-0 -5 10 10" refX="8" refY="0" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                <path d="M0,-5L10,0L0,5" fill="hsl(var(--border))" opacity="0.6" />
              </marker>
              <marker id="arrowhead-highlight" viewBox="-0 -5 10 10" refX="8" refY="0" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
                <path d="M0,-5L10,0L0,5" fill="hsl(var(--primary))" opacity="1" />
              </marker>
            </defs>
          <rect width={layout.viewBox.width} height={layout.viewBox.height} fill="transparent" onClick={() => onNodeClick(null)} />
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Edge Rendering */}
            <g>
                {graphData.edges.map(edge => {
                    const sourceNode = layout.nodes.get(edge.source);
                    const targetNode = layout.nodes.get(edge.target);
                    if (!sourceNode || !targetNode) return null;

                    const edgeId = `${edge.source}->${edge.target}`;
                    const isHighlighted = visibleEdges.has(edgeId);
                    const opacity = highlightedNodeId ? (isHighlighted ? 0.9 : 0.1) : 0.4;
                    
                    const p1 = {
                        x: sourceNode.x + sourceNode.width,
                        y: sourceNode.y + sourceNode.height / 2
                    };
                    const p2 = {
                        x: targetNode.x,
                        y: targetNode.y + targetNode.height / 2
                    };
                    
                    const controlPointX1 = p1.x + 60;
                    const controlPointY1 = p1.y;
                    const controlPointX2 = p2.x - 60;
                    const controlPointY2 = p2.y;
                    
                    const pathData = `M ${p1.x} ${p1.y} C ${controlPointX1} ${controlPointY1}, ${controlPointX2} ${controlPointY2}, ${p2.x} ${p2.y}`;

                    return (
                        <path
                            key={edgeId}
                            d={pathData}
                            stroke={isHighlighted ? "hsl(var(--primary))" : "hsl(var(--border))"}
                            strokeWidth={isHighlighted ? 1.5 : 1}
                            fill="none"
                            style={{ opacity, transition: 'opacity 0.2s' }}
                            markerEnd={isHighlighted ? "url(#arrowhead-highlight)" : "url(#arrowhead)"}
                        />
                    );
                })}
            </g>

            {/* Directory Rendering */}
            {layout.directories.map(renderDirectory)}
          </g>
        </svg>
      </CardContent>
    </Card>
  );
};
