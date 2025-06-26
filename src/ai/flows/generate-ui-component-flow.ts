'use server';
/**
 * @fileOverview Generates a React component based on a user prompt.
 *
 * - generateUiComponent - A function that creates a React component from a description.
 * - GenerateUiComponentInput - The input type for the flow.
 * - GenerateUiComponentOutput - The return type for the flow.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateUiComponentInputSchema = z.object({
  prompt: z.string().describe('A detailed description of the UI component to generate.'),
  componentName: z.string().describe('The name of the component, in PascalCase. e.g., UserProfileCard'),
});
export type GenerateUiComponentInput = z.infer<typeof GenerateUiComponentInputSchema>;

const GenerateUiComponentOutputSchema = z.object({
  code: z.string().describe('The generated React component code as a single string.'),
});
export type GenerateUiComponentOutput = z.infer<typeof GenerateUiComponentOutputSchema>;

export async function generateUiComponent(
  input: GenerateUiComponentInput
): Promise<GenerateUiComponentOutput> {
  return generateUiComponentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateUiComponentPrompt',
  input: {schema: GenerateUiComponentInputSchema},
  output: {schema: GenerateUiComponentOutputSchema},
  prompt: `You are an expert frontend developer specializing in Next.js, React, and creating beautiful, production-ready components using shadcn/ui and Tailwind CSS.

Your task is to generate the complete code for a single React component file based on the user's prompt.

**Component Requirements:**
-   **File Name**: The component should be written as if it's in a file named \`{{componentName}}.tsx\`.
-   **Framework**: Use React with TypeScript. The component must be a functional component.
-   **Styling**: Use Tailwind CSS for styling.
-   **UI Library**: You MUST use components from \`shadcn/ui\` whenever possible. Common imports include \`@/components/ui/card\`, \`@/components/ui/button\`, \`@/components/ui/avatar\`, \`@/components/ui/input\`, etc.
-   **Icons**: Use icons from \`lucide-react\` if needed.
-   **Placeholders**: For images, use placeholders from \`https://placehold.co\`. For example: \`https://placehold.co/400x300.png\`. Add a \`data-ai-hint\` attribute to placeholder images with one or two relevant keywords (e.g., \`data-ai-hint="user portrait"\`).
-   **No Comments**: Do not add any comments to the generated code.
-   **Complete File**: Return the entire file content as a single string in the 'code' field of the JSON output. Include all necessary imports at the top. The component should be exported.

**User's Component Request:**
-   **Component Name**: \`{{componentName}}\`
-   **Description**: "{{{prompt}}}"

Generate the full \`.tsx\` file content now.
`,
});

const generateUiComponentFlow = ai.defineFlow(
  {
    name: 'generateUiComponentFlow',
    inputSchema: GenerateUiComponentInputSchema,
    outputSchema: GenerateUiComponentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
