
'use server';
import { summarizeCodeStructure, type SummarizeCodeStructureInput, type SummarizeCodeStructureOutput } from '@/ai/flows/summarize-code-structure';
import { explainCodeSegment, type ExplainCodeSegmentInput, type ExplainCodeSegmentOutput } from '@/ai/flows/explain-code-segment';
import { chatWithCode, type ChatWithCodeInput, type ChatWithCodeOutput } from '@/ai/flows/chat-with-code-flow';
// Ensure explainCodeLine and ExplainCodeLineInput/Output are correctly typed if they are aliases
import { explainCodeSegment as explainCodeLine, type ExplainCodeSegmentInput as ExplainCodeLineInput, type ExplainCodeSegmentOutput as ExplainCodeLineOutput } from '@/ai/flows/explain-code-segment';
import { generateApiExamples, type GenerateApiExamplesInput, type GenerateApiExamplesOutput } from '@/ai/flows/generate-api-examples-flow';
import { chatWithApiContext, type ChatWithApiContextInput, type ChatWithApiContextOutput } from '@/ai/flows/chat-with-api-context-flow';
import { analyzeGithubRepository, type AnalyzeGithubRepositoryInput, type AnalyzeGithubRepositoryOutput } from '@/ai/flows/analyze-github-repo-flow';
import { analyzeDependencies, type AnalyzeDependenciesInput, type AnalyzeDependenciesOutput } from '@/ai/flows/analyze-dependencies-flow';

import { z } from 'zod';


export async function analyzeCodeStructureAction(input: SummarizeCodeStructureInput): Promise<SummarizeCodeStructureOutput> {
  const SummarizeInputSchema = z.object({
    code: z.string(),
  });
  try {
    const validatedInput = SummarizeInputSchema.parse(input);
    return await summarizeCodeStructure(validatedInput);
  } catch (error) {
    console.error("Error in analyzeCodeStructureAction:", error);
    if (error instanceof z.ZodError) {
      throw new Error(`입력값이 잘못되었습니다: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new Error("내부 오류로 인해 코드 구조 분석에 실패했습니다.");
  }
}

export async function explainCodeSegmentAction(input: ExplainCodeSegmentInput): Promise<ExplainCodeSegmentOutput> {
  const ExplainInputSchema = z.object({
    code: z.string(),
    codeSegment: z.string(),
  });
  try {
    const validatedInput = ExplainInputSchema.parse(input);
    return await explainCodeSegment(validatedInput);
  } catch (error) {
    console.error("Error in explainCodeSegmentAction:", error);
     if (error instanceof z.ZodError) {
      return { explanation: `코드 조각 설명 입력이 잘못되었습니다: ${error.errors.map(e => e.message).join(', ')}` };
    }
    // Ensure a valid ExplainCodeSegmentOutput structure is returned
    return { explanation: "죄송합니다. 이 코드 조각에 대한 설명을 가져오는 중 오류가 발생했습니다." };
  }
}

export async function explainCodeLineAction(input: ExplainCodeLineInput): Promise<ExplainCodeLineOutput> {
  const ExplainInputSchema = z.object({
    code: z.string(),
    codeSegment: z.string(),
  });
  try {
    const validatedInput = ExplainInputSchema.parse(input);
    return await explainCodeLine(validatedInput);
  } catch (error) {
    console.error("Error in explainCodeLineAction:", error);
    if (error instanceof z.ZodError) {
      return { explanation: `라인 설명 입력이 잘못되었습니다: ${error.errors.map(e => e.message).join(', ')}` };
    }
    return { explanation: "죄송합니다. 이 라인에 대한 설명을 가져오는 중 오류가 발생했습니다." };
  }
}

export async function chatWithCodeAction(input: ChatWithCodeInput): Promise<ChatWithCodeOutput> {
  const ChatInputSchema = z.object({
    code: z.string(),
    question: z.string(),
    additionalContext: z.string().optional(),
  });
  try {
    const validatedInput = ChatInputSchema.parse(input);
    return await chatWithCode(validatedInput);
  } catch (error) {
    console.error("Error in chatWithCodeAction:", error);
    if (error instanceof z.ZodError) {
      return { answer: `채팅 입력이 잘못되었습니다: ${error.errors.map(e => e.message).join(', ')}` };
    }
    return { answer: "죄송합니다. 질문에 대한 답변을 생성하는 중 오류가 발생했습니다." };
  }
}

export async function generateApiExamplesAction(input: GenerateApiExamplesInput): Promise<GenerateApiExamplesOutput> {
  const GenerateApiExamplesInputSchemaValidation = z.object({
    apiName: z.string(),
    userCodeContext: z.string().optional(),
  });
  try {
    const validatedInput = GenerateApiExamplesInputSchemaValidation.parse(input);
    return await generateApiExamples(validatedInput);
  } catch (error) {
    console.error("Error in generateApiExamplesAction:", error);
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류";
    if (error instanceof z.ZodError) {
        // Fallback to a generic error response matching the schema
        return {
            apiName: input.apiName,
            briefDescription: `API 예제 생성 중 입력 오류: ${error.errors.map(e => e.message).join(', ')}`,
            examples: [],
            generalUsageNotes: "입력값을 확인해주세요."
        };
    }
    // Fallback to a generic error response matching the schema
    return {
        apiName: input.apiName,
        briefDescription: `죄송합니다. API '${input.apiName}'에 대한 예제를 가져오는 중 오류가 발생했습니다.`,
        examples: [],
        generalUsageNotes: `오류: ${errorMessage}`
    };
  }
}

export async function chatWithApiContextAction(input: ChatWithApiContextInput): Promise<ChatWithApiContextOutput> {
  const ChatWithApiContextInputSchemaValidation = z.object({
    apiName: z.string(),
    apiContextDetails: z.string(),
    question: z.string(),
  });
  try {
    const validatedInput = ChatWithApiContextInputSchemaValidation.parse(input);
    return await chatWithApiContext(validatedInput);
  } catch (error) {
    console.error("Error in chatWithApiContextAction:", error);
    if (error instanceof z.ZodError) {
      return { answer: `API 컨텍스트 채팅 입력이 잘못되었습니다: ${error.errors.map(e => e.message).join(', ')}` };
    }
    return { answer: "죄송합니다. API 관련 질문에 대한 답변을 생성하는 중 오류가 발생했습니다." };
  }
}

export async function analyzeGithubRepositoryAction(input: AnalyzeGithubRepositoryInput): Promise<AnalyzeGithubRepositoryOutput> {
  const RepoUrlSchema = z.object({
    repositoryUrl: z.string().url().startsWith('https://github.com/'),
  });

  try {
    const validatedInput = RepoUrlSchema.parse(input);
    const url = new URL(validatedInput.repositoryUrl);
    const pathParts = url.pathname.split('/').filter(p => p && p !== 'blob' && p !== 'tree');
    if (pathParts.length < 2) {
      return { combinedCode: '', fileCount: 0, error: '유효한 GitHub 저장소 URL이 아닙니다 (예: https://github.com/owner/repo).' };
    }
    const cleanUrl = `${url.protocol}//${url.hostname}/${pathParts[0]}/${pathParts[1]}`;
    
    return await analyzeGithubRepository({ repositoryUrl: cleanUrl });
  } catch (error) {
    console.error("Error in analyzeGithubRepositoryAction:", error);
    const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    if (error instanceof z.ZodError) {
      return { combinedCode: '', fileCount: 0, error: `GitHub 저장소 URL이 유효하지 않습니다: ${error.errors.map(e => e.message).join(', ')}` };
    }
    return { combinedCode: '', fileCount: 0, error: errorMessage };
  }
}

export async function analyzeDependenciesAction(input: AnalyzeDependenciesInput): Promise<AnalyzeDependenciesOutput> {
    const AnalyzeDependenciesInputSchema = z.object({
      packageJsonContent: z.string(),
    });
    try {
        const validatedInput = AnalyzeDependenciesInputSchema.parse(input);
        return await analyzeDependencies(validatedInput);
    } catch (error) {
        console.error("Error in analyzeDependenciesAction:", error);
        if (error instanceof z.ZodError) {
            throw new Error(`의존성 분석 입력이 잘못되었습니다: ${error.errors.map(e => e.message).join(', ')}`);
        }
        throw new Error("의존성 분석 중 내부 오류가 발생했습니다.");
    }
}
