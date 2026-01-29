import React, { useState, useRef } from 'react';
import { extractQuestionsFromPdfs } from './services/geminiService';
import { UploadedFile, ProcessingStatus } from './types';
import { FileUploader } from './components/FileUploader';
import { Spinner } from './components/Spinner';

// 수능 독해 문제 유형 정의 (듣기 제외)
// Removed: Graph, Content Match, Practical as requested.
const QUESTION_TYPES = [
  { id: 'purpose', label: '글의 목적', keyword: '목적으로 가장 적절한 것' },
  { id: 'mood', label: '심경/분위기', keyword: '심경 변화, 심경, 분위기' },
  { id: 'claim', label: '필자의 주장', keyword: '필자가 주장하는 바로' },
  { id: 'implication', label: '함축 의미', keyword: '밑줄 친 부분이 의미하는 바로' },
  { id: 'main_idea', label: '글의 요지', keyword: '요지로 가장 적절한 것' },
  { id: 'topic', label: '글의 주제', keyword: '주제로 가장 적절한 것' },
  { id: 'title', label: '글의 제목', keyword: '제목으로 가장 적절한 것' },
  { id: 'grammar', label: '어법', keyword: '어법상 틀린 것, 어법상 적절한 것' },
  { id: 'vocab', label: '어휘', keyword: '낱말의 쓰임, 문맥상 적절하지 않은' },
  { id: 'blank', label: '빈칸 추론', keyword: '빈칸에 들어갈 말' },
  { id: 'unrelated', label: '흐름 무관 문장', keyword: '흐름과 관계 없는 문장' },
  { id: 'order', label: '글의 순서', keyword: '이어질 글의 순서' },
  { id: 'insertion', label: '문장 삽입', keyword: '들어 가기에 가장 적절한 곳' },
  { id: 'summary', label: '요약문 완성', keyword: '요약하고자 한다' },
  { id: 'long_passage', label: '장문 독해', keyword: '물음에 답하시오 (장문)' },
];

const App: React.FC = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [selectedTypeIds, setSelectedTypeIds] = useState<Set<string>>(new Set(QUESTION_TYPES.map(t => t.id))); // Default select all
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [resultHtml, setResultHtml] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const handleFilesSelected = (newFiles: File[]) => {
    const newUploadedFiles: UploadedFile[] = newFiles.map((file) => ({
      id: Math.random().toString(36).substring(7),
      file,
    }));
    setFiles((prev) => [...prev, ...newUploadedFiles]);
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const toggleType = (id: string) => {
    const newSet = new Set(selectedTypeIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedTypeIds(newSet);
  };

  const toggleAll = () => {
    if (selectedTypeIds.size === QUESTION_TYPES.length) {
      setSelectedTypeIds(new Set());
    } else {
      setSelectedTypeIds(new Set(QUESTION_TYPES.map(t => t.id)));
    }
  };

  const handleExtract = async () => {
    if (files.length === 0) {
      setErrorMessage("최소한 하나의 PDF 파일을 업로드해주세요.");
      return;
    }
    if (selectedTypeIds.size === 0) {
      setErrorMessage("최소한 하나의 문제 유형을 선택해주세요.");
      return;
    }

    setStatus(ProcessingStatus.PROCESSING);
    setErrorMessage(null);

    try {
      // Construct instruction based on selection
      const selectedTypesInfo = QUESTION_TYPES
        .filter(t => selectedTypeIds.has(t.id))
        .map(t => `- ${t.label} (관련 발문: ${t.keyword})`)
        .join('\n');

      const instruction = `
        다음 유형의 문제들만 추출해주세요.
        
        [추출 대상 유형 및 키워드]
        ${selectedTypesInfo}

        [제외 대상]
        - **듣기 문제(1번~17번)는 절대 추출하지 마세요.**
        - 선택되지 않은 유형의 문제도 제외하세요.
      `;

      const rawFiles = files.map((f) => f.file);
      const html = await extractQuestionsFromPdfs(rawFiles, instruction);
      setResultHtml(html);
      setStatus(ProcessingStatus.COMPLETE);
    } catch (error) {
      setStatus(ProcessingStatus.ERROR);
      setErrorMessage(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
    }
  };

  const handleDownload = () => {
    if (!editorRef.current) return;
    
    const content = editorRef.current.innerHTML;
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>추출된 문제</title>
        <style>
          body { 
            font-family: 'Malgun Gothic', 'Noto Sans KR', sans-serif; 
            line-height: 1.6; 
            max-width: 800px; 
            margin: 2rem auto; 
            padding: 0 1rem; 
            color: #333;
            word-break: keep-all;
          }
          h2 {
            font-size: 1.5rem;
            color: #1e40af; /* Indigo-800 */
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 0.5rem;
            margin-top: 3rem;
            margin-bottom: 1.5rem;
          }
          .question-item { 
            margin-bottom: 3rem; 
            padding-bottom: 2rem; 
            page-break-inside: avoid;
          }
          .source {
            font-size: 0.9rem;
            color: #666;
            margin-bottom: 0.5rem;
            font-weight: 500;
          }
          .question-title {
            font-weight: bold;
            font-size: 1.1em;
            margin-bottom: 1rem;
          }
          .passage {
            background-color: #f9f9f9;
            padding: 1.5rem;
            margin: 1rem 0;
            border-radius: 4px;
            border-left: 4px solid #e5e7eb;
            line-height: 1.8;
            font-size: 0.95em;
            text-align: justify;
          }
          .box {
            border: 1px solid #000;
            padding: 1rem;
            margin: 1rem 0;
            position: relative;
            background: #fff;
          }
          .choices {
            list-style-type: none;
            padding-left: 0;
            margin-top: 1rem;
          }
          .choices li {
            margin-bottom: 0.5rem;
            padding-left: 1.8rem;
            text-indent: -1.8rem; /* Hanging indent for circle numbers */
          }
          img { max-width: 100%; height: auto; display: block; margin: 1rem auto; }
          hr { border: 0; border-top: 1px dashed #ccc; margin: 2rem 0; }
        </style>
      </head>
      <body contenteditable="true">
        ${content}
      </body>
      </html>
    `;

    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extracted_questions.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFiles([]);
    setSelectedTypeIds(new Set(QUESTION_TYPES.map(t => t.id)));
    setResultHtml('');
    setStatus(ProcessingStatus.IDLE);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 text-white p-2 rounded-lg">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
            </div>
            <h1 className="text-xl font-bold text-slate-800">PDF 문제 추출기 (AI)</h1>
          </div>
          {status === ProcessingStatus.COMPLETE && (
            <button
              onClick={handleReset}
              className="text-sm text-slate-500 hover:text-indigo-600 font-medium"
            >
              처음으로 돌아가기
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
          
          {/* Left Column: Inputs */}
          <div className="space-y-6">
            
            {/* Step 1: Upload */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full inline-flex items-center justify-center text-sm mr-2">1</span>
                PDF 파일 업로드
              </h2>
              <FileUploader 
                files={files} 
                onFilesSelected={handleFilesSelected} 
                onRemoveFile={handleRemoveFile}
                disabled={status === ProcessingStatus.PROCESSING}
              />
            </div>

            {/* Step 2: Instruction */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800 flex items-center">
                  <span className="bg-indigo-100 text-indigo-700 w-6 h-6 rounded-full inline-flex items-center justify-center text-sm mr-2">2</span>
                  추출할 문제 유형 선택
                </h2>
                <button 
                  onClick={toggleAll}
                  className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                  disabled={status === ProcessingStatus.PROCESSING}
                >
                  {selectedTypeIds.size === QUESTION_TYPES.length ? '전체 해제' : '전체 선택'}
                </button>
              </div>
              
              {/* Note about excluded listening questions is hidden as requested */}

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {QUESTION_TYPES.map((type) => (
                  <label 
                    key={type.id} 
                    className={`
                      relative flex items-center p-3 rounded-lg border cursor-pointer transition-all
                      ${selectedTypeIds.has(type.id) 
                        ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-300' 
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                      }
                      ${status === ProcessingStatus.PROCESSING ? 'opacity-60 cursor-not-allowed' : ''}
                    `}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={selectedTypeIds.has(type.id)}
                      onChange={() => toggleType(type.id)}
                      disabled={status === ProcessingStatus.PROCESSING}
                    />
                    <div className={`
                      w-5 h-5 rounded border flex items-center justify-center mr-3 transition-colors
                      ${selectedTypeIds.has(type.id) ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'}
                    `}>
                      {selectedTypeIds.has(type.id) && (
                        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                        </svg>
                      )}
                    </div>
                    <span className="text-sm font-medium text-slate-700 select-none">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="bg-red-50 text-red-700 p-4 rounded-lg border border-red-200 flex items-start">
                <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                {errorMessage}
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handleExtract}
              disabled={status === ProcessingStatus.PROCESSING || files.length === 0 || selectedTypeIds.size === 0}
              className={`w-full py-4 rounded-lg font-bold text-lg shadow-lg transition-all transform hover:-translate-y-0.5
                ${status === ProcessingStatus.PROCESSING || files.length === 0 || selectedTypeIds.size === 0
                  ? 'bg-indigo-400 cursor-not-allowed' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white active:bg-indigo-800'
                } flex items-center justify-center`}
            >
              {status === ProcessingStatus.PROCESSING ? (
                <>
                  <Spinner />
                  AI가 분석 중입니다...
                </>
              ) : (
                '문제 추출 시작하기'
              )}
            </button>
          </div>

          {/* Right Column: Preview */}
          <div className="flex flex-col h-full min-h-[500px]">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex-grow flex flex-col overflow-hidden h-full">
              <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <h2 className="font-semibold text-slate-700 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                  </svg>
                  미리보기 및 편집
                </h2>
                {status === ProcessingStatus.COMPLETE && (
                  <button
                    onClick={handleDownload}
                    className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                    </svg>
                    HTML 다운로드
                  </button>
                )}
              </div>
              
              <div className="relative flex-grow bg-white overflow-hidden">
                {status === ProcessingStatus.IDLE && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                    <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <p className="text-lg">파일을 업로드하고 유형을 선택하면<br/>결과가 여기에 표시됩니다.</p>
                  </div>
                )}
                
                {status === ProcessingStatus.PROCESSING && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white bg-opacity-90 z-10">
                    <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                    <p className="text-indigo-600 font-medium animate-pulse">PDF 내용을 분석하고 문제를 추출 중입니다...</p>
                    <p className="text-xs text-slate-500 mt-2">파일 크기에 따라 시간이 소요될 수 있습니다.</p>
                  </div>
                )}

                <div className="h-full overflow-auto p-8 bg-white">
                   <div 
                    ref={editorRef}
                    className="prose prose-indigo max-w-none outline-none min-h-full"
                    contentEditable={status === ProcessingStatus.COMPLETE}
                    suppressContentEditableWarning={true}
                    dangerouslySetInnerHTML={{ __html: resultHtml }}
                    style={{ whiteSpace: 'pre-wrap' }}
                   />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;