
export interface GraphNode {
  id: string; // file path
  category: 'component' | 'hook' | 'route' | 'utility' | 'other';
}

export interface GraphEdge {
  source: string; // source file path
  target: string; // target file path
}

export interface DependencyGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Basic regex to find static imports. This won't catch dynamic imports.
const IMPORT_REGEX = /import(?:[\s\S]*?)from\s*['"]((@\/|(?:\.\/|\.\.\/))[^'"]+)['"]/g;

/**
 * Resolves a relative path from a base path, handling `.` and `..`.
 * @param basePath The path of the file containing the import.
 * @param relativePath The path from the import statement.
 * @returns The resolved absolute path from the project root.
 */
function resolveImportPath(basePath: string, relativePath: string): string {
    const baseSegments = basePath.split('/').slice(0, -1); // equivalent to dirname
    const relativeSegments = relativePath.split('/');
    const resolvedSegments = [...baseSegments];

    for (const segment of relativeSegments) {
        if (segment === '..') {
            resolvedSegments.pop();
        } else if (segment !== '.' && segment !== '') {
            resolvedSegments.push(segment);
        }
    }
    return resolvedSegments.join('/');
}

function getNodeCategory(path: string): GraphNode['category'] {
    const lowerPath = path.toLowerCase();
    if (lowerPath.includes('/components/')) return 'component';
    if (lowerPath.includes('/hooks/') || lowerPath.includes('/queries/')) return 'hook';
    if (lowerPath.includes('/pages/') || lowerPath.includes('/app/') || lowerPath.includes('/routes/')) return 'route';
    if (lowerPath.includes('/lib/') || lowerPath.includes('/utils/') || lowerPath.includes('/helpers/')) return 'utility';
    return 'other';
}


export function parseDependencies(fileMap: Map<string, string>): DependencyGraphData {
  const nodes: GraphNode[] = Array.from(fileMap.keys()).map(p => ({ 
      id: p,
      category: getNodeCategory(p),
  }));
  const edges: GraphEdge[] = [];
  const filePaths = new Set(fileMap.keys());

  for (const [filePath, content] of fileMap.entries()) {
    let match;
    while ((match = IMPORT_REGEX.exec(content)) !== null) {
      const importPath = match[1];
      
      let targetPath: string;

      if (importPath.startsWith('@/')) {
        // Resolve alias path
        targetPath = importPath.replace('@/', 'src/');
      } else {
        // Resolve relative path
        targetPath = resolveImportPath(filePath, importPath);
      }
      
      // Check for extensions .ts, .tsx, .js, .jsx or index files
      let resolvedTargetPath = null;
      const potentialExtensions = ['', '.ts', '.tsx', '.js', '.jsx', '.json'];
      const potentialPaths = potentialExtensions.flatMap(ext => [
          `${targetPath}${ext}`,
          `${targetPath}/index${ext}`
      ]);
      
      for (const p of potentialPaths) {
          if (filePaths.has(p)) {
              resolvedTargetPath = p;
              break;
          }
      }

      if (resolvedTargetPath && resolvedTargetPath !== filePath) {
        // Avoid self-loops for now
        const existingEdge = edges.find(
          edge => edge.source === filePath && edge.target === resolvedTargetPath
        );
        if (!existingEdge) {
          edges.push({ source: filePath, target: resolvedTargetPath });
        }
      }
    }
  }

  return { nodes, edges };
}
