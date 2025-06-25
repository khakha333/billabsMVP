
'use server';
/**
 * @fileOverview Analyzes dependencies from a package.json file.
 *
 * - analyzeDependencies - A function that categorizes and describes dependencies.
 * - AnalyzeDependenciesInput - The input type for the flow.
 * - AnalyzeDependenciesOutput - The return type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeDependenciesInputSchema = z.object({
  packageJsonContent: z
    .string()
    .describe('The string content of a package.json file.'),
});
export type AnalyzeDependenciesInput = z.infer<
  typeof AnalyzeDependenciesInputSchema
>;

const DependencyInfoSchema = z.object({
  name: z.string().describe('The name of the dependency.'),
  category: z
    .string()
    .describe(
      "The category of the dependency (e.g., 'Framework', 'UI Library', 'State Management', 'Build Tool', 'Testing', 'Data Fetching', 'Utility', 'Other')."
    ),
  description: z
    .string()
    .describe('A brief, one-sentence description of the dependency in Korean.'),
});

const AnalyzeDependenciesOutputSchema = z.object({
  dependencies: z
    .array(DependencyInfoSchema)
    .describe('A list of analyzed dependencies.'),
});
export type AnalyzeDependenciesOutput = z.infer<
  typeof AnalyzeDependenciesOutputSchema
>;

export async function analyzeDependencies(
  input: AnalyzeDependenciesInput
): Promise<AnalyzeDependenciesOutput> {
  return analyzeDependenciesFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeDependenciesPrompt',
  input: {schema: z.object({dependencies: z.record(z.string()), devDependencies: z.record(z.string())})},
  output: {schema: AnalyzeDependenciesOutputSchema},
  prompt: `You are an expert software development assistant who specializes in analyzing project dependencies.
Based on the provided dependencies and devDependencies from a package.json file, categorize each one and provide a concise, one-sentence description in Korean.

Use the following categories: 'Framework', 'UI Library', 'State Management', 'Build Tool', 'Testing', 'Data Fetching', 'Linting & Formatting', 'Utility', 'AI/ML', 'Other'.

Do not include dependencies like '@types/*' in the final list.

Dependencies:
{{#each dependencies}}
- {{this.[0]}}: {{this.[1]}}
{{/each}}

DevDependencies:
{{#each devDependencies}}
- {{this.[0]}}: {{this.[1]}}
{{/each}}

Provide the output in the specified JSON format.
`,
});

const analyzeDependenciesFlow = ai.defineFlow(
  {
    name: 'analyzeDependenciesFlow',
    inputSchema: AnalyzeDependenciesInputSchema,
    outputSchema: AnalyzeDependenciesOutputSchema,
  },
  async ({packageJsonContent}) => {
    try {
      const packageJson = JSON.parse(packageJsonContent);
      const dependencies = packageJson.dependencies || {};
      const devDependencies = packageJson.devDependencies || {};
      
      const filteredDevDependencies: Record<string, string> = {};
      for (const key in devDependencies) {
        if (!key.startsWith('@types/')) {
          filteredDevDependencies[key] = devDependencies[key];
        }
      }

      const {output} = await prompt({
          dependencies: dependencies,
          devDependencies: filteredDevDependencies
      });

      return output || {dependencies: []};
    } catch (e) {
      console.error('Failed to parse package.json or run prompt', e);
      return {dependencies: []};
    }
  }
);
