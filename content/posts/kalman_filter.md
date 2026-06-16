+++
title = "칼만 필터(Kalman Filter): 흔들리는 센서 속에서 진짜 상태를 추정하는 법"
date = 2026-06-16T00:10:00+09:00
draft = false
slug = "kalman-filter"
categories = ["engineering"]
tags = ["Kalman Filter", "확률론", "상태추정", "센서융합", "제어공학", "마코프 확장"]
mentions = ["Kalman Filter", "Kalman Gain", "State Estimation", "Sensor Fusion", "Prediction", "Update"]
description = "칼만 필터는 예측과 측정을 반복적으로 결합해 노이즈가 있는 데이터 속에서 현재 상태를 추정하는 알고리즘이다. GPS, IMU, 컴퓨터 비전, 제어 시스템처럼 현실의 측정값이 흔들리는 분야에서 핵심 도구로 쓰인다."
+++

{{< ai_summary >}}
칼만 필터는 모델 예측과 센서 측정을 불확실성의 크기로 가중해 현재 상태를 추정한다. 측정 노이즈 R이 커지면 센서를 덜 믿고, 모델 노이즈 Q가 커지면 예측을 덜 믿는다. 핵심은 예측과 보정의 반복, 그리고 두 정보원 사이의 신뢰 비율을 정하는 Kalman Gain이다.
{{< /ai_summary >}}

## 인터랙티브 인포그래픽

측정 노이즈와 모델 노이즈를 바꾸면 필터가 센서와 예측 중 무엇을 더 믿는지 바로 드러난다. 아래 시각화는 실제 상태, 흔들리는 측정값, 필터 추정값, 추정 불확실성 폭을 함께 보여준다.

{{< interactiveframe src="/markov-extensions/kalman-filter/" title="칼만 필터(Kalman Filter): 흔들리는 센서 속에서 진짜 상태를 추정하는 법 인터랙티브 인포그래픽" >}}

## 1. 요약 (Executive Summary)
현실의 센서는 완벽하지 않다. GPS는 건물 사이에서 튀고, 카메라는
조명에 흔들리며, IMU는 시간이 지날수록 드리프트가 생긴다. 그렇다고
센서를 버릴 수도 없다. 반대로 물리 모델만 믿는 것도 위험하다. 실제
물체는 마찰, 충격, 바람, 미세한 제어 오차 때문에 모델대로만 움직이지
않는다.
칼만 필터(Kalman Filter)는 이 둘 사이의 균형을 잡는 알고리즘이다.
먼저 현재 상태를 바탕으로 다음 상태를 예측한다. 다음으로 실제 측정값이
들어오면, 예측값과 측정값의 차이를 계산한다. 이 차이를 “innovation” 또는
“residual”이라고 부른다. 그리고 그 차이를 얼마나 반영할지 Kalman
Gain으로 결정한다.
가장 단순하게 말하면 칼만 필터는 다음 질문에 답한다.
> “내가 가진 모델과 센서가 둘 다 불완전하다면, 지금 무엇을 가장 믿어야
> 하는가?”
## 2. 직관: 예측과 측정의 협상
예를 들어 자동차의 위치를 추정한다고 하자. 자동차가 1초 전에 10m
지점에 있었고 속도가 5m/s였다면, 물리 모델은 1초 뒤 위치를 15m라고
예측할 수 있다. 그런데 GPS가 18m라고 측정했다. 이때 무엇이 맞을까?
정답은 “상황에 따라 다르다”이다. GPS 노이즈가 작다면 18m에 가까운
값을 믿어야 한다. 반대로 GPS가 터널 근처에서 불안정하다면 15m에 가까운
값을 유지해야 한다. 칼만 필터는 이 판단을 감이 아니라 불확실성의 크기로
계산한다.
## 3. 핵심 공식
칼만 필터의 기본 구조는 예측과 갱신이다.
```text
예측:
x̂⁻ = F x̂
P⁻ = F P Fᵀ + Q
갱신:
K = P⁻Hᵀ(HP⁻Hᵀ + R)⁻¹
x̂ = x̂⁻ + K(z − Hx̂⁻)
P = (I − KH)P⁻
```
여기서 x̂는 상태 추정값, P는 추정 불확실성, F는 시스템이 시간에 따라
어떻게 변하는지 나타내는 모델, Q는 모델 노이즈, z는 측정값, H는 측정
모델, R은 측정 노이즈다. K는 Kalman Gain이다.
## 4. 무엇을 이해해야 하는가
칼만 필터를 처음 볼 때 행렬식이 복잡해 보이지만, 핵심은 세
가지다.
첫째, 모든 추정에는 불확실성이 붙는다. 칼만 필터는 값만 추정하지 않고
그 값이 얼마나 믿을 만한지도 함께 추정한다.
둘째, 예측도 틀릴 수 있고 측정도 틀릴 수 있다. Q가 크면 모델을 덜
믿고, R이 크면 센서를 덜 믿는다.
셋째, 필터는 한 번 계산하고 끝나는 것이 아니라 매 시점 반복된다.
그래서 시간에 따라 들어오는 데이터를 연속적으로 흡수한다.
## 5. 활용 분야
칼만 필터는 센서 융합, 항법, 로봇 위치 추정, 컴퓨터 비전 객체 추적,
경제 시계열 추정, 신호처리 등에서 사용된다. 특히 위치와 속도처럼 직접
측정하기 어렵거나, 측정값이 노이즈에 오염되는 문제에서 강력하다.
## 6. 한계
칼만 필터는 기본형 기준으로 선형 시스템과 가우시안 노이즈를 가정한다.
현실 시스템이 강하게 비선형이면 확장 칼만 필터(EKF), 무향 칼만
필터(UKF), 파티클 필터 같은 변형이 필요하다. 또한 Q와 R을 잘못 설정하면
필터가 너무 둔감해지거나, 반대로 노이즈를 실제 변화로 착각할 수
있다.
## 7. 결론
칼만 필터는 단순한 노이즈 제거기가 아니다. 그것은 “모델 기반 예측”과
“현실 기반 측정”을 불확실성의 언어로 결합하는 사고방식이다. 이 관점은
로봇, 항공, 자율주행뿐 아니라 데이터 기반 의사결정 전반에 적용될 수
있다.
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
