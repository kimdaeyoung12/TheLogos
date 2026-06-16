+++
title = "DSR(Deflated Sharpe Ratio): 좋아 보이는 백테스트를 의심하는 법"
date = 2026-06-16T00:50:00+09:00
draft = false
slug = "deflated-sharpe-ratio"
categories = ["engineering"]
tags = ["Deflated Sharpe Ratio", "DSR", "Quant", "Backtest", "Overfitting", "Sharpe Ratio", "마코프 확장"]
mentions = ["Deflated Sharpe Ratio", "Sharpe Ratio", "Backtest Overfitting", "Selection Bias", "Skewness", "Kurtosis"]
description = "DSR은 높은 샤프지수가 실제 투자 실력인지, 많은 후보를 테스트하다 우연히 좋은 결과를 고른 것인지 판단하기 위한 통계적 검증 도구다."
+++

{{< ai_summary >}}
DSR은 관측된 Sharpe가 많은 후보 탐색, 짧은 표본, 비정규 수익률 때문에 부풀려졌는지 낮춰 보는 지표다. 후보 수가 늘면 요구 Sharpe가 올라가고, 기간이 짧거나 꼬리가 두꺼운 분포일수록 신뢰도는 낮아진다. 왜도와 첨도는 단순 숫자가 아니라 수익률 분포의 꼬리와 비대칭을 바꾸는 위험 신호다.
{{< /ai_summary >}}

## 인터랙티브 인포그래픽

관측 Sharpe, 후보 수, 기간뿐 아니라 왜도와 첨도를 움직여보면 분포의 비대칭과 꼬리 두께가 신뢰도 판단을 어떻게 바꾸는지 볼 수 있다. 기존 막대형 표시 대신 분포 곡선과 꼬리 위험 영역을 함께 그린다.

{{< interactiveframe src="/markov-extensions/deflated-sharpe-ratio/" title="DSR(Deflated Sharpe Ratio): 좋아 보이는 백테스트를 의심하는 법 인터랙티브 인포그래픽" >}}

## 1. 요약 (Executive Summary)
퀀트 전략을 만들 때 가장 위험한 순간은 백테스트 성과가 매우 좋아 보일
때다. 샤프지수가 높고, MDD가 낮고, 승률이 좋아 보이면 전략이 발견된
것처럼 느껴진다. 하지만 많은 후보를 반복적으로 테스트했다면 이야기가
달라진다.
동전을 1,000번 던지는 실험을 여러 사람이 반복하면, 그중 누군가는
우연히 앞면이 많이 나올 수 있다. 마찬가지로 수백 개의 전략 파라미터를
돌리면, 실제 알파가 없어도 그중 하나는 백테스트에서 좋아 보일 수
있다.
DSR은 이 문제를 다룬다.
> “이 Sharpe는 실력인가, 아니면 많은 시도 중 우연히 살아남은
> 착시인가?”
## 2. 일반 Sharpe Ratio의 한계
Sharpe Ratio는 다음과 같은 구조를 가진다.
```text
Sharpe Ratio = 평균 초과수익 / 수익률 표준편차
```
간단하고 직관적이지만 세 가지 문제가 있다.
첫째, 표본이 짧으면 성과가 쉽게 부풀려진다. 둘째, 수익률이 정규분포가
아니면 평균과 표준편차만으로 위험을 충분히 설명하지 못한다. 셋째, 여러
후보를 테스트한 뒤 가장 좋은 전략만 보고하면 선택 편향이 생긴다.
## 3. DSR이 보정하려는 것
Bailey와 López de Prado의 DSR은 크게 두 가지 성과 인플레이션을
보정하려 한다.
- 여러 번의 테스트로 인한 선택 편향
- 비정규 수익률 분포로 인한 Sharpe 신뢰도 왜곡
논문에서는 DSR을 Probabilistic Sharpe Ratio의 확장으로 설명한다. 단,
기준 Sharpe를 사용자가 임의로 정하는 대신, 여러 후보를 테스트했을 때
우연히 기대되는 최대 Sharpe를 반영해 임계치를 높인다.
## 4. 직관적 예시
전략 후보를 3개만 테스트했다면 Sharpe 1.2는 꽤 강해 보일 수 있다.
하지만 후보를 3,000개 테스트했다면 Sharpe 1.2는 그렇게 놀랍지 않을 수
있다. 우연히 좋은 결과가 나올 기회가 그만큼 많았기 때문이다.
따라서 퀀트 시스템에서 중요한 것은 “Sharpe가 얼마인가?”만이
아니다.
```text
Sharpe가 얼마인가?
표본은 충분히 긴가?
몇 개 후보 중에서 선택된 것인가?
수익률 분포는 정규분포에 가까운가?
거래비용과 체결 가능성은 반영되었는가?
```
이 질문을 함께 해야 한다.
## 5. DSR이 유용한 상황
DSR은 특히 자동 전략 생성 시스템에서 중요하다. 유전 알고리즘,
베이지안 최적화, 파라미터 그리드 서치, LLM 기반 전략 생성처럼 수많은
후보를 만들고 필터링하는 구조에서는 과최적화 위험이 크다.
이때 DSR은 승격 게이트 역할을 할 수 있다. 단순히 백테스트 Sharpe가
높다는 이유로 후보를 live 또는 probation 단계로 보내지 않고, 여러 후보
중 우연히 살아남은 전략인지 먼저 의심한다.
## 6. DSR이 해결하지 못하는 것
DSR은 강력하지만 만능은 아니다. 데이터 누수, survivorship bias,
거래비용 누락, 체결 불가능한 주문, 시장 시간 처리 오류, 리밸런싱 지연
같은 구현 문제는 DSR만으로 잡을 수 없다.
또한 DSR은 통계적 신뢰도를 보는 도구이지, 전략의 경제적 논리를
보장하지 않는다. 좋은 퀀트 검증은 통계 지표와 경제적 설명을 함께
요구해야 한다.
## 7. 결론
DSR은 백테스트 성과를 낮춰 보기 위한 도구다. 이는 비관주의가 아니라
생존을 위한 절차다. 시장은 작은 착각을 빠르게 벌한다. 따라서 전략이 좋아
보일수록 더 강하게 의심해야 한다.
좋은 전략 검증의 기본 태도는 다음과 같다.
> “성과가 좋다”가 아니라 “우연, 과최적화, 비정규성, 비용을 이겨낸
> 뒤에도 성과가 남는가?”
## 참고자료
- MathWorks, “Kalman Filter - MATLAB & Simulink”, 확인일:
2026-06-16, https://www.mathworks.com/discovery/kalman-filter.html
- Alex Becker, “Kalman Filter Explained Through Examples”, 확인일:
2026-06-16, https://kalmanfilter.net/
- Stan Reference Manual, “MCMC Sampling”, 확인일: 2026-06-16,
https://mc-stan.org/docs/reference-manual/mcmc.html
- MIT OpenCourseWare, “Lecture 25: Random Walks”, 확인일: 2026-06-16,
https://ocw.mit.edu/courses/6-042j-mathematics-for-computer-science-fall-2010/resources/lecture-25-random-walks/
- Stanford CS221, “Markov Decisions”, 확인일: 2026-06-16,
https://stanford.edu/~cpiech/cs221/handouts/markovDecisions.html
- Bailey, D. H. & López de Prado, M., “The Deflated Sharpe Ratio:
Correcting for Selection Bias, Backtest Overfitting and Non-Normality”,
Journal of Portfolio Management, 2014; SSRN 확인일: 2026-06-16,
https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2460551
