import { GoogleGenerativeAI } from "@google/generative-ai";
import * as pdfjsLib from 'pdfjs-dist';

// 근본적인 해결책: CDN 대신 로컬에 설치된 Worker 파일을 직접 번들링하여 사용
// 이렇게 하면 네트워크 차단이나 버전 불일치 문제 없이 안정적으로 실행됩니다.
// @ts-ignore
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// Initialize Google Generative AI
const getAiClient = (apiKey?: string) => {
  const key = apiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("API Key가 없습니다. 화면 우측 상단의 'API Key 설정' 버튼을 눌러 키를 입력해주세요.");
  }
  return new GoogleGenerativeAI(key);
};

const extractTextFromPdf = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();

  // cMapUrl 설정 등은 필요 시 추가 가능하지만, 기본적으로 한글 추출은 지원됩니다.
  const pdf = await pdfjsLib.getDocument({
    data: arrayBuffer,
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
    cMapPacked: true,
  }).promise;

  let fullText = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item: any) => item.str).join(" ");
    fullText += `\n--- Page ${i} ---\n${pageText}\n`;
  }
  return fullText;
};

interface QuestionType {
  id: string;
  label: string;
  description: string;
}

export const extractQuestionsFromPdfs = async (
  files: File[],
  userInstruction: string,
  apiKey?: string // API Key 인자 추가
): Promise<string> => {
  try {
    // Extract text from all PDFs
    const textContents = await Promise.all(files.map(extractTextFromPdf));
    const combinedText = textContents.join("\n\n=== NEXT FILE ===\n\n");

    const systemPrompt = `
      당신은 고도로 훈련된 수능 문제 편집 AI입니다.
      제공된 PDF 텍스트 내용을 바탕으로, 사용자가 요청한 유형의 문제를 추출해야 합니다.
      
      **주의: 텍스트 데이터만 제공되므로, 그림이나 도표가 필수적인 문제는 제외하거나 텍스트 내용만으로 구성하세요.**
      **필수: 제공된 텍스트의 내용을 절대 생략하지 말고, 요청된 유형의 모든 문제를 찾아내세요.**

      [작업 절차 - 엄격 준수]
      1. **전수 조사**: 제공된 텍스트 데이터를 처음부터 끝까지 분석하세요. (문제편과 해설편이 섞여 있을 수 있습니다.)
      2. **문제 식별**: 18번부터 45번(또는 마지막 번호)까지의 독해 문항을 식별하세요.
      3. **유형 매칭**: 각 문항이 사용자가 요청한 '추출 대상 유형'에 해당하는지 판별하세요.
      4. **정답/해설 매칭**: 텍스트 내에 해당 문제의 **정답(①~⑤)과 해설**이 있다면 반드시 찾아서 문제와 짝지으세요.
      5. **전체 추출**: 해당하는 문항은 **무조건** 추출해야 합니다.
      6. **듣기 제외**: 1번부터 17번(듣기)은 내용이 보여도 절대 추출하지 마세요.

      [출력 구조: 유형별 분류]
      추출된 문제들을 **반드시 문제 유형별로 그룹화**하여 출력하세요.
      각 유형 섹션의 시작에는 \`<h2>[유형 명칭]</h2>\` 태그를 붙이세요.

      [텍스트 추출 원칙]
      - **발문, 지문, 선택지(①~⑤)**의 텍스트를 원본과 최대한 가깝게 재구성하세요.
      - 지문의 문단 구분은 텍스트 흐름을 보고 적절히 \`<p>\` 태그 등으로 나누어 주세요.
      - **출처 표시**: 각 문제 상단에 \`<div class=\"source\">...</div>\`로 출처(페이지 정보 등)를 표시하세요.
      - **정답/해설**: 정답과 해설은 \`<div class=\"answer-box\">\` 안에 넣어주세요. (단, 텍스트에 해설이 없는 경우 정답만이라도 표시)

      [HTML 포맷 예시]
      <h2>[유형 명칭]</h2>
      <div class=\"question-item\">
        <div class=\"source\">[Page 3]</div>
        <div class=\"question-title\"><strong>18.</strong> 다음 글의 목적으로 가장 적절한 것은?</div>
        <div class=\"passage\">
          Dear members, ... (지문 내용) ...
        </div>
        <ol class=\"choices\">
          <li>① 선택지 1</li>
          <li>② 선택지 2</li>
          ...
        </ol>
        <!-- 해설이 발견된 경우 추가 -->
        <div class=\"answer-box\">
          <strong>[정답 및 해설]</strong><br/>
          정답: ③<br/>
          해석: ...<br/>
          해설: ...
        </div>
      </div>
      <hr/>

      [사용자 요청사항 및 추출 대상]
      "${userInstruction}"
      (참고: 사용자가 정답/해설 파일을 함께 업로드했을 수 있으니, 텍스트 뒷부분이나 별도 페이지에 있는 '정답 및 해설' 파트를 꼼꼼히 확인하여 문제와 연결하세요.)

      [분석할 PDF 텍스트 데이터]
      ${combinedText}
    `;

    // Use the latest available Gemini model
    const genAI = getAiClient(apiKey);

    // 키 마스킹 처리 (로그용)
    const effectiveKey = apiKey || process.env.API_KEY || process.env.GEMINI_API_KEY || "";
    const maskedKey = effectiveKey.length > 10 ? `${effectiveKey.substring(0, 10)}...` : "키 없음";

    // API 조회 결과 확인된 '실제 존재하는 모델' 목록으로 시도합니다. 
    // 여러 모델을 시도하면 Quota(사용량)를 더 빨리 소진할 수 있으므로 확실한 모델에 집중합니다.
    const modelsToTry = [
      "gemini-1.5-flash",
      "gemini-1.5-pro"
    ];

    let lastError = null;

    // Helper functionality for delay
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (const modelName of modelsToTry) {
      try {
        console.log(`Checking model: ${modelName} with key ${maskedKey}`);
        const model = genAI.getGenerativeModel({ model: modelName });

        // Retry logic for Quota/Rate Limit errors
        let retries = 0;
        const maxRetries = 3; // 재시도 횟수 증가

        while (retries <= maxRetries) {
          try {
            const result = await model.generateContent(systemPrompt);
            const response = await result.response;
            return response.text() || "<p>조건에 맞는 추출된 내용이 없습니다.</p>";
          } catch (innerError) {
            const errStr = String(innerError);
            console.warn(`Attempt ${retries + 1} for ${modelName} failed: ${errStr}`);

            // 429나 Quota 관련 에러인 경우에만 재시도
            if ((errStr.includes("429") || errStr.includes("Quota") || errStr.includes("rate limit") || errStr.includes("503"))) {
              if (retries < maxRetries) {
                const waitTime = 10000; // 10초 대기 (확실한 Quota 리셋을 위해)
                console.warn(`Model ${modelName} busy (Quota/Rate limit), retrying in ${waitTime / 1000}s...`);
                await delay(waitTime);
                retries++;
                continue;
              }
            }
            throw innerError; // 재시도 횟수 초과하거나 다른 에러면 throw
          }
          break; // 성공하면 while 루프 탈출
        }

      } catch (error) {
        console.warn(`Model ${modelName} failed:`, error);
        lastError = error;

        // 404 Not Found는 다음 모델로 넘어감
        const errStr = String(error);
        if (errStr.includes("404") || errStr.includes("not found")) {
          continue;
        }
        // Quota 에러가 나서 여기로 왔다는 건 이미 재시도를 다 하고도 실패했다는 뜻
        // 다른 모델도 똑같이 Quota에 걸릴 확률이 높지만, 일단 넘어감
        if (errStr.includes("Quota") || errStr.includes("429")) {
          continue;
        }

        break;
      }
    }

    // 모든 시도 실패 시 상세 안내 메시지 제공
    console.error("All models failed:", lastError);
    let finalErrorMessage = "사용 가능한 AI 모델을 찾을 수 없습니다.";

    const errorStr = String(lastError);
    if (errorStr.includes("Quota") || errorStr.includes("429") || errorStr.includes("503")) {
      finalErrorMessage = `
         <strong>[사용량 제한 알림]</strong><br/>
         현재 구글 AI 서버의 무료 사용량(Quota)이 일시적으로 초과되었습니다.<br/>
         AI가 답변을 생성하다가 멈춘 것일 수 있습니다.<br/><br/>
         <b>해결 방법:</b><br/>
         1. <strong>약 1~2분 정도만 기다려주세요.</strong> (가장 확실한 방법입니다)<br/>
         2. 잠시 후 다시 '문제 추출 시작하기'를 눌러주세요.<br/>
         3. 만약 파일이 매우 크다면(100페이지 이상), 파일을 나누어서 시도해보세요.
         `;
    } else if (errorStr.includes("404") || errorStr.includes("not found") || errorStr.includes("403") || errorStr.includes("permission")) {
      finalErrorMessage += `
        <br/><br/>
        <div class="text-left text-sm bg-white p-3 rounded border border-red-200 mt-2">
            <strong>[디버깅 정보]</strong><br/>
            - <strong>현재 API 키:</strong> ${maskedKey}<br/>
            - <strong>오류 내용:</strong> ${lastError instanceof Error ? lastError.message : String(lastError)}<br/><br/>
            
            <strong>[확인 사항]</strong><br/>
            API 키는 정상이지만, 모델을 불러오는 데 실패했습니다.<br/>
            잠시 후 다시 시도해주시거나, 구글 클라우드 콘솔 설정을 확인해주세요.
        </div>
        `;
    } else {
      finalErrorMessage += ` 오류 내용: ${lastError instanceof Error ? lastError.message : String(lastError)}`;
    }

    throw new Error(finalErrorMessage);

  } catch (error) {
    console.error("Gemini API Error:", error);
    let errorMessage = error instanceof Error ? error.message : String(error);

    // Add helpful instructions for likely errors
    if (errorMessage.includes("413") || errorMessage.includes("Too Large")) {
      errorMessage += " (텍스트 양이 너무 많습니다. 파일을 나누어 시도해주세요.)";
    }

    if (errorMessage.includes("Setting up fake worker failed")) {
      errorMessage = "PDF 처리 모듈 로딩에 실패했습니다. 페이지를 새로고침 해주세요.";
    }

    if (errorMessage.includes("not found")) {
      errorMessage += " (AI 모델을 찾을 수 없습니다. API 키 권한이나 모델명을 확인해주세요.)";
    }

    throw new Error(`문제 추출 실패: ${errorMessage}`);
  }
};