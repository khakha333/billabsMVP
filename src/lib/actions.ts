'use server';
import { summarizeCodeStructure, type SummarizeCodeStructureInput, type SummarizeCodeStructureOutput } from '@/ai/flows/summarize-code-structure';
import { explainCodeSegment, type ExplainCodeSegmentInput, type ExplainCodeSegmentOutput } from '@/ai/flows/explain-code-segment';
import { z } from 'zod';

const SummarizeInputSchema = z.object({
  code: z.string(),
});

const ExplainInputSchema = z.object({
  code: z.string(),
  codeSegment: z.string(),
});

export async function analyzeCodeStructureAction(input: SummarizeCodeStructureInput): Promise<SummarizeCodeStructureOutput> {
  try {
    const validatedInput = SummarizeInputSchema.parse(input);
    return await summarizeCodeStructure(validatedInput);
  } catch (error) {
    console.error("Error in analyzeCodeStructureAction:", error);
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
    }
    // Consider returning a structured error or a default object
    // For now, rethrow a generic error to be caught by the caller
    throw new Error("Failed to analyze code structure due to an internal error.");
  }
}

export async function explainCodeSegmentAction(input: ExplainCodeSegmentInput): Promise<ExplainCodeSegmentOutput> {
  try {
    const validatedInput = ExplainInputSchema.parse(input);
    return await explainCodeSegment(validatedInput);
  } catch (error) {
    console.error("Error in explainCodeSegmentAction:", error);
     if (error instanceof z.ZodError) {
      return { explanation: `Invalid input for explanation: ${error.errors.map(e => e.message).join(', ')}` };
    }
    return { explanation: "Sorry, an error occurred while fetching the explanation for this segment." };
  }
}
