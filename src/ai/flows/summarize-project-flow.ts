'use server';
/**
 * @fileOverview Provides a high-level summary of an entire software project.
 *
 * - summarizeProject - A function that analyzes combined source code to generate a project overview.
 * - SummarizeProjectInput - The input type for the flow.
 * - SummarizeProjectOutput - The return type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SummarizeProjectInputSchema = z.object({
  combinedCode: z
    .string()
    .describe('A single string containing the path and content of all files in the project.'),
});
export type SummarizeProjectInput = z.infer<typeof SummarizeProjectInputSchema>;

const SummarizeProjectOutputSchema = z.object({
  projectName: z.string().describe("A suitable name for the project, derived from its content (e.g., 'E-commerce Site', 'AI Chatbot'). In Korean."),
  summary: z
    .string()
    .describe("A high-level, one-paragraph summary of the project's purpose and what it does. In Korean."),
  keyFeatures: z
    .array(z.string())
    .describe('A list of 3-5 key features or functionalities of the project. In Korean.'),
  architecture: z
    .string()
    .describe("A brief description of the project's architecture and the main technologies used (framework, UI library, AI provider, etc.). In Korean."),
  gettingStarted: z
    .string()
    .describe('A suggestion for a new developer on which file to look at first to understand the project. In Korean.'),
});
export type SummarizeProjectOutput = z.infer<typeof SummarizeProjectOutputSchema>;

export async function summarizeProject(
  input: SummarizeProjectInput
): Promise<SummarizeProjectOutput> {
  return summarizeProjectFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeProjectPrompt',
  input: {schema: SummarizeProjectInputSchema},
  output: {schema: SummarizeProjectOutputSchema},
  prompt: `You are a senior software architect. Your task is to analyze the complete source code of a project provided as a single text block and generate a high-level overview.

Based on the code below, please provide the following, with all descriptions in Korean:
1.  **Project Name**: Give the project a descriptive name based on its functionality.
2.  **Summary**: A concise, one-paragraph overview of the project's main purpose.
3.  **Key Features**: A bulleted list of 3 to 5 primary features.
4.  **Architecture**: A brief description of the tech stack and architecture (e.g., Next.js App Router, Tailwind CSS, Genkit with Google AI, etc.).
5.  **Getting Started**: Recommend a key file or two for a new developer to start with to understand the codebase.

The combined source code is provided below. Each file is prefixed with a \`// FILE: [path]\` marker.

\`\`\`
{{{combinedCode}}}
\`\`\`

Provide the output in the specified JSON format.
`,
});

const summarizeProjectFlow = ai.defineFlow(
  {
    name: 'summarizeProjectFlow',
    inputSchema: SummarizeProjectInputSchema,
    outputSchema: SummarizeProjectOutputSchema,
  },
  async ({combinedCode}) => {
    const {output} = await prompt({combinedCode});
    return output!;
  }
);
