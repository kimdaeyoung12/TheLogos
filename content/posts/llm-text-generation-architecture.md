+++
title = "LLM 텍스트 생성 아키텍처"
date = 2026-05-13T21:23:50+09:00
draft = false
categories = ["engineering"]
tags = ["LLM", "Architecture", "Transformer", "Machine Learning", "NLP"]
+++

거대 언어 모델(LLM)이 텍스트를 생성하는 과정은 단순한 확률 게임을 넘어, 수조 개의 파라미터가 정밀하게 맞물려 돌아가는 거대한 기계 장치와 같습니다.

토큰화(Tokenization)부터 시작하여 임베딩(Embedding), 트랜스포머 블록(Transformer Block)에서의 복잡한 어텐션 연산, 그리고 최종적인 샘플링(Sampling)까지. 각 단계에서 어떤 연산이 일어나고 어디서 병목이 발생하는지 직관적으로 이해할 수 있는 아키텍처 구조도를 소개합니다.

특히 성능 최적화의 핵심인 **KV 캐시(KV Cache)**와 최근의 속도 향상 기법인 **추측 디코딩(Speculative Decoding)**의 원리를 한눈에 확인해 보세요.

{{< rawhtml >}}
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://unpkg.com/lucide@latest"></script>
<script>
  tailwind.config = {
    corePlugins: {
      preflight: false,
    }
  }
</script>

<div class="llm-arch-container bg-[#121212] text-gray-200 p-4 md:p-8 font-sans text-base md:text-lg rounded-3xl my-8 overflow-x-auto">
  <div class="max-w-5xl mx-auto space-y-8">
    
    <!-- Header & Legend -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-700 pb-4">
      <div>
        <h1 class="text-3xl md:text-4xl font-bold text-white mb-2 border-0">LLM 텍스트 생성 아키텍처</h1>
      </div>
      <div class="mt-4 md:mt-0 p-3 border border-gray-600 rounded-lg bg-[#1a1a1a] flex gap-4 text-sm">
        <div class="flex items-center gap-1"><div class="w-3 h-3 bg-gray-200 rounded-sm"></div> 구조/텍스트</div>
        <div class="flex items-center gap-1"><div class="w-3 h-3 border-2 border-blue-400 rounded-sm"></div> 핵심 연산</div>
        <div class="flex items-center gap-1"><div class="w-3 h-3 border-2 border-orange-400 rounded-sm"></div> 메모/주석</div>
      </div>
    </div>

    <!-- Global Annotation -->
    <div class="flex justify-end">
      <div class="text-orange-400 text-sm text-right border-r-2 border-orange-400 pr-2">
        프롬프트 단계: 모든 입력 토큰을 병렬 처리<br/>(연산 병목)
      </div>
    </div>

    <!-- Step 3: Embedding Layer -->
    <section class="flex flex-col items-center">
      <div class="w-full max-w-3xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div class="flex-1 flex items-center gap-2">
          <span class="text-xl font-bold text-gray-400">③</span>
          <h2 class="text-xl md:text-2xl font-bold text-white border-0 m-0">임베딩 레이어</h2>
        </div>
        
        <div class="flex-[2] flex flex-col items-center">
          <div class="text-gray-300 mb-1 text-sm md:text-base">토큰 ID <span class="text-blue-300 ml-2">[2601, 318, 26110, 879, 30]</span></div>
          <i data-lucide="arrow-down" class="text-gray-500 my-1 w-5 h-5"></i>
          <div class="flex items-center gap-4 border border-purple-500 rounded p-2 text-purple-300 text-sm">
            <div>토큰<br/>임베딩</div>
            <div class="flex gap-1">
              <div class="border border-purple-400 px-2">| ···</div>
              <div class="border border-purple-400 px-2">| ···</div>
              <div class="border border-purple-400 px-2">| ···</div>
              <div class="border border-purple-400 px-2">| ···</div>
              <div class="border border-purple-400 px-2">| ···</div>
            </div>
          </div>
          <i data-lucide="arrow-down" class="text-gray-500 my-1 w-5 h-5"></i>
          <div class="border border-gray-500 p-2 text-center text-sm">
            임베딩 행렬<br/>
            <span class="text-purple-300">(seq_len x d_model)</span>
          </div>
        </div>
        
        <div class="flex-1 text-orange-400 text-sm text-right">
          d_model =<br/>4096차원 벡터
        </div>
      </div>
    </section>

    <div class="flex justify-center"><i data-lucide="arrow-down" class="text-gray-500 w-6 h-6"></i></div>

    <!-- Step 4: Transformer Block -->
    <section class="relative border-2 border-dashed border-gray-600 rounded-xl p-6 md:p-10 pt-10 md:pt-12 w-full max-w-4xl mx-auto mt-10">
      <div class="absolute left-4 -top-5 bg-[#121212] px-3 flex items-center gap-3 whitespace-nowrap">
        <span class="text-2xl font-bold text-gray-400">④</span>
        <h2 class="text-xl md:text-2xl font-bold text-white border-0 m-0">트랜스포머 블록</h2>
        <span class="text-gray-400 text-sm whitespace-nowrap">(x N 레이어)</span>
      </div>

      <div class="flex flex-col lg:flex-row gap-8 mt-4">
        
        <!-- Main Flow inside Transformer -->
        <div class="flex-[3] flex flex-col items-center w-full">
          
          <!-- Multi-Head Self Attention -->
          <div class="border border-blue-500 rounded-lg p-4 w-full relative">
            <h3 class="text-blue-300 text-lg md:text-xl font-bold mb-4 text-center border-0 m-0">멀티헤드 셀프 어텐션</h3>
            <div class="flex justify-center gap-4 mb-4 text-sm">
              <div class="text-center">
                <div class="text-red-400 font-bold mb-1">Q</div>
                <div class="grid grid-cols-3 gap-1 border border-red-400 p-1 opacity-80">
                  <div class="w-2.5 h-2.5 bg-red-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-red-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-red-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-red-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-red-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-red-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-red-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-red-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-red-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-red-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-red-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-red-400/50"></div>
                </div>
                <div class="text-purple-300 mt-2 text-[10px]">(d_model x d_k)</div>
              </div>
              <div class="text-center">
                <div class="text-blue-400 font-bold mb-1">K</div>
                <div class="grid grid-cols-3 gap-1 border border-blue-400 p-1 opacity-80">
                  <div class="w-2.5 h-2.5 bg-blue-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-blue-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-blue-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-blue-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-blue-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-blue-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-blue-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-blue-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-blue-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-blue-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-blue-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-blue-400/50"></div>
                </div>
                <div class="text-purple-300 mt-2 text-[10px]">(d_model x d_k)</div>
              </div>
              <div class="text-center">
                <div class="text-green-400 font-bold mb-1">V</div>
                <div class="grid grid-cols-3 gap-1 border border-green-400 p-1 opacity-80">
                  <div class="w-2.5 h-2.5 bg-green-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-green-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-green-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-green-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-green-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-green-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-green-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-green-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-green-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-green-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-green-400/50"></div>
                  <div class="w-2.5 h-2.5 bg-green-400/50"></div>
                </div>
                <div class="text-purple-300 mt-2 text-[10px]">(d_model x d_v)</div>
              </div>
              
              <div class="flex flex-col justify-center items-center px-2">
                <i data-lucide="arrow-right" class="text-gray-500 w-5 h-5"></i>
              </div>
              
              <div class="text-center flex flex-col items-center ml-2">
                <div class="text-gray-300 mb-3 text-sm">어텐션 점수</div>
                <div class="flex items-center gap-2">
                  <div class="text-gray-400 text-xs">i</div>
                  <div class="grid grid-cols-4 gap-1 border border-gray-500 p-1 relative">
                    <div class="absolute -top-5 left-1/2 -translate-x-1/2 text-gray-400 text-xs">j</div>
                    <div class="w-3.5 h-3.5 bg-gray-200"></div>
                    <div class="w-3.5 h-3.5 bg-gray-700"></div>
                    <div class="w-3.5 h-3.5 bg-gray-700"></div>
                    <div class="w-3.5 h-3.5 bg-gray-700"></div>
                    <div class="w-3.5 h-3.5 bg-gray-700"></div>
                    <div class="w-3.5 h-3.5 bg-gray-200"></div>
                    <div class="w-3.5 h-3.5 bg-gray-700"></div>
                    <div class="w-3.5 h-3.5 bg-gray-700"></div>
                    <div class="w-3.5 h-3.5 bg-gray-700"></div>
                    <div class="w-3.5 h-3.5 bg-gray-700"></div>
                    <div class="w-3.5 h-3.5 bg-gray-200"></div>
                    <div class="w-3.5 h-3.5 bg-gray-700"></div>
                    <div class="w-3.5 h-3.5 bg-gray-700"></div>
                    <div class="w-3.5 h-3.5 bg-gray-700"></div>
                    <div class="w-3.5 h-3.5 bg-gray-700"></div>
                    <div class="w-3.5 h-3.5 bg-gray-200"></div>
                  </div>
                </div>
                <div class="mt-4 border border-orange-400 text-orange-300 rounded px-2 py-1 flex items-center bg-orange-400/10">
                  <span class="mr-1 text-[10px]">softmax</span>
                  <span class="border-l border-orange-400 pl-1 text-[10px]">(QK<sup>T</sup>) / √dk</span>
                </div>
              </div>
            </div>
          </div>

          <i data-lucide="arrow-down" class="text-gray-500 my-2 w-5 h-5"></i>
          
          <!-- Add & Norm 1 -->
          <div class="border border-gray-500 rounded-full px-6 py-2 text-sm flex items-center gap-2">
            <span class="border border-gray-400 rounded-full w-5 h-5 flex items-center justify-center text-sm">+</span>
            더하기 & 레이어 정규화
          </div>

          <i data-lucide="arrow-down" class="text-gray-500 my-2 w-5 h-5"></i>

          <!-- Feed Forward Network -->
          <div class="border border-blue-500 rounded-lg p-4 w-full flex flex-col items-center">
            <h3 class="text-blue-300 text-lg md:text-xl font-bold mb-3 border-0 m-0">피드포워드 네트워크 (FFN)</h3>
            <div class="flex items-center gap-2 text-sm">
              <div class="border border-purple-500 p-2 text-center rounded">
                선형층<br/><span class="text-purple-300 text-xs">(d_model x d_ff)</span>
              </div>
              <i data-lucide="arrow-right" class="text-gray-500 w-5 h-5"></i>
              <div class="border border-orange-500 p-2 text-center rounded text-orange-300">
                ReLU / SwiGLU<br/>
                <svg class="w-8 h-8 mx-auto mt-1" viewBox="0 0 40 40">
                  <path d="M 5 35 L 20 35 L 35 5" fill="none" stroke="currentColor" stroke-width="2" />
                </svg>
              </div>
              <i data-lucide="arrow-right" class="text-gray-500 w-5 h-5"></i>
              <div class="border border-purple-500 p-2 text-center rounded">
                선형층<br/><span class="text-purple-300 text-xs">(d_ff x d_model)</span>
              </div>
            </div>
          </div>

          <i data-lucide="arrow-down" class="text-gray-500 my-2 w-5 h-5"></i>

          <!-- Add & Norm 2 -->
          <div class="border border-gray-500 rounded-full px-6 py-2 text-sm flex items-center gap-2">
            <span class="border border-gray-400 rounded-full w-5 h-5 flex items-center justify-center text-sm">+</span>
            더하기 & 레이어 정규화
          </div>

        </div>

        <!-- Side Annotations (KV Cache & Bottlenecks) -->
        <div class="flex-1 flex flex-col gap-4 pl-4 lg:border-l border-dashed border-gray-600">
          
          <div class="text-orange-400 text-sm">
            디코드 단계:<br/>토큰을 하나씩 생성<br/>(메모리 병목)
          </div>

          <div class="border border-blue-500 rounded-lg p-3 text-sm">
            <h4 class="text-blue-300 text-base md:text-lg font-bold mb-2 border-0 m-0">KV 캐시 <span class="text-gray-400 font-normal">(레이어별)</span></h4>
            <div class="text-gray-400 mb-1">시간 t1, t2, t3 ... t</div>
            <div class="flex items-center gap-2 mb-1">
              <span class="text-blue-400 font-bold">K</span>
              <div class="flex gap-0.5">
                <div class="w-3 h-4 border border-gray-500 bg-gray-800/50"></div>
                <div class="w-3 h-4 border border-gray-500 bg-gray-800/50"></div>
                <div class="w-3 h-4 border border-gray-500 bg-gray-800/50"></div>
                <span class="text-gray-500">→</span>
                <div class="w-3 h-4 border border-dashed border-gray-500"></div>
              </div>
            </div>
            <div class="flex items-center gap-2 mb-2">
              <span class="text-green-400 font-bold">V</span>
              <div class="flex gap-0.5">
                <div class="w-3 h-4 border border-gray-500 bg-gray-800/50"></div>
                <div class="w-3 h-4 border border-gray-500 bg-gray-800/50"></div>
                <div class="w-3 h-4 border border-gray-500 bg-gray-800/50"></div>
                <span class="text-gray-500">→</span>
                <div class="w-3 h-4 border border-dashed border-gray-500"></div>
              </div>
            </div>
            <div class="text-orange-300 mt-2">
              → 이전 K,V 쌍 저장<br/>
              → 재계산 방지
            </div>
          </div>

          <div class="text-orange-400 text-sm mt-4">
            KV 캐시는 시퀀스 길이에 비례해 증가 - 주요 메모리 병목
          </div>

          <div class="border border-orange-500 rounded p-2 text-sm text-orange-300 mt-4">
            <span class="font-bold text-orange-400">FlashAttention:</span><br/>
            어텐션 연산을 합쳐 HBM 읽기 감소
          </div>

        </div>
      </div>
      
      <div class="absolute bottom-[-1.5rem] right-4 text-sm text-gray-500">x N 레이어 (GPT-4급 모델 기준)</div>
    </section>

    <div class="flex justify-center"><i data-lucide="arrow-down" class="text-gray-500 w-6 h-6"></i></div>

    <!-- Step 5: LM Head -->
    <section class="flex flex-col md:flex-row items-center justify-between w-full max-w-4xl mx-auto border-b border-gray-800 pb-8">
      <div class="flex items-center gap-2 w-full md:w-1/4 mb-4 md:mb-0">
        <span class="text-xl font-bold text-gray-400">⑤</span>
        <h2 class="text-lg md:text-xl font-bold text-white border-0 m-0">선형층 + 소프트맥스<br/><span class="text-gray-400 text-sm font-normal">(LM 헤드)</span></h2>
      </div>
      
      <div class="flex items-center gap-2 text-sm w-full md:w-3/4 justify-center md:justify-start">
        <div class="border border-purple-500 p-2 text-center rounded">
          선형층<br/><span class="text-purple-300 scale-75">(d_model x 128K)</span>
        </div>
        <i data-lucide="arrow-right" class="text-gray-500 w-5 h-5"></i>
        
        <div class="flex flex-col items-center">
          <div class="mb-1">로짓<br/><span class="text-gray-400 scale-75">(어휘 크기 = 128K)</span></div>
          <div class="flex items-end gap-1 h-8 border-b border-gray-600 px-2">
            <div class="w-1 h-4 bg-gray-400"></div>
            <div class="w-1 h-6 bg-gray-400"></div>
            <div class="w-1 h-2 bg-gray-400"></div>
            <span class="mx-1">...</span>
            <div class="w-1 h-7 bg-gray-400"></div>
          </div>
          <div class="flex justify-between w-full text-xs mt-1 text-gray-500"><span>1</span><span>128K</span></div>
        </div>
        
        <div class="flex flex-col items-center text-blue-400 mx-2">
          <span class="text-xs">소프트맥스</span>
          <i data-lucide="arrow-right" class="w-5 h-5"></i>
        </div>

        <div class="flex flex-col items-center">
          <div class="mb-1">어휘별 확률</div>
          <div class="flex items-end gap-1 h-8 border-b border-l border-gray-600 px-2 relative">
            <div class="absolute -left-4 top-0 text-[10px] text-gray-500">10⁰</div>
            <div class="absolute -left-4 bottom-2 text-[10px] text-gray-500">10⁻³</div>
            <div class="w-1 h-7 bg-blue-400"></div>
            <div class="w-1 h-5 bg-blue-400"></div>
            <div class="w-1 h-2 bg-blue-400"></div>
            <span class="mx-1">...</span>
            <div class="w-1 h-1 bg-blue-400"></div>
          </div>
          <div class="flex justify-between w-full text-xs mt-1 text-gray-500"><span>1</span><span>128K</span></div>
        </div>
      </div>
    </section>

    <!-- Step 6: Sampling Strategies -->
    <section class="flex flex-col md:flex-row items-start w-full max-w-4xl mx-auto border-b border-gray-800 pb-8 mt-8">
      <div class="flex items-center gap-2 w-full md:w-1/4 mb-4 md:mb-0">
        <span class="text-xl font-bold text-gray-400">⑥</span>
        <h2 class="text-xl md:text-2xl font-bold text-white border-0 m-0">샘플링 전략</h2>
      </div>
      
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full md:w-3/4">
        <div class="border border-green-500 rounded p-3 text-center flex flex-col items-center h-full bg-green-500/5">
          <div class="text-green-400 font-bold text-sm mb-1">그리디:</div>
          <div class="text-xs text-gray-300 mb-2">최대확률 선택</div>
          <div class="flex items-end gap-1 h-8 border-b border-gray-600">
             <div class="w-2.5 h-4 bg-gray-600"></div>
             <div class="w-2.5 h-7 bg-green-500 border border-white"></div>
             <div class="w-2.5 h-3 bg-gray-600"></div>
          </div>
        </div>
        
        <div class="border border-blue-500 rounded p-3 text-center flex flex-col items-center h-full bg-blue-500/5">
          <div class="text-blue-400 font-bold text-sm mb-1">Top-K:</div>
          <div class="text-xs text-gray-300 mb-2">상위 K 토큰</div>
          <div class="flex items-end gap-1 h-8 border-b border-gray-600">
             <div class="w-2 h-7 bg-blue-400"></div>
             <div class="w-2 h-5 bg-blue-400"></div>
             <div class="w-2 h-4 bg-blue-400"></div>
             <div class="w-2 h-2 bg-gray-600"></div>
          </div>
        </div>
 
        <div class="border border-orange-500 rounded p-3 text-center flex flex-col items-center h-full bg-orange-500/5">
          <div class="text-orange-400 font-bold text-sm mb-1 text-[11px] md:text-sm">Top-P(뉴클리어스):</div>
          <div class="text-xs text-gray-300 mb-2">누적확률 기준</div>
          <div class="flex items-end gap-1 h-8 border-b border-gray-600 relative">
             <div class="w-2 h-7 bg-orange-400"></div>
             <div class="w-2 h-4 bg-orange-400"></div>
             <div class="w-2 h-2 bg-gray-600"></div>
             <div class="absolute top-0 right-0 border-t border-r border-orange-400 w-6 h-6 rounded-tr"></div>
          </div>
        </div>
 
        <div class="border border-blue-300 rounded p-3 text-center flex flex-col items-center h-full bg-blue-300/5">
          <div class="text-blue-300 font-bold text-sm mb-1">Temperature:</div>
          <div class="text-[10px] text-gray-300">T→0 결정적</div>
          <div class="text-[10px] text-gray-300 mb-2">T→1 창의적</div>
          <div class="w-full h-6 border-b border-gray-600 mt-auto relative">
            <svg class="w-full h-full absolute bottom-0" preserveAspectRatio="none" viewBox="0 0 100 20">
               <path d="M0,20 Q50,0 100,20" fill="none" stroke="#60a5fa" stroke-width="2" />
            </svg>
          </div>
        </div>
      </div>
      
      <!-- Side Annotation for step 6 -->
       <div class="text-orange-400 text-sm w-full md:w-auto md:ml-4 mt-4 md:mt-0 text-right md:text-left">
          <span class="font-bold">양자화:</span><br/>
          INT8/INT4 가중치로<br/>메모리 2~4배 절감
      </div>
    </section>

    <!-- Step 7: Speculative Decoding -->
    <section class="flex flex-col md:flex-row items-start w-full max-w-4xl mx-auto mt-8 relative">
      <div class="flex items-center gap-2 w-full md:w-1/4 mb-4 md:mb-0">
        <span class="text-xl font-bold text-gray-400">⑦</span>
        <div>
          <h2 class="text-xl md:text-2xl font-bold text-white border-0 m-0">추측 디코딩</h2>
          <span class="text-gray-400 text-sm">(속도 트릭)</span>
        </div>
      </div>
      
      <div class="flex items-center text-sm w-full md:w-3/4 flex-wrap gap-2 justify-center md:justify-start">
        
        <div class="border border-green-500 rounded p-2 text-center">
          <div class="text-gray-300 mb-1">작은 초안 모델이<br/>후보 토큰 k개를<br/>빠르게 생성</div>
          <div class="flex gap-1 text-xs mt-2 justify-center">
            <span class="border border-gray-500 px-1 rounded bg-gray-800">중력</span>
            <span class="border border-gray-500 px-1 rounded bg-gray-800">이란</span>
            <span class="border border-gray-500 px-1 rounded bg-gray-800">무엇</span>
            <span class="border border-gray-500 px-1 rounded bg-gray-800">a</span>
          </div>
        </div>

        <i data-lucide="arrow-right" class="text-gray-500 w-5 h-5"></i>

        <div class="border border-blue-500 rounded p-2 text-center bg-[#1e293b]">
          <div class="text-white mb-2 font-bold">큰 목표 모델이<br/>병렬 검증</div>
          <div class="bg-blue-900/50 text-blue-300 border border-blue-400 px-2 py-1 rounded">
            토큰 4개 병렬 검증
          </div>
        </div>

        <i data-lucide="arrow-right" class="text-gray-500 w-5 h-5"></i>

        <div class="flex flex-col items-center">
           <div class="flex gap-3 mb-1">
             <div class="flex flex-col items-center text-green-400">
               <i data-lucide="check-circle-2" class="w-5 h-5 mb-1"></i>
               <span class="font-bold">중력</span>
               <span class="text-[10px] text-gray-500 mt-1">26110</span>
               <span class="text-[10px] bg-green-900/30 px-1 rounded">수락</span>
             </div>
             <div class="flex flex-col items-center text-green-400">
               <i data-lucide="check-circle-2" class="w-5 h-5 mb-1"></i>
               <span class="font-bold">이란</span>
               <span class="text-[10px] text-gray-500 mt-1">879</span>
               <span class="text-[10px] bg-green-900/30 px-1 rounded">수락</span>
             </div>
             <div class="flex flex-col items-center text-red-400">
               <i data-lucide="x-circle" class="w-5 h-5 mb-1"></i>
               <span class="font-bold">무엇</span>
               <span class="text-[10px] text-gray-500 mt-1">318</span>
               <span class="text-[10px] bg-red-900/30 px-1 rounded">거절</span>
             </div>
             <div class="flex flex-col items-center text-red-400 opacity-50">
               <i data-lucide="x-circle" class="w-5 h-5 mb-1"></i>
               <span class="font-bold">a</span>
               <span class="text-[10px] text-gray-500 mt-1">256</span>
               <span class="text-[10px] bg-red-900/30 px-1 rounded">거절</span>
             </div>
           </div>
        </div>

        <i data-lucide="arrow-right" class="text-gray-500 w-5 h-5"></i>

        <div class="border border-blue-500 rounded p-2 text-center">
          <div class="text-gray-300 mb-1">다음 토큰<br/>생성</div>
          <div class="text-xs border border-blue-400 px-1 rounded bg-blue-900/30 text-blue-200 mt-1">fundamental</div>
          <div class="text-xs text-gray-500 mt-1">17042</div>
        </div>

      </div>
    </section>

  </div>
</div>

<script>
  lucide.createIcons();
</script>
{{< /rawhtml >}}
