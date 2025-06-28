
'use server';
import { summarizeCodeStructure, type SummarizeCodeStructureInput, type SummarizeCodeStructureOutput } from '@/ai/flows/summarize-code-structure';
import { explainCodeSegment, type ExplainCodeSegmentInput, type ExplainCodeSegmentOutput } from '@/ai/flows/explain-code-segment';
import { chatWithCode, type ChatWithCodeInput, type ChatWithCodeOutput } from '@/ai/flows/chat-with-code-flow';
// Ensure explainCodeLine and ExplainCodeLineInput/Output are correctly typed if they are aliases
import { explainCodeSegment as explainCodeLine } from '@/ai/flows/explain-code-segment';
import type { ExplainCodeSegmentInput as ExplainCodeLineInput, ExplainCodeSegmentOutput as ExplainCodeLineOutput } from '@/ai/flows/explain-code-segment';

import { generateApiExamples, type GenerateApiExamplesInput, type GenerateApiExamplesOutput } from '@/ai/flows/generate-api-examples-flow';
import { chatWithApiContext, type ChatWithApiContextInput, type ChatWithApiContextOutput } from '@/ai/flows/chat-with-api-context-flow';
import { analyzeGithubRepository, type AnalyzeGithubRepositoryInput, type AnalyzeGithubRepositoryOutput } from '@/ai/flows/analyze-github-repo-flow';
import { analyzeDependencies, type AnalyzeDependenciesInput, type AnalyzeDependenciesOutput } from '@/ai/flows/analyze-dependencies-flow';
import { summarizeProject, type SummarizeProjectInput, type SummarizeProjectOutput } from '@/ai/flows/summarize-project-flow';
import { reviewCode, type ReviewCodeInput, type ReviewCodeOutput } from '@/ai/flows/review-code-flow';
import { generateUiComponent, type GenerateUiComponentInput, type GenerateUiComponentOutput } from '@/ai/flows/generate-ui-component-flow';
import { modifyCode, type ModifyCodeInput, type ModifyCodeOutput } from '@/ai/flows/modify-code-flow';


import { z } from 'zod';


export async function analyzeCodeStructureAction(input: SummarizeCodeStructureInput): Promise<SummarizeCodeStructureOutput> {
  return await summarizeCodeStructure(input);
}

export async function explainCodeSegmentAction(input: ExplainCodeSegmentInput): Promise<ExplainCodeSegmentOutput> {
  return await explainCodeSegment(input);
}

export async function explainCodeLineAction(input: ExplainCodeLineInput): Promise<ExplainCodeLineOutput> {
    return await explainCodeLine(input);
}

export async function chatWithCodeAction(input: ChatWithCodeInput): Promise<ChatWithCodeOutput> {
    return await chatWithCode(input);
}

export async function generateApiExamplesAction(input: GenerateApiExamplesInput): Promise<GenerateApiExamplesOutput> {
  const schema = z.object({
    apiName: z.string(),
    userCodeContext: z.string().optional(),
  });
  const validatedInput = schema.parse(input);
  return await generateApiExamples(validatedInput);
}

export async function chatWithApiContextAction(input: ChatWithApiContextInput): Promise<ChatWithApiContextOutput> {
    return await chatWithApiContext(input);
}

export async function analyzeGithubRepositoryAction(input: AnalyzeGithubRepositoryInput): Promise<AnalyzeGithubRepositoryOutput> {
  const schema = z.object({ repositoryUrl: z.string().url() });
  const validatedInput = schema.parse(input);
  return await analyzeGithubRepository(validatedInput);
}

export async function analyzeDependenciesAction(input: AnalyzeDependenciesInput): Promise<AnalyzeDependenciesOutput> {
    return await analyzeDependencies(input);
}

export async function summarizeProjectAction(input: SummarizeProjectInput): Promise<SummarizeProjectOutput> {
    return await summarizeProject(input);
}

export async function reviewCodeAction(input: ReviewCodeInput): Promise<ReviewCodeOutput> {
    return await reviewCode(input);
}

export async function generateUiComponentAction(input: GenerateUiComponentInput): Promise<GenerateUiComponentOutput> {
    const GenerateUiComponentInputSchemaValidation = z.object({
      prompt: z.string().min(10, "설명은 최소 10자 이상이어야 합니다."),
      componentName: z.string().regex(/^[A-Z][a-zA-Z0-9]*$/, "컴포넌트 이름은 파스칼 케이스(PascalCase)여야 합니다. (예: UserProfile)"),
    });
    try {
        const validatedInput = GenerateUiComponentInputSchemaValidation.parse(input);
        return await generateUiComponent(validatedInput);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { code: `// 입력 오류: ${error.errors.map(e => e.message).join(', ')}` };
        }
        return { code: `// 컴포넌트 생성 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}` };
    }
}

export async function modifyCodeAction(input: ModifyCodeInput): Promise<ModifyCodeOutput> {
    const ModifyCodeInputSchemaValidation = z.object({
      code: z.string(),
      prompt: z.string().min(5, "수정 요청은 최소 5자 이상이어야 합니다."),
      fileName: z.string().optional(),
    });
    try {
        const validatedInput = ModifyCodeInputSchemaValidation.parse(input);
        return await modifyCode(validatedInput);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { modifiedCode: input.code, explanation: `입력 오류: ${error.errors.map(e => e.message).join(', ')}` };
        }
        return { modifiedCode: input.code, explanation: `코드 수정 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}` };
    }
}
