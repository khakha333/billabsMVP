'use server';
/**
 * @fileOverview Fetches all text-based files from a GitHub repository and concatenates them.
 *
 * - analyzeGithubRepository - Fetches and combines code from a GitHub repository.
 * - AnalyzeGithubRepositoryInput - The input type for the flow.
 * - AnalyzeGithubRepositoryOutput - The return type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeGithubRepositoryInputSchema = z.object({
  repositoryUrl: z.string().url().describe('The URL of the GitHub repository.'),
});
export type AnalyzeGithubRepositoryInput = z.infer<typeof AnalyzeGithubRepositoryInputSchema>;

const AnalyzeGithubRepositoryOutputSchema = z.object({
  combinedCode: z.string().describe('A single string containing the path and content of all fetched files.'),
  fileCount: z.number().describe('The number of files fetched from the repository.'),
  error: z.string().optional().describe('An error message if fetching failed.'),
});
export type AnalyzeGithubRepositoryOutput = z.infer<typeof AnalyzeGithubRepositoryOutputSchema>;

export async function analyzeGithubRepository(input: AnalyzeGithubRepositoryInput): Promise<AnalyzeGithubRepositoryOutput> {
  return analyzeGithubRepositoryFlow(input);
}

// Helper function defined within the module scope
async function processTree(treeData: any, owner: string, repo: string, branch: string): Promise<AnalyzeGithubRepositoryOutput> {
    if (treeData.truncated) {
        console.warn(`Repository tree for ${owner}/${repo} is truncated. Some files may be missing.`);
    }

    const textFileExtensions = [
        '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs', '.swift', 
        '.kt', '.kts', '.html', '.css', '.json', '.md', '.txt', 'Dockerfile', '.yml', '.yaml', '.sh', '.gitignore', '.npmrc', '.env.example'
    ];
    
    // Some common files without extensions
    const textFileNames = ['LICENSE', 'README'];

    const filesToFetch = treeData.tree
        .filter((node: any) => 
            node.type === 'blob' && 
            (
                textFileNames.some(name => node.path.toLowerCase().endsWith(name.toLowerCase())) ||
                textFileExtensions.some(ext => node.path.endsWith(ext))
            )
        )
        .slice(0, 100); // Limit to first 100 text files to avoid being overwhelmed.

    let combinedCode = `// GitHub 저장소: https://github.com/${owner}/${repo}\n// ======================================\n\n`;
    
    const fetchPromises = filesToFetch.map(async (file: any) => {
        const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`;
        try {
            const response = await fetch(rawUrl);
            if (response.ok) {
                const content = await response.text();
                // Avoid huge files
                if (content.length > 200000) { // 200KB limit per file
                    return `// FILE: ${file.path}\n// --------------------------------------\n// 파일이 너무 커서 내용을 생략합니다. (200KB 이상)\n\n`;
                }
                return `// FILE: ${file.path}\n// --------------------------------------\n${content}\n\n`;
            }
        } catch (e) {
            console.error(`Failed to fetch ${rawUrl}:`, e);
        }
        return ''; // Return empty string on failure
    });

    const fileContents = await Promise.all(fetchPromises);
    combinedCode += fileContents.join('');

    return { combinedCode, fileCount: filesToFetch.length, error: undefined };
}


const analyzeGithubRepositoryFlow = ai.defineFlow(
  {
    name: 'analyzeGithubRepositoryFlow',
    inputSchema: AnalyzeGithubRepositoryInputSchema,
    outputSchema: AnalyzeGithubRepositoryOutputSchema,
  },
  async ({repositoryUrl}) => {
    try {
      const url = new URL(repositoryUrl);
      const pathParts = url.pathname.split('/').filter(Boolean);
      if (url.hostname !== 'github.com' || pathParts.length < 2) {
        return { combinedCode: '', fileCount: 0, error: '유효한 GitHub 저장소 URL이 아닙니다 (예: https://github.com/owner/repo).' };
      }
      const owner = pathParts[0];
      const repo = pathParts[1];
      
      // Try 'main' branch first
      const mainTreeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`);
      if (mainTreeResponse.ok) {
        const treeData = await mainTreeResponse.json();
        return processTree(treeData, owner, repo, 'main');
      }

      // Fallback to 'master' branch
      const masterTreeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`);
      if (masterTreeResponse.ok) {
        const treeData = await masterTreeResponse.json();
        return processTree(treeData, owner, repo, 'master');
      }

      throw new Error(`저장소 파일 목록을 가져오는데 실패했습니다. (main/master 브랜치를 찾을 수 없음) 응답 상태: ${mainTreeResponse.status}`);

    } catch (e) {
      const error = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.';
      console.error("Error analyzing GitHub repository:", error);
      return { combinedCode: '', fileCount: 0, error };
    }
  }
);
