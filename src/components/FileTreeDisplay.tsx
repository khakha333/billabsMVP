"use client";

import * as React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Folder, FileText } from 'lucide-react';

interface TreeNode {
  [key: string]: TreeNode | null;
}

interface FileTreeProps {
  tree: TreeNode;
  onFileSelect: (path: string) => void;
  selectedFile: string | null;
  pathPrefix?: string;
}

export const FileTreeDisplay: React.FC<FileTreeProps> = ({ tree, onFileSelect, selectedFile, pathPrefix = '' }) => {
  const sortedKeys = Object.keys(tree).sort((a, b) => {
    const aIsDir = tree[a] !== null;
    const bIsDir = tree[b] !== null;
    if (aIsDir && !bIsDir) return -1; // directories first
    if (!aIsDir && bIsDir) return 1;
    return a.localeCompare(b); // then sort alphabetically
  });

  return (
    <div className="w-full">
      {sortedKeys.map(key => {
        const currentPath = pathPrefix ? `${pathPrefix}/${key}` : key;
        const isDir = tree[key] !== null;

        if (isDir) {
          return (
            <Accordion type="single" collapsible key={currentPath} className="w-full">
              <AccordionItem value={currentPath} className="border-none">
                <AccordionTrigger className="py-1 px-2 hover:bg-muted rounded-md text-sm font-normal">
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-accent" />
                    <span>{key}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pl-4 pt-1">
                  <FileTreeDisplay
                    tree={tree[key]!}
                    onFileSelect={onFileSelect}
                    selectedFile={selectedFile}
                    pathPrefix={currentPath}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          );
        } else {
          return (
            <div key={currentPath} className="pl-5">
              <Button
                variant={selectedFile === currentPath ? "secondary" : "ghost"}
                size="sm"
                className="w-full justify-start h-auto py-1 font-normal"
                onClick={() => onFileSelect(currentPath)}
              >
                <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="truncate">{key}</span>
              </Button>
            </div>
          );
        }
      })}
    </div>
  );
};
