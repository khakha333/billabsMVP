
"use client";

import * as React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';

interface ProjectVisualizationProps {
  fileMap: Map<string, string> | null;
}

const getExtension = (filename: string) => {
  return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
};

const LANGUAGE_COLORS: { [key: string]: string } = {
  js: '#f0db4f',
  ts: '#007acc',
  tsx: '#29c4ff',
  jsx: '#61dafb',
  py: '#3572A5',
  java: '#b07219',
  html: '#e34c26',
  css: '#563d7c',
  json: '#d4d4d4',
  md: '#ffffff',
  sh: '#4d5a5e',
  yml: '#cb171e',
  yaml: '#cb171e',
  dockerfile: '#384d54',
  gitignore: '#f05033',
  npmrc: '#CB3837',
  other: '#808080',
};

export const ProjectVisualization: React.FC<ProjectVisualizationProps> = ({ fileMap }) => {
  const chartData = React.useMemo(() => {
    if (!fileMap) return [];
    
    const extensionCounts: { [key: string]: number } = {};
    
    Array.from(fileMap.keys()).forEach(path => {
      let ext = getExtension(path);
      if (path.toLowerCase().endsWith('dockerfile')) ext = 'dockerfile';
      if (path.toLowerCase().endsWith('.gitignore')) ext = 'gitignore';
      if (path.toLowerCase().endsWith('.npmrc')) ext = 'npmrc';

      ext = ext.toLowerCase() || 'other';
      if (extensionCounts[ext]) {
        extensionCounts[ext]++;
      } else {
        extensionCounts[ext] = 1;
      }
    });

    return Object.entries(extensionCounts)
      .map(([name, value]) => ({ name, value, fill: LANGUAGE_COLORS[name] || LANGUAGE_COLORS.other }))
      .sort((a, b) => b.value - a.value);
  }, [fileMap]);

  if (!fileMap || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>시각화할 파일 데이터가 없습니다.</p>
      </div>
    );
  }

  const chartConfig = Object.fromEntries(chartData.map(item => [item.name, { label: item.name.toUpperCase() }]));

  return (
    <ChartContainer config={chartConfig} className="w-full h-full min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Tooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                    data={chartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    labelLine={false}
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                        const RADIAN = Math.PI / 180;
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        return (percent * 100) > 5 ? (
                            <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="12px">
                                {`${(percent * 100).toFixed(0)}%`}
                            </text>
                        ) : null;
                    }}
                >
                    {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                </Pie>
                <Legend layout="horizontal" verticalAlign="bottom" align="center" iconSize={10} wrapperStyle={{fontSize: '12px', paddingBottom: '10px' }} />
            </PieChart>
        </ResponsiveContainer>
    </ChartContainer>
  );
};
