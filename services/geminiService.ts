import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const fileToPart = (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64String,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const extractQuestionsFromPdfs = async (
  files: File[],
  userInstruction: string
): Promise<string> => {
  try {
    const fileParts = await Promise.all(files.map(fileToPart));

    const systemPrompt = `
      당신은 고도로 훈련된 수능 문제 편집 AI입니다.
      가장 중요한 목표는 **요청된 유형의 문제를 단 하나도 빠뜨리지 않고 완벽하게 추출하는 것**입니다.

      [작업 절차 - 엄격 준수]
      1. **전수 조사**: 제공된 모든 PDF 파일의 모든 페이지를 처음부터 끝까지 스캔하세요.
      2. **문제 식별**: 18번부터 45번(또는 마지막 번호)까지의 모든 독해 문항을 하나씩 확인하세요.
      3. **유형 매칭**: 각 문항이 사용자가 요청한 '추출 대상 유형'에 해당하는지 정밀하게 판별하세요.
      4. **전체 추출**: 해당하는 문항은 **무조건** 추출해야 합니다. 내용이 길거나 문항 수가 많아도 절대 생략하지 마세요.
      5. **듣기 제외**: 1번부터 17번(듣기)은 절대 추출하지 마세요.

      [출력 구조: 유형별 분류]
      추출된 문제들을 **반드시 문제 유형별로 그룹화**하여 출력하세요.
      (예: 모든 '요지' 문제를 먼저 나열 -> 그 다음 모든 '빈칸' 문제 나열...)
      각 유형 섹션의 시작에는 \`<h2>[유형 명칭]</h2>\` 태그를 붙이세요.

      [텍스트 추출 원칙: Verbatim]
      - **발문, 지문, 선택지(①~⑤ 포함)**를 원본 그대로 정확하게 옮기세요.
      - 요약하거나 변형하지 마세요.
      - 지문의 문단 구분, 박스(<보기>) 처리 등을 원본과 유사한 HTML 구조로 표현하세요.
      - **출처 표시**: 각 문제 상단에 해당 문제가 속한 시험지(파일명 또는 상단 타이틀) 정보를 \`<div class="source">...</div>\`로 표시하세요.

      [HTML 포맷 예시]
      <h2>[유형 명칭]</h2>
      <div class="question-item">
        <div class="source">[2024학년도 9월 모의평가]</div>
        <div class="question-title"><strong>18.</strong> 다음 글의 목적으로 가장 적절한 것은?</div>
        <div class="passage">
          Dear members, ... (지문 내용 원본 그대로) ...
        </div>
        <div class="box"><strong>&lt;보 기&gt;</strong><br/>...보기 내용(있을 경우)...</div>
        <ol class="choices">
          <li>① 선택지 내용 1</li>
          <li>② 선택지 내용 2</li>
          ...
        </ol>
      </div>
      <hr/>

      [오류 방지 가이드]
      - "이하 생략", "나머지 문제도 같은 방식" 등의 표현은 금지됩니다. 모든 문제를 끝까지 출력하세요.
      - 만약 파일이 여러 개라면, 파일 1, 파일 2, 파일 3의 내용을 모두 검토하여 유형별로 합치세요.

      [사용자 요청사항 및 추출 대상]
      "${userInstruction}"
    `;

    // Complex text tasks require the Pro model for better adherence to instructions and completeness.
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          ...fileParts,
          { text: systemPrompt }
        ]
      }
    });

    return response.text || "<p>조건에 맞는 추출된 내용이 없습니다.</p>";

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("문제 추출 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
  }
};