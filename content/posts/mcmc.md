+++
title = "MCMC: 복잡한 확률분포를 산책으로 이해하는 방법"
date = 2026-06-16T00:20:00+09:00
draft = false
slug = "mcmc"
categories = ["engineering"]
tags = ["MCMC", "Markov Chain", "Monte Carlo", "베이지안", "확률론", "마코프 확장"]
mentions = ["MCMC", "Metropolis-Hastings", "Markov Chain", "Monte Carlo", "Bayesian Inference", "Sampling"]
description = "MCMC는 직접 계산하기 어려운 확률분포에서 샘플을 얻기 위해 마코프 체인을 설계하는 방법이다. 분포 위를 오래 걸으면 방문 빈도가 분포의 모양을 드러낸다는 직관이 핵심이다."
+++

{{< ai_summary >}}
MCMC는 목표 분포가 높은 곳에 더 오래 머무는 마코프 체인을 만들어 복잡한 분포의 샘플을 얻는 방법이다. 제안 폭이 작으면 이동은 잘 받아들여지지만 천천히 섞이고, 너무 크면 거절이 많아져 탐색이 멈춘다. 수락률, 방문 빈도, 최근 경로를 함께 보면 샘플링 품질을 직관적으로 판단할 수 있다.
{{< /ai_summary >}}

## 인터랙티브 인포그래픽

제안 폭과 스텝 수를 조정하면 체인이 얼마나 잘 섞이는지 볼 수 있다. 목표 분포, 실제 방문 빈도, 최근 이동 경로가 한 화면에 겹쳐진다.

{{< interactiveframe src="/markov-extensions/mcmc/" title="MCMC: 복잡한 확률분포를 산책으로 이해하는 방법 인터랙티브 인포그래픽" >}}

## 1. 요약 (Executive Summary)
확률분포를 안다는 것은 단순히 평균 하나를 안다는 뜻이 아니다. 어떤
값이 얼마나 그럴듯한지, 불확실성이 어느 구간에 몰려 있는지, 여러 변수가
함께 움직일 때 어떤 조합이 가능한지를 이해한다는 뜻이다.
문제는 현실의 많은 분포가 너무 복잡하다는 점이다. 식은 쓸 수 있지만
적분이 어렵거나, 차원이 너무 높아서 전체 모양을 직접 계산할 수 없는
경우가 많다. MCMC는 이 문제를 다른 방식으로 푼다.
> “전체 지도를 한 번에 그릴 수 없다면, 그 지형을 오래 걸어 다니며 자주
> 방문한 곳을 기록하자.”
## 2. 이름의 의미
MCMC는 두 단어가 합쳐진 말이다.
- Markov Chain: 다음 위치가 현재 위치에만 의존하는 확률적 이동
과정
- Monte Carlo: 무작위 표본을 많이 뽑아 계산하는 방법
즉 MCMC는 마코프 체인을 이용해 몬테카를로 샘플을 만드는 방법이다.
## 3. 직관: 분포 위를 걷는 사람
산의 높이가 확률밀도라고 생각해 보자. 높은 산은 그 값이 더
그럴듯하다는 뜻이고, 낮은 평지는 덜 그럴듯하다는 뜻이다. MCMC의 산책자는
높은 곳으로 가는 제안은 잘 받아들이고, 낮은 곳으로 내려가는 제안은
가끔만 받아들인다. 그렇게 하면 산책자는 자연스럽게 높은 확률 영역에 오래
머문다.
오랜 시간이 지나면 산책자의 방문 빈도가 목표 분포의 모양과
비슷해진다.
## 4. 간단한 알고리즘:
Metropolis-Hastings
```text
1. 현재 위치 x에서 시작한다.
2. 주변의 새 위치 x'를 제안한다.
3. target(x') / target(x)를 계산한다.
4. 새 위치가 더 그럴듯하면 이동한다.
5. 덜 그럴듯해도 일정 확률로 이동한다.
6. 이 과정을 오래 반복한다.
```
핵심은 덜 좋은 위치로도 가끔 이동한다는 점이다. 그래야 한 봉우리에
갇히지 않고 전체 분포를 탐색할 수 있다.
## 5. 왜 필요한가
베이지안 추론에서는 사전분포와 데이터 likelihood를 결합해 사후분포를
만든다. 하지만 이 사후분포는 대부분 손으로 계산하기 어렵다. MCMC는 이
사후분포에서 직접 샘플을 뽑아 평균, 신뢰구간, 예측분포를 근사한다.
물리학에서는 입자 시스템의 평형 상태를 시뮬레이션할 수 있고,
금융에서는 복잡한 위험분포나 파라미터 불확실성을 탐색할 수 있다.
## 6. 주의할 점
MCMC는 샘플을 준다고 해서 자동으로 정확한 것은 아니다. 체인이 목표
분포에 충분히 도달했는지, 여러 봉우리를 잘 오가고 있는지, 샘플 간 상관이
너무 높지 않은지 확인해야 한다. 이를 수렴 진단, mixing, effective sample
size라고 부른다.
또한 제안 폭이 중요하다. 너무 작으면 천천히 움직이고, 너무 크면
대부분 거절된다. 현대 도구인 Stan은 Hamiltonian Monte Carlo와 NUTS를
사용해 고차원 분포에서 더 효율적으로 이동한다.
## 7. 결론
MCMC는 복잡한 분포를 직접 계산하는 대신, 그 분포가 높은 곳에 오래
머무는 확률적 산책자를 만든다. 이 아이디어는 단순하지만 강력하다.
“모르는 것을 확률적으로 탐색한다”는 점에서 현대 통계학과 머신러닝의 핵심
사고방식 중 하나다.
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
