+++
title = "랜덤워크(Random Walk): 우연한 한 걸음이 만드는 장기 패턴"
date = 2026-06-16T00:30:00+09:00
draft = false
slug = "random-walk"
categories = ["engineering"]
tags = ["Random Walk", "확률과정", "마코프 체인", "금융", "확산", "마코프 확장"]
mentions = ["Random Walk", "Diffusion", "Markov Chain", "Gambler's Ruin", "Brownian Motion"]
description = "랜덤워크는 매 순간 무작위로 한 걸음씩 이동하는 확률 과정이다. 개별 움직임은 단순하지만 시간이 지나면 확산, 도박사의 파산, 금융 가격 모델 같은 중요한 현상을 설명한다."
+++

{{< ai_summary >}}
랜덤워크는 현재 위치에서 무작위로 한 걸음씩 이동하는 가장 단순한 확률 과정이다. 평균은 제자리에 머물 수 있어도 가능한 위치의 폭은 대략 √n 규모로 커진다. 편향 확률 p를 바꾸면 경로의 중심이 한쪽으로 드리프트하고, 스텝 수를 늘리면 불확실성 부채꼴이 넓어진다.
{{< /ai_summary >}}

## 인터랙티브 인포그래픽

스텝 수와 오른쪽 이동 확률을 바꾸면 평균 드리프트와 불확실성 폭이 함께 달라진다. 진한 선은 하나의 역사이고, 음영은 가능한 미래의 통계적 폭이다.

{{< interactiveframe src="/markov-extensions/random-walk/" title="랜덤워크(Random Walk): 우연한 한 걸음이 만드는 장기 패턴 인터랙티브 인포그래픽" >}}

## 1. 요약 (Executive Summary)
랜덤워크(Random Walk)는 확률론에서 가장 단순하면서도 강력한 모델 중
하나다. 매 순간 왼쪽 또는 오른쪽으로 한 걸음 이동한다고 생각하면 된다.
각 걸음은 작고 무작위적이지만, 시간이 지나면 전체 경로는 단순하지 않은
구조를 만든다.
랜덤워크는 마코프 체인의 한 예다. 다음 위치는 과거 전체가 아니라 현재
위치와 다음 무작위 스텝에 의해 결정된다.
## 2. 가장 단순한 정의
```text
X₀ = 0
Xₙ = Xₙ₋₁ + εₙ
εₙ ∈ {−1, +1}
```
공정한 랜덤워크라면 +1과 -1의 확률이 각각 1/2이다. 이 경우
평균적으로는 오른쪽도 왼쪽도 치우치지 않는다. 하지만 그렇다고 항상 0
근처에만 머무는 것은 아니다. 시간이 갈수록 가능한 위치의 폭은 점점
넓어진다.
## 3. 직관: 평균은 가만히
있어도 위험은 커진다
공정한 동전을 던진다면 기대값은 0이다. 그러나 100번 던진 뒤의 위치가
정확히 0일 가능성은 높지 않다. 어떤 경로는 +12까지 가고, 어떤 경로는
-8까지 간다. 평균은 0이지만 분산은 커진다.
이것이 랜덤워크의 중요한 통찰이다.
> “방향성 없는 우연도 시간이 지나면 불확실성의 폭을 키운다.”
## 4. 왜 중요한가
랜덤워크는 확산 현상을 이해하는 기본 모델이다. 물질 입자의 움직임,
열의 확산, 생태계의 이동, 주가 모델, 도박사의 파산 문제까지 다양한
분야에 등장한다.
금융에서 가격 변화가 완전히 예측 불가능하다고 가정하면 가격은
랜덤워크처럼 움직일 수 있다. 물론 실제 시장은 완전한 랜덤워크가 아니다.
거래비용, 유동성, 군집행동, 제도, 정보 비대칭, 추세와 평균회귀가 섞여
있다. 그럼에도 랜덤워크는 “예측 가능한 패턴이 없는 기준선”을
제공한다.
## 5. 랜덤워크와 마코프 체인
랜덤워크는 현재 위치가 상태이고, 다음 상태가 확률적으로 정해지는
마코프 체인이다. 현재 위치가 3이라면 다음 위치는 2 또는 4가 된다. 과거에
어떤 경로로 3에 도달했는지는 다음 한 걸음을 결정하는 데 필요하지
않다.
## 6. 활용과 한계
랜덤워크는 단순한 기준 모델로 유용하다. 하지만 현실을 그대로
설명한다고 보면 위험하다. 예를 들어 금융 가격은 뉴스, 정책, 유동성,
투자자 행동, 시장 미시구조의 영향을 받는다. 입자의 확산도 매질의 구조에
따라 단순 랜덤워크와 달라진다.
따라서 랜덤워크는 “현실의 완전한 설명”이라기보다 “복잡한 확률적
움직임을 이해하기 위한 첫 좌표계”로 보는 것이 적절하다.
## 7. 결론
랜덤워크는 우연이 누적될 때 어떤 패턴이 생기는지 보여준다. 단순한
모델이지만, 불확실성의 폭, 확산, 리스크, 경로 의존성을 이해하는 데 매우
강력한 출발점이다.
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
