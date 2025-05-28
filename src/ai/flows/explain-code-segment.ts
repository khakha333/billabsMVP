'use server';

/**
 * @fileOverview Explains a specific segment of code using AI.
 *
 * - explainCodeSegment - A function that explains a given code segment.
 * - ExplainCodeSegmentInput - The input type for the explainCodeSegment function.
 * - ExplainCodeSegmentOutput - The return type for the explainCodeSegment function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExplainCodeSegmentInputSchema = z.object({
  code: z.string().describe('The entire code in which the segment is found.'),
  codeSegment: z.string().describe('The specific code segment to explain.'),
});
export type ExplainCodeSegmentInput = z.infer<typeof ExplainCodeSegmentInputSchema>;

const ExplainCodeSegmentOutputSchema = z.object({
  explanation: z.string().describe('The AI-generated explanation of the code segment.'),
});
export type ExplainCodeSegmentOutput = z.infer<typeof ExplainCodeSegmentOutputSchema>;

export async function explainCodeSegment(input: ExplainCodeSegmentInput): Promise<ExplainCodeSegmentOutput> {
  return explainCodeSegmentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'explainCodeSegmentPrompt',
  input: {schema: ExplainCodeSegmentInputSchema},
  output: {schema: ExplainCodeSegmentOutputSchema},
  prompt: `You are an expert software developer. Explain the following code segment in the context of the provided code.\n\nCode:\n\n{{code}}\n\nCode Segment:\n\n{{codeSegment}}\n\nExplanation: `,
});

const explainCodeSegmentFlow = ai.defineFlow(
  {
    name: 'explainCodeSegmentFlow',
    inputSchema: ExplainCodeSegmentInputSchema,
    outputSchema: ExplainCodeSegmentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
