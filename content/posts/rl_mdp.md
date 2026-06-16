+++
title = "강화학습과 MDP: 불확실한 세계에서 행동을 선택하는 수학"
date = 2026-06-16T00:40:00+09:00
draft = false
slug = "rl-mdp"
categories = ["engineering"]
tags = ["Reinforcement Learning", "MDP", "Markov Decision Process", "AI", "제어", "마코프 확장"]
mentions = ["Reinforcement Learning", "Markov Decision Process", "Value Iteration", "Policy", "Reward", "Discount Factor"]
description = "MDP는 상태, 행동, 전이확률, 보상, 할인율로 순차적 의사결정 문제를 표현하는 틀이다. 강화학습은 이 틀 위에서 경험을 통해 장기 보상을 극대화하는 정책을 학습한다."
+++

{{< ai_summary >}}
MDP는 마코프 체인에 행동과 보상을 더해 순차적 의사결정을 표현한다. 각 상태의 가치는 당장의 보상뿐 아니라 미래 보상과 전이 불확실성에 의해 정해진다. 할인율, 미끄러짐 확률, 가치 반복 횟수를 바꾸면 정책 화살표와 가치 지도가 어떻게 바뀌는지 확인할 수 있다.
{{< /ai_summary >}}

## 인터랙티브 인포그래픽

Grid World에서 할인율, 미끄러짐 확률, 반복 횟수를 바꾸면 각 상태의 가치와 정책 화살표가 달라진다. 즉 MDP가 단순한 경로 찾기가 아니라 불확실성과 장기 보상을 함께 계산하는 틀임을 보여준다.

{{< interactiveframe src="/markov-extensions/rl-mdp/" title="강화학습과 MDP: 불확실한 세계에서 행동을 선택하는 수학 인터랙티브 인포그래픽" >}}

## 1. 요약 (Executive Summary)
강화학습(Reinforcement Learning)은 “정답 라벨”을 보고 배우는
지도학습과 다르다. 에이전트는 행동을 선택하고, 환경은 결과와 보상을
돌려준다. 에이전트는 단기 보상만이 아니라 장기 누적 보상을 키우는
방향으로 정책을 개선한다.
이 문제를 수학적으로 표현하는 대표적 틀이 MDP(Markov Decision
Process)다.
## 2. MDP의 구성요소
MDP는 보통 다음 다섯 요소로 표현한다.
```text
MDP = (S, A, P, R, γ)
```
- S: 가능한 상태들의 집합
- A: 가능한 행동들의 집합
- P: 어떤 상태에서 어떤 행동을 했을 때 다음 상태로 갈 확률
- R: 그 전이에서 받는 보상
- γ: 미래 보상을 현재 기준으로 얼마나 중요하게 볼지 정하는 할인율
예를 들어 로봇이 창고에서 이동한다면 상태는 위치와 배터리 잔량,
행동은 전진·회전·충전, 보상은 목표 도착, 충돌 패널티, 시간 비용이 될 수
있다.
## 3. 마코프 체인과의 차이
마코프 체인에서는 상태 전이가 정해진 확률에 따라 발생한다. 에이전트가
선택할 행동은 없다. 반면 MDP에서는 행동이 전이확률을 바꾼다.
```text
마코프 체인: 상태 → 다음 상태
MDP: 상태 → 행동 → 다음 상태 + 보상
```
즉 MDP는 “관찰하는 확률 과정”이 아니라 “개입할 수 있는 확률
과정”이다.
## 4. 가치함수와 정책
강화학습에서 중요한 개념은 가치함수와 정책이다. 가치함수는 어떤
상태가 장기적으로 얼마나 좋은지를 나타낸다. 정책은 각 상태에서 어떤
행동을 선택할지 정하는 규칙이다.
```text
V(s) = 그 상태에서 시작했을 때 기대되는 장기 누적 보상
π(s) = 그 상태에서 선택할 행동
```
에이전트의 목표는 좋은 정책을 찾는 것이다.
## 5. 왜 어려운가
강화학습이 어려운 이유는 현재 행동의 결과가 즉시 드러나지 않을 수
있기 때문이다. 지금 얻은 작은 손해가 장기적으로 큰 이익을 만들 수도
있고, 지금 얻은 보상이 미래 위험을 키울 수도 있다.
또한 탐험과 활용의 균형이 필요하다. 이미 좋아 보이는 행동만 반복하면
더 좋은 행동을 발견하지 못한다. 반대로 계속 탐험만 하면 성과가 안정되지
않는다.
## 6. 활용 분야
강화학습과 MDP는 게임 AI, 로봇 제어, 자율주행, 추천 시스템, 재고관리,
포트폴리오 의사결정, 에너지 최적화 등 순차적 의사결정 문제가 있는 곳에
적용된다.
다만 현실 적용에서는 보상 설계가 매우 중요하다. 보상을 잘못 설계하면
에이전트는 인간이 의도하지 않은 방식으로 보상을 극대화할 수 있다. 이것은
단순한 기술 문제가 아니라 시스템 설계 문제다.
## 7. 결론
MDP는 불확실한 세계에서 행동을 선택하는 수학적 언어다. 강화학습은 그
언어를 바탕으로 경험을 통해 정책을 개선한다. 결국 핵심 질문은
이것이다.
> “지금의 선택이 미래의 가능성을 어떻게 바꾸는가?”
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
