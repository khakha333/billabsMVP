
'use server';
import { summarizeCodeStructure, type SummarizeCodeStructureInput, type SummarizeCodeStructureOutput } from '@/ai/flows/summarize-code-structure';
import { explainCodeSegment, type ExplainCodeSegmentInput, type ExplainCodeSegmentOutput } from '@/ai/flows/explain-code-segment';
import { chatWithCode, type ChatWithCodeInput, type ChatWithCodeOutput } from '@/ai/flows/chat-with-code-flow';
// Ensure explainCodeLine and ExplainCodeLineInput/Output are correctly typed if they are aliases
import { explainCodeSegment as explainCodeLine, type ExplainCodeSegmentInput as ExplainCodeLineInput, type ExplainCodeSegmentOutput as ExplainCodeLineOutput } from '@/ai/flows/explain-code-segment';
import { generateApiExamples, type GenerateApiExamplesInput, type GenerateApiExamplesOutput } from '@/ai/flows/generate-api-examples-flow';
import { chatWithApiContext, type ChatWithApiContextInput, type ChatWithApiContextOutput } from '@/ai/flows/chat-with-api-context-flow';
import { z } from 'zod';

const SummarizeInputSchema = z.object({
  code: z.string(),
});

const ExplainInputSchema = z.object({
  code: z.string(),
  codeSegment: z.string(),
});

const ChatInputSchema = z.object({
  code: z.string(),
  question: z.string(),
  additionalContext: z.string().optional(),
});

const GenerateApiExamplesInputSchemaValidation = z.object({
  apiName: z.string(),
  userCodeContext: z.string().optional(),
});

const ChatWithApiContextInputSchemaValidation = z.object({
  apiName: z.string(),
  apiContextDetails: z.string(),
  question: z.string(),
});


export async function analyzeCodeStructureAction(input: SummarizeCodeStructureInput): Promise<SummarizeCodeStructureOutput> {
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

export async function fetchCodeFromGithubAction(url: string): Promise<{ code?: string; error?: string }> {
  const GithubUrlSchema = z.string().url().startsWith('https://github.com/');
  try {
    GithubUrlSchema.parse(url);
  } catch (error) {
    return { error: '유효한 GitHub 파일 URL이 아닙니다. URL은 https://github.com/ 으로 시작해야 합니다.' };
  }

  // Convert to raw URL
  const rawUrl = url
    .replace('github.com', 'raw.githubusercontent.com')
    .replace('/blob/', '/');
  
  if (rawUrl === url) {
    return { error: 'GitHub 파일 URL을 입력해주세요 (예: .../blob/main/...). 레포지토리 URL은 지원되지 않습니다.' };
  }

  try {
    const response = await fetch(rawUrl);
    if (!response.ok) {
      throw new Error(`GitHub에서 파일을 가져오는데 실패했습니다 (상태 코드: ${response.status}). URL을 확인해주세요.`);
    }
    const code = await response.text();
    return { code };
  } catch (error) {
    console.error("Error fetching from GitHub:", error);
    if (error instanceof Error) {
      return { error: error.message };
    }
    return { error: '알 수 없는 오류로 인해 GitHub에서 파일을 가져올 수 없습니다.' };
  }
}
