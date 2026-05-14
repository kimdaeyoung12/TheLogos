+++
title = "AI의 두 축을 관통하는 철학: 강화학습(RL)은 연역적이고, LLM은 귀납적이다?"
date = 2026-05-11T09:52:19+09:00
draft = false
categories = ["engineering"]
tags = ["LLM", "강화학습", "RL", "귀납법", "연역법", "RLHF", "인공지능"]
+++

최근 챗GPT를 비롯한 인공지능 기술이 폭발적으로 발전하면서, 수많은 기술 용어와 구조도들이 쏟아져 나오고 있습니다. 하지만 이 거대한 AI의 흐름을 수식이나 코드가 아닌, '철학적 추론 방식'으로 접근해 보면 어떨까요?

현재 AI를 이끄는 두 가지 핵심 알고리즘인 강화학습(RL)과 거대 언어 모델(LLM)은 그 태생부터 세상을 이해하는 방식이 완전히 다릅니다. 결론부터 말하자면, LLM은 철저히 귀납적(Inductive)이고 데이터 중심적이며, 강화학습은 연역적(Deductive)이고 목적 지향적입니다.

이 두 가지 관점이 어떻게 다른지, 그리고 왜 이 둘의 만남이 현대 AI의 혁신을 이끌어냈는지 철학적 시선으로 분석해 봅니다.

## 1. LLM (거대 언어 모델): 귀납적 추론을 하는 '데이터 중심의 학자'

LLM(Large Language Model)은 본질적으로 데이터 중심적(Data-Centric)입니다.

초기 학습(Pre-training) 단계의 LLM에게는 세상을 구하기 위해서라거나, 훌륭한 시를 쓰라는 거창한 '목적'이 없습니다. 그저 인터넷이라는 바다에 존재하는 수조 개의 단어 데이터를 묵묵히 들이마실 뿐입니다.

이는 철학의 귀납적 접근(Inductive Approach)과 정확히 맞닿아 있습니다.

*   **바텀업(Bottom-Up) 방식의 지식 형성**: 귀납법은 수많은 개별 사례들을 관찰하여 하나의 보편적인 일반 규칙을 찾아내는 논리입니다. (예: 매일 관찰해보니 해가 동쪽에서 뜬다 -> 고로 태양은 동쪽에서 뜬다)
*   **LLM의 뇌 구조**: LLM은 문법책을 먼저 읽고 말을 배운 것이 아닙니다. 수십억 개의 문장(개별 사례)을 통계적으로 관찰한 뒤, 그 안에서 "이 단어 다음에는 보통 저 단어가 오더라", "사과와 바나나는 과일이라는 군집에 속하더라"라는 잠재적이고 보편적인 규칙을 스스로 귀납하여 뇌 속에 형성합니다.

이처럼 LLM은 방대한 데이터를 통해 세상의 '패턴'을 귀납적으로 모사해 낸, 매우 유창하지만 뚜렷한 목표 의식은 없는 학자에 가깝습니다.

## 2. RL (강화학습): 연역적 추론을 하는 '목적 지향적 탐험가'

반면 알파고나 로봇 제어, 자율주행 등에 주로 쓰이는 강화학습(Reinforcement Learning)은 목적 지향적(Goal-Oriented)입니다.

강화학습에는 LLM이 먹어 치우는 방대한 '텍스트 데이터셋'이라는 개념보다, '보상(Reward)'이라는 절대적인 목표가 훨씬 중요합니다. 로봇에게 걷는 법을 가르칠 때 인간이 걷는 영상(데이터)을 수만 시간 보여주는 것이 아니라, "넘어지지 않고 앞으로 나아가면 +1점"이라는 목적만 던져줍니다.

이것은 철학의 연역적 접근(Deductive Approach)과 놀랍도록 닮아 있습니다.

*   **탑다운(Top-Down) 방식의 행동 도출**: 연역법은 확실한 대전제(진리)를 최상단에 두고, 이를 바탕으로 개별적인 사실들의 결론을 논리적으로 이끌어냅니다.
*   **RL의 뇌 구조**: 강화학습 에이전트의 뇌 속에 있는 유일한 대전제는 "누적 보상의 극대화가 최선이다"라는 명제입니다. 에이전트는 이 뚜렷한 진리를 꼭대기에 두고, "지금 이 행동을 하면 궁극적인 대전제(보상)를 달성하는 데 논리적으로 부합하는가?"를 역산하여 행동의 가치를 연역적으로 증명하고 교정해 나갑니다.

때문에 강화학습은 데이터에 얽매이지 않고 인간이 상상하지 못한 창의적인 수(알파고의 37수 등)를 스스로 창조해 낼 수 있는 힘을 가집니다.

## 3. 완벽한 융합: 귀납적 지식에 연역적 나침반을 쥐여주다 (RLHF)

그렇다면 우리가 매일 사용하는 똑똑한 ChatGPT는 둘 중 어느 쪽일까요? 정답은 '두 철학의 경이로운 결합'입니다.

과거의 LLM은 귀납적으로 수닙많은 지식을 쌓아 유창하게 말할 수 있었지만, 무엇이 진실인지, 무엇이 인간에게 유익한지 판단할 기준(목적)이 없었습니다. 그래서 거짓말을 그럴듯하게 하는 환각(Hallucination) 현상이 심했죠.

현대의 AI 연구자들은 이 딜레마를 해결하기 위해 RLHF(인간 피드백 기반 강화학습)라는 기술을 도입했습니다.

*   **1단계 (귀납적 지식 흡수)**: 먼저 LLM이 세상의 모든 텍스트를 귀납적으로 관찰하여 방대한 개념의 지도를 만듭니다.
*   **2단계 (연역적 방향성 제시)**: 이렇게 똑똑해진 모델에게 강화학습(RL)을 도입합니다. "인간의 의도에 맞고 안전하고 논리적인 답변을 하는 것이 가장 높은 보상이다"라는 뚜렷한 대전제(목적)를 주고 행동(답변)을 연역적으로 교정합니다.

데이터에서 세상의 의미를 찾아내는 '귀납적 뇌(LLM)'에게, 뚜렷한 목표를 향해 전략을 세우는 '연역적 나침반(RL)'을 장착시킨 것. 이것이 바로 현재 우리가 마주하고 있는 인공지능 혁신의 본질입니다.

## 마치며

AI 기술이 아무리 복잡한 수학과 코드로 이루어져 있다 하더라도, 결국 그것이 세상을 학습하고 문제를 해결하는 방식은 인류가 수천 년간 고민해 온 철학적 사유의 방식(귀납과 연역)을 그대로 투영하고 있습니다. 기술을 이런 철학적 렌즈를 통해 바라볼 때, 우리는 다가올 AI의 미래를 조금 더 선명하게 이해할 수 있을 것입니다.

{{< rawhtml >}}
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    corePlugins: {
      preflight: false,
    }
  }
</script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
    @import url('https://fonts.googleapis.com/css2?family=Pretendard:wght@300;400;600;700&display=swap');
    .custom-container { font-family: 'Pretendard', sans-serif; background-color: transparent; color: #f1f5f9; }
    .chart-container { position: relative; width: 100%; max-width: 800px; margin-left: auto; margin-right: auto; height: 350px; }
    .nav-link { color: #94a3b8; transition: color 0.3s; }
    .nav-link:hover { color: #6366f1; }
    .nav-link.active { border-bottom: 2px solid #6366f1; color: #6366f1; }
    .card-hover:hover { transform: translateY(-4px); transition: all 0.3s ease; }
    .glass { background: rgba(30, 41, 59, 0.7); backdrop-filter: blur(10px); border: 1px solid rgba(71, 85, 105, 0.5); }
    .glass-light { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.1); }
</style>

<div class="custom-container antialiased overflow-x-hidden pt-8">

    <nav class="relative w-full z-10 glass shadow-xl px-6 py-4 rounded-2xl mb-12">
        <div class="max-w-6xl mx-auto flex justify-between items-center">
            <h1 class="font-bold text-xl tracking-tight text-indigo-300 m-0 border-0">AI Philosophy Explorer</h1>
            <div class="hidden md:flex space-x-8 text-sm font-semibold">
                <a href="#philosophy" class="nav-link">철학적 구분</a>
                <a href="#rl-section" class="nav-link">강화학습(RL)</a>
                <a href="#llm-section" class="nav-link">언어모델(LLM)</a>
                <a href="#synthesis" class="nav-link">융합(RLHF)</a>
            </div>
        </div>
    </nav>

    <div class="pb-20 px-6">
        <!-- Hero Section -->
        <section id="philosophy" class="max-w-6xl mx-auto py-8 text-center">
            <h2 class="text-4xl md:text-5xl font-extrabold mb-6 leading-tight mt-0 border-0">AI의 두 축: <br><span class="text-emerald-400">연역적 탐험</span>과 <span class="text-indigo-400">귀납적 통찰</span></h2>
            <p class="text-lg md:text-xl text-slate-400 leading-relaxed mb-10 max-w-4xl mx-auto">
                현대 인공지능은 세상을 이해하는 두 가지 오래된 철학적 방식을 계승했습니다. 
                목표를 설정하고 거꾸로 행동을 최적화하는 <strong>강화학습(RL)</strong>과, 
                방대한 데이터에서 패턴을 발견해 일반적인 규칙을 찾아내는 <strong>거대 언어 모델(LLM)</strong>이 그 주인공입니다. 
                이 섹션에서는 두 모델의 근본적인 사고방식 차이를 대조해 봅니다.
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                <div class="p-8 rounded-2xl glass border-emerald-500/20 card-hover">
                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center mr-3 text-emerald-400 font-bold">RL</div>
                        <h3 class="text-xl font-bold text-emerald-400 m-0 border-0">연역적 탐험가 (Deductive)</h3>
                    </div>
                    <p class="text-sm text-slate-400 mb-4 italic">"누적 보상 극대화라는 대전제를 증명하기 위해 행동한다."</p>
                    <ul class="space-y-2 text-sm m-0 p-0 list-none">
                        <li class="flex items-start">
                            <span class="mr-2 text-emerald-500">•</span>
                            <span><strong class="text-emerald-300">목적 중심:</strong> 보상 함수가 모든 의사결정의 최상위 원칙</span>
                        </li>
                        <li class="flex items-start">
                            <span class="mr-2 text-emerald-500">•</span>
                            <span><strong class="text-emerald-300">시행착오:</strong> 환경과 부딪히며 경험을 통해 정책 갱신</span>
                        </li>
                    </ul>
                </div>
                <div class="p-8 rounded-2xl glass border-indigo-500/20 card-hover">
                    <div class="flex items-center mb-4">
                        <div class="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center mr-3 text-indigo-400 font-bold">LLM</div>
                        <h3 class="text-xl font-bold text-indigo-400 m-0 border-0">귀납적 학자 (Inductive)</h3>
                    </div>
                    <p class="text-sm text-slate-400 mb-4 italic">"수조 개의 텍스트 데이터에서 보편적 패턴을 길어 올린다."</p>
                    <ul class="space-y-2 text-sm m-0 p-0 list-none">
                        <li class="flex items-start">
                            <span class="mr-2 text-indigo-500">•</span>
                            <span><strong class="text-indigo-300">데이터 중심:</strong> 데이터의 통계적 분포가 모델의 정체성</span>
                        </li>
                        <li class="flex items-start">
                            <span class="mr-2 text-indigo-500">•</span>
                            <span><strong class="text-indigo-300">패턴 매칭:</strong> 다음 단어를 예측하며 문맥적 의미 형성</span>
                        </li>
                    </ul>
                </div>
            </div>
        </section>

        <!-- RL Section -->
        <section id="rl-section" class="max-w-6xl mx-auto py-16 border-t border-slate-800">
            <div class="flex flex-col lg:flex-row gap-12 items-center">
                <div class="flex-1">
                    <span class="text-emerald-500 font-bold tracking-widest text-xs uppercase">Reinforcement Learning</span>
                    <h2 class="text-3xl font-bold mt-2 mb-6 text-slate-100 border-0">보상으로 배우는 지능</h2>
                    <p class="text-slate-400 mb-6 leading-relaxed">
                        강화학습은 정답지가 없는 환경에서 <strong>'보상(Reward)'</strong>이라는 유일한 이정표를 따라 학습합니다. 
                        AWS 리포트에 따르면, 에이전트는 환경과 끊임없이 상호작용하며 현재 상태를 파악하고 행동을 결정합니다. 
                        이 과정은 마치 미로를 탈출하는 쥐가 치즈를 향해 전략을 수정해 나가는 것과 같으며, 
                        장기적으로 가장 큰 이득을 주는 <strong>'정책'</strong>을 연역적으로 완성해 나가는 과정입니다.
                    </p>
                    <div class="bg-emerald-500/10 p-6 rounded-xl border border-emerald-500/20">
                        <h4 class="font-bold text-emerald-400 mb-3 text-sm m-0 border-0">학습의 핵심: 정책 파라미터 자동 갱신</h4>
                        <p class="text-xs text-emerald-300/80 leading-relaxed m-0">
                            사용자가 "행동 A"를 선택했을 때 큰 보상을 얻으면, 에이전트 내부의 함수 가중치($\theta$)는 행동 A를 할 확률을 높이는 방향으로 즉시 수정됩니다. 
                            이는 사람이 코드를 수정하는 '룰베이스'가 아닌, 데이터가 스스로 로직을 만드는 '기계학습'의 본질입니다.
                        </p>
                    </div>
                </div>
                <div class="flex-1 w-full bg-[#1e293b] p-6 rounded-2xl shadow-2xl border border-slate-700">
                    <h4 class="text-center font-bold text-slate-300 mb-4 text-sm m-0 border-0">에피소드 반복에 따른 누적 보상 최적화</h4>
                    <div class="chart-container">
                        <canvas id="rlChart"></canvas>
                    </div>
                    <div class="mt-6 flex justify-center space-x-4">
                        <button onclick="updateRLData()" class="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors border-0 cursor-pointer">에피소드 시뮬레이션</button>
                        <button onclick="resetRLData()" class="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-slate-200 border-0 cursor-pointer">초기화</button>
                    </div>
                </div>
            </div>
        </section>

        <!-- LLM Section -->
        <section id="llm-section" class="max-w-6xl mx-auto py-16 border-t border-slate-800">
            <div class="text-center mb-12">
                <span class="text-indigo-400 font-bold tracking-widest text-xs uppercase">Large Language Model</span>
                <h2 class="text-3xl font-bold mt-2 mb-4 text-slate-100 border-0">텍스트 우주에서의 귀납적 추론</h2>
                <p class="max-w-3xl mx-auto text-slate-400 leading-relaxed">
                    카카오페이 기술 블로그가 설명하는 LLM의 작동 원리는 6단계의 정밀한 파이프라인으로 구성됩니다. 
                    이 모든 단계는 인간의 언어 데이터를 숫자의 공간(벡터 공간)으로 옮겨와, 
                    문맥 속에서 가장 확률이 높은 단어를 골라내는 '확률 기반 생성기'의 역할을 수행합니다.
                </p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div class="lg:col-span-1 space-y-4">
                    <div id="step-btn-1" onclick="showStep(1)" class="p-4 rounded-xl glass border-indigo-500/30 cursor-pointer hover:bg-indigo-500/20 transition-all step-btn active-step">
                        <h4 class="font-bold text-indigo-300 m-0 border-0">Step 1: Tokenization</h4>
                        <p class="text-[10px] text-slate-400 mt-1 mb-0 uppercase tracking-wider">문장을 의미 단위(토큰)로 분해</p>
                    </div>
                    <div id="step-btn-2" onclick="showStep(2)" class="p-4 rounded-xl glass border-slate-700 cursor-pointer hover:bg-indigo-500/20 transition-all step-btn">
                        <h4 class="font-bold text-slate-300 m-0 border-0">Step 2: Embedding</h4>
                        <p class="text-[10px] text-slate-400 mt-1 mb-0 uppercase tracking-wider">토큰을 고차원 벡터 좌표로 변환</p>
                    </div>
                    <div id="step-btn-3" onclick="showStep(3)" class="p-4 rounded-xl glass border-slate-700 cursor-pointer hover:bg-indigo-500/20 transition-all step-btn">
                        <h4 class="font-bold text-slate-300 m-0 border-0">Step 3: Attention</h4>
                        <p class="text-[10px] text-slate-400 mt-1 mb-0 uppercase tracking-wider">단어 간의 문맥적 관계 가중치 계산</p>
                    </div>
                    <div id="step-btn-4" onclick="showStep(4)" class="p-4 rounded-xl glass border-slate-700 cursor-pointer hover:bg-indigo-500/20 transition-all step-btn">
                        <h4 class="font-bold text-slate-300 m-0 border-0">Step 4: Prediction</h4>
                        <p class="text-[10px] text-slate-400 mt-1 mb-0 uppercase tracking-wider">다음 토큰의 확률 분포 생성</p>
                    </div>
                </div>

                <div class="lg:col-span-2 bg-slate-900 rounded-3xl p-8 text-white min-h-[400px] flex flex-col justify-center relative overflow-hidden">
                    <div id="step-content" class="relative z-10">
                        <!-- Dynamic Content -->
                        <h3 class="text-2xl font-bold text-indigo-400 mb-4 mt-0 border-0" id="step-title">Tokenization</h3>
                        <p class="text-slate-300 leading-relaxed mb-6" id="step-desc">
                            인간이 이해하는 문장을 AI가 처리할 수 있는 가장 작은 단위인 '토큰'으로 나눕니다. 
                            단어 단위가 아닌 '서브워드(Subword)' 방식을 사용하여 신조어나 오타에도 유연하게 대응합니다.
                        </p>
                        <div class="bg-slate-800 p-4 rounded-lg font-mono text-sm border border-slate-700" id="step-example">
                            "나는 공부한다" → ["나", "는", " 공", "부", "한다"]
                        </div>
                    </div>
                    <!-- Visual Background Decoration (CSS only) -->
                    <div class="absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-600/20 rounded-full blur-3xl"></div>
                </div>
            </div>
        </section>

        <!-- Synthesis Section -->
        <section id="synthesis" class="max-w-7xl mx-auto py-16 text-center">
            <div class="bg-gradient-to-br from-indigo-950 to-emerald-950 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden border border-white/10">
                <h2 class="text-3xl md:text-4xl font-bold mb-6 mt-0 border-0 text-white">융합의 혁명: RLHF</h2>
                <p class="text-indigo-200 leading-relaxed mb-8 max-w-4xl mx-auto text-lg">
                    방대한 데이터를 귀납적으로 습득한 LLM은 유창하지만 '목적'이 없었습니다. 
                    여기에 강화학습(RL)의 '보상 체계'를 도입한 것이 바로 <strong>RLHF(인간 피드백 기반 강화학습)</strong>입니다. 
                    귀납적 지식에 연역적 나침반을 쥐여줌으로써, AI는 단순한 문장 생성을 넘어 
                    인간의 의도에 부합하는 가치 있는 답변을 생성하게 되었습니다.
                </p>
                <div class="flex flex-col md:flex-row justify-center items-center gap-6">
                    <div class="px-8 py-4 bg-white/5 rounded-full border border-white/10 text-sm font-bold tracking-wide">귀납적 지식 (LLM)</div>
                    <div class="px-2 text-2xl font-light opacity-50">+</div>
                    <div class="px-8 py-4 bg-white/10 rounded-full border border-white/20 text-sm font-bold tracking-wide">연역적 방향성 (RL)</div>
                    <div class="px-2 text-2xl font-light opacity-50">=</div>
                    <div class="px-8 py-4 bg-indigo-500 rounded-full shadow-lg text-sm font-black text-white uppercase">인간 친화적 AI</div>
                </div>
            </div>
        </section>
    </div>

    <script>
        // --- Chart Management ---
        let rlChart;
        const rlLabels = ['Step 0', 'Step 10', 'Step 20', 'Step 30', 'Step 40', 'Step 50'];
        let rlData = [10, 15, 30, 65, 85, 98];

        function initRLChart() {
            const ctx = document.getElementById('rlChart').getContext('2d');
            rlChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: rlLabels,
                    datasets: [{
                        label: '누적 기대 보상 (Cumulative Reward)',
                        data: rlData,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.4,
                        pointRadius: 6,
                        pointBackgroundColor: '#10b981'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, max: 120, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
                        x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: function(context) { return `보상 지수: ${context.parsed.y}`; }
                            }
                        }
                    }
                }
            });
        }

        function updateRLData() {
            // Simulate learning improvement
            rlData = rlData.map(v => Math.min(100, v + Math.random() * 5));
            rlChart.data.datasets[0].data = rlData;
            rlChart.update();
        }

        function resetRLData() {
            rlData = [5, 12, 18, 25, 40, 55];
            rlChart.data.datasets[0].data = rlData;
            rlChart.update();
        }

        // --- LLM Stepper Management ---
        const steps = {
            1: {
                title: "Tokenization (토큰화)",
                desc: "문장을 AI가 이해하는 최소 단위로 분해합니다. 단순히 띄어쓰기가 아니라, 의미를 가진 가장 작은 조각들로 나누어 언어의 통계적 패턴을 분석할 준비를 합니다.",
                example: "입력: '인공지능은 재미있다' → 토큰: ['인공', '지능', '은', ' 재미', '있다']"
            },
            2: {
                title: "Embedding (임베딩)",
                desc: "나뉘어진 토큰을 수천 차원의 공간 속 좌표로 변환합니다. 이 공간에서 '사과'와 '배'는 가까운 위치에, '사과'와 '자동차'는 먼 위치에 배치되어 단어 간 의미 관계를 수학적으로 파악합니다.",
                example: "토큰 '지능' → [0.12, -0.45, 0.88, ... 768차원]"
            },
            3: {
                title: "Self-Attention (주의 집중)",
                desc: "문장 내의 단어들이 서로 어떤 관계를 맺고 있는지 계산합니다. '그는 배를 탔다'에서 '배'가 먹는 과일인지 타는 운송수단인지 주변 단어와의 가중치를 통해 결정합니다.",
                example: "Attention Map: '배'는 '탔다'와 85%의 연관성을 가짐"
            },
            4: {
                title: "Next Token Prediction (예측)",
                desc: "이전까지의 문맥과 계산된 가중치를 바탕으로, 다음에 올 확률이 가장 높은 단어를 어휘 사전에서 골라냅니다. 이것이 LLM의 귀납적 추론의 최종 결과물입니다.",
                example: "다음 후보 확률: '공부' (0.72), '운동' (0.15), '수면' (0.03)"
            }
        };

        function showStep(stepNum) {
            // Update Buttons
            document.querySelectorAll('.step-btn').forEach(btn => {
                btn.classList.remove('active-step', 'border-indigo-200', 'bg-indigo-50');
                btn.classList.add('border-slate-100');
                btn.querySelector('h4').classList.remove('text-indigo-800');
                btn.querySelector('h4').classList.add('text-slate-700');
            });

            const activeBtn = document.getElementById(`step-btn-${stepNum}`);
            activeBtn.classList.add('active-step', 'border-indigo-200', 'bg-indigo-50');
            activeBtn.querySelector('h4').classList.replace('text-slate-700', 'text-indigo-800');

            // Update Content with simple transition effect
            const contentArea = document.getElementById('step-content');
            contentArea.style.opacity = 0;
            
            setTimeout(() => {
                document.getElementById('step-title').innerText = steps[stepNum].title;
                document.getElementById('step-desc').innerText = steps[stepNum].desc;
                document.getElementById('step-example').innerText = steps[stepNum].example;
                contentArea.style.opacity = 1;
            }, 150);
        }

        // --- Initialization ---
        window.addEventListener('load', () => {
            initRLChart();
            
            // Simple Navigation Active State on Scroll
            window.addEventListener('scroll', () => {
                const sections = ['philosophy', 'rl-section', 'llm-section', 'synthesis'];
                let current = '';

                sections.forEach(section => {
                    const element = document.getElementById(section);
                    if (element && window.pageYOffset >= (element.offsetTop - 150)) {
                        current = section;
                    }
                });

                document.querySelectorAll('.nav-link').forEach(link => {
                    link.classList.remove('active');
                    if (current && link.getAttribute('href').includes(current)) {
                        link.classList.add('active');
                    }
                });
            });
        });
    </script>
</div>
{{< /rawhtml >}}

{{< rawhtml >}}
<div class="mle-ecr-visualization my-16 antialiased text-slate-700">
    <style>
        .mle-ecr-visualization .tab-active { border-bottom: 2px solid #6366f1; color: #818cf8 !important; font-weight: 600; }
        .mle-ecr-visualization .tab-inactive { border-bottom: 2px solid transparent; color: #94a3b8; }
        .mle-ecr-visualization .tab-inactive:hover { color: #818cf8; }
        .mle-ecr-visualization button { cursor: pointer; transition: all 0.2s; }
        .mle-ecr-visualization h1, .mle-ecr-visualization h2, .mle-ecr-visualization h3, .mle-ecr-visualization h4 { border: none !important; margin: 0; }
    </style>

    <div class="max-w-6xl mx-auto bg-[#1e293b] rounded-3xl shadow-2xl overflow-hidden border border-slate-700">
        <!-- Header -->
        <div class="bg-slate-900 text-white p-8 md:p-10 border-b border-slate-800">
            <h2 class="text-2xl md:text-3xl font-bold mb-3 text-white">수학적 매커니즘: MLE vs ECR</h2>
            <p class="text-slate-400 text-lg">데이터를 설명하는 MLE(귀납)와 미래 가치를 극대화하는 ECR(연역)의 시각화</p>
        </div>

        <!-- Navigation -->
        <div class="flex border-b border-slate-800 px-8 pt-4 bg-[#0f172a]">
            <button id="btn-mle-v2" class="px-8 py-4 tab-active bg-transparent text-sm md:text-base border-0 outline-none" onclick="switchTabV2('mle')">
                1. 최대 우도 추정 (MLE) - LLM
            </button>
            <button id="btn-ecr-v2" class="px-8 py-4 tab-inactive bg-transparent text-sm md:text-base border-0 outline-none" onclick="switchTabV2('ecr')">
                2. 기대 누적 보상 (ECR) - RL
            </button>
        </div>

        <!-- Content Area -->
        <div class="p-8 md:p-10">
            
            <!-- MLE Section -->
            <div id="section-mle-v2" class="block">
                <div class="grid lg:grid-cols-2 gap-12 items-start">
                    <!-- Text Description -->
                    <div>
                        <h3 class="text-xl font-bold text-slate-200 mb-4 border-0">최대 우도 추정 (Maximum Likelihood Estimation)</h3>
                        <p class="mb-4 text-slate-400 leading-relaxed">
                            이미 관측된 데이터가 발생할 확률을 극대화하는 파라미터를 찾는 과정입니다. 이는 수많은 개별 사례(데이터)로부터 보편적 규칙을 이끌어내는 <strong>귀납적(Inductive)</strong> 사고의 정수입니다.
                        </p>
                        
                        <div class="bg-blue-500/10 p-6 rounded-2xl border border-blue-500/20 mb-6">
                            <h4 class="font-bold text-blue-300 mb-2 border-0">실습: 확률 분포 맞추기</h4>
                            <p class="text-sm text-blue-200/70 mb-6">슬라이더를 움직여 파란색 곡선(모델의 가설)이 검은 점(실제 데이터)의 분포를 가장 잘 설명하도록 위치를 맞춰보세요.</p>
                            
                            <div class="px-2">
                                <label for="mle-slider-v2" class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">모델 파라미터 (평균 $\mu$)</label>
                                <input type="range" id="mle-slider-v2" min="0" max="100" value="25" class="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500">
                                <div class="flex justify-between text-[10px] text-slate-500 mt-2 font-mono">
                                    <span>LOW VALUE</span>
                                    <span>OPTIMAL (50)</span>
                                    <span>HIGH VALUE</span>
                                </div>
                            </div>
                        </div>
 
                        <div class="p-5 bg-slate-900/50 rounded-2xl border border-slate-800 flex items-center justify-between">
                            <span class="text-sm font-semibold text-slate-500">Likelihood Score</span>
                            <span id="mle-score-v2" class="text-2xl font-black text-blue-400 uppercase">Low</span>
                        </div>
                    </div>
                    
                    <!-- Graph -->
                    <div class="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-inner h-[350px]">
                        <canvas id="mleChartV2"></canvas>
                    </div>
                </div>
            </div>

            <!-- ECR Section -->
            <div id="section-ecr-v2" class="hidden">
                <div class="grid lg:grid-cols-2 gap-12 items-start">
                    <!-- Text Description -->
                    <div>
                        <h3 class="text-xl font-bold text-slate-200 mb-4 border-0">기대 누적 보상 (Expected Cumulative Reward)</h3>
                        <p class="mb-4 text-slate-400 leading-relaxed">
                            강화학습은 현재의 이익이 아닌, 미래에 얻을 모든 보상의 총합을 최대화하도록 행동합니다. 궁극적인 목표를 상정하고 현재의 행동 가치를 결정하는 <strong>연역적(Deductive)</strong> 사고방식입니다.
                        </p>
                        
                        <div class="bg-emerald-500/10 p-6 rounded-2xl border border-emerald-500/20 mb-6">
                            <h4 class="font-bold text-emerald-300 mb-2 border-0">실습: 전략 시뮬레이션</h4>
                            <p class="text-sm text-emerald-200/70 mb-6">당장 눈앞의 이익을 쫓는 '전략 A'와 초기 손실을 감수하더라도 최종 보상을 노리는 '전략 B'를 비교해보세요.</p>
                            
                            <div class="flex gap-3">
                                <button onclick="animateEcrV2('greedy')" class="flex-1 bg-slate-800 border border-slate-700 text-slate-300 py-3 px-4 rounded-xl hover:bg-slate-700 font-semibold text-sm border-0 cursor-pointer">전략 A (단기 이익)</button>
                                <button onclick="animateEcrV2('optimal')" class="flex-1 bg-emerald-600 text-white py-3 px-4 rounded-xl hover:bg-emerald-700 font-semibold text-sm shadow-lg shadow-emerald-900/20 border-0 cursor-pointer">전략 B (장기 가치)</button>
                            </div>
                        </div>
 
                        <div class="p-5 bg-slate-900/50 rounded-2xl border border-slate-800 flex items-center justify-between">
                            <span class="text-sm font-semibold text-slate-500">Total Cumulative Return</span>
                            <span id="ecr-score-v2" class="text-2xl font-black text-emerald-400">0</span>
                        </div>
                    </div>
                    
                    <!-- Graph -->
                    <div class="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-inner h-[350px]">
                        <canvas id="ecrChartV2"></canvas>
                    </div>
                </div>
            </div>

        </div>
    </div>

    <script>
        // --- Tab Switching Logic ---
        function switchTabV2(tab) {
            const mleSection = document.getElementById('section-mle-v2');
            const ecrSection = document.getElementById('section-ecr-v2');
            const btnMle = document.getElementById('btn-mle-v2');
            const btnEcr = document.getElementById('btn-ecr-v2');

            if (tab === 'mle') {
                mleSection.classList.remove('hidden');
                mleSection.classList.add('block');
                ecrSection.classList.remove('block');
                ecrSection.classList.add('hidden');
                
                btnMle.className = 'px-8 py-4 tab-active bg-transparent text-sm md:text-base';
                btnEcr.className = 'px-8 py-4 tab-inactive bg-transparent text-sm md:text-base';
            } else {
                mleSection.classList.remove('block');
                mleSection.classList.add('hidden');
                ecrSection.classList.remove('hidden');
                ecrSection.classList.add('block');
                
                btnMle.className = 'px-8 py-4 tab-inactive bg-transparent text-sm md:text-base';
                btnEcr.className = 'px-8 py-4 tab-active bg-transparent text-sm md:text-base';
            }
        }

        (function() {
            // --- Chart 1: MLE ---
            const ctxMle = document.getElementById('mleChartV2').getContext('2d');
            const groundTruthData = [];
            for (let i = 10; i <= 90; i += 4) {
                const noise = (Math.random() - 0.5) * 8;
                const y = 100 * Math.exp(-Math.pow(i - 50, 2) / (2 * Math.pow(12, 2))) + noise;
                groundTruthData.push({x: i, y: Math.max(0, y)});
            }

            const mleChart = new Chart(ctxMle, {
                type: 'scatter',
                data: {
                    datasets: [
                        {
                            label: '관측 데이터',
                            data: groundTruthData,
                            backgroundColor: '#94a3b8',
                            pointRadius: 4,
                            zIndex: 1
                        },
                        {
                            type: 'line',
                            label: '모델 가설',
                            data: [],
                            borderColor: '#3b82f6',
                            borderWidth: 4,
                            tension: 0.4,
                            pointRadius: 0,
                            fill: true,
                            backgroundColor: 'rgba(59, 130, 246, 0.05)',
                            zIndex: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { min: 0, max: 100, grid: { display: false }, ticks: { color: '#64748b' } },
                        y: { min: -5, max: 120, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748b' } }
                    },
                    plugins: {
                        legend: { display: false }
                    },
                    animation: { duration: 0 }
                }
            });

            const slider = document.getElementById('mle-slider-v2');
            const scoreDisp = document.getElementById('mle-score-v2');

            function updateMle() {
                const mu = parseFloat(slider.value);
                const newData = [];
                for (let i = 0; i <= 100; i += 2) {
                    const y = 100 * Math.exp(-Math.pow(i - mu, 2) / (2 * Math.pow(12, 2)));
                    newData.push({x: i, y: y});
                }
                mleChart.data.datasets[1].data = newData;
                mleChart.update();

                const dist = Math.abs(50 - mu);
                if (dist < 3) { scoreDisp.innerText = "MAXIMUM!"; scoreDisp.className = "text-2xl font-black text-blue-400 animate-pulse"; }
                else if (dist < 15) { scoreDisp.innerText = "MEDIUM"; scoreDisp.className = "text-2xl font-black text-amber-400"; }
                else { scoreDisp.innerText = "LOW"; scoreDisp.className = "text-2xl font-black text-slate-500"; }
            }
            slider.addEventListener('input', updateMle);
            updateMle();

            // --- Chart 2: ECR ---
            const ctxEcr = document.getElementById('ecrChartV2').getContext('2d');
            const labels = Array.from({length: 11}, (_, i) => i === 10 ? 'GOAL' : `t=${i}`);
            const greedyPath = [0, 15, 28, 35, 38, 40, 41, 41.5, 42, 42, 42]; 
            const optimalPath = [0, -2, -5, 0, 10, 25, 50, 85, 130, 180, 240]; 

            const ecrChart = new Chart(ctxEcr, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Cumulative Reward',
                        data: [0],
                        borderColor: '#10b981',
                        borderWidth: 4,
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { min: -10, max: 250, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748b' } },
                        x: { grid: { display: false }, ticks: { color: '#64748b' } }
                    },
                    plugins: { legend: { display: false } }
                }
            });

            let timer;
            window.animateEcrV2 = function(type) {
                clearInterval(timer);
                const path = type === 'greedy' ? greedyPath : optimalPath;
                const color = type === 'greedy' ? '#94a3b8' : '#10b981';
                const bg = type === 'greedy' ? 'rgba(148, 163, 184, 0.1)' : 'rgba(16, 185, 129, 0.1)';
                
                ecrChart.data.datasets[0].borderColor = color;
                ecrChart.data.datasets[0].backgroundColor = bg;
                ecrChart.data.datasets[0].data = [];
                
                let i = 0;
                const score = document.getElementById('ecr-score-v2');
                timer = setInterval(() => {
                    ecrChart.data.datasets[0].data.push(path[i]);
                    ecrChart.update();
                    score.innerText = Math.round(path[i]);
                    i++;
                    if (i >= path.length) {
                        clearInterval(timer);
                        score.innerText = Math.round(path[path.length-1]) + (type === 'optimal' ? " (WIN!)" : " (STUCK)");
                    }
                }, 150);
            };
        })();
    </script>
</div>
{{< /rawhtml >}}

