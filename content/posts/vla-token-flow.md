+++
title = "VLA 모델의 입력→출력 과정을 토큰의 흐름으로 보기"
date = 2026-07-08T00:00:00+09:00
draft = false
slug = "vla-token-flow"
categories = ["engineering"]
tags = ["VLA", "Vision-Language-Action", "LLM", "Transformer", "KV Cache", "Robotics", "Token Flow"]
mentions = ["OpenVLA", "RT-2", "PaLM-E", "RMSNorm", "KV Cache", "Transformer"]
description = "LLM과 VLA의 입력·출력 차이를 토큰 흐름, Transformer layer, Norm, Attention, KV cache, action decoding 관점에서 비교하는 인터랙티브 시각화다."
summary = "LLM과 VLA의 입력·출력 차이를 토큰 흐름, Transformer layer, Norm, Attention, KV cache, action decoding 관점에서 비교한다."
wide_content = true
+++

{{< ai_summary >}}
LLM은 주로 텍스트 토큰의 다음 항목을 생성하지만, VLA는 시각·언어·상태 토큰을 결합해 행동 토큰 또는 연속 제어값을 생성한다. 이 글은 VLA가 image patch, instruction, proprioception, action history를 Transformer 내부 표현으로 정렬하고, Norm·Attention·MLP·KV cache를 지나 실제 세계에 개입하는 action으로 이어지는 과정을 LLM과 나란히 비교한다.
{{< /ai_summary >}}

## 인터랙티브 시각화

아래 시각화는 제공된 단일 HTML 자료를 이 사이트의 글 형식에 맞춰 임베드한 것이다. LLM과 VLA의 파이프라인 비교, 토큰 흐름 단계, Transformer block 내부, KV cache 동작, 그리고 기호열 생성에서 감각-운동 루프로 넘어가는 철학적 함의를 함께 살펴볼 수 있다.

{{< interactiveframe src="/markov-extensions/vla-token-flow/" title="VLA 모델 입력-출력 토큰 흐름 시각화" minheight="760" >}}

## 핵심 구분

LLM은 문맥 안에서 다음 텍스트 토큰을 생성한다. VLA는 텍스트 명령만이 아니라 카메라 프레임, 로봇 상태, 과거 행동 이력을 함께 받아 다음 행동을 만든다. 그래서 VLA의 출력 오류는 단순한 문장 오류가 아니라 물리적 실패로 이어질 수 있다.

```text
LLM: text tokens -> language model -> next text token
VLA: vision + language + state + action history -> policy model -> action token or control value
```

이 차이 때문에 KV cache도 다르게 해석해야 한다. 정적인 instruction prefix는 재사용할 수 있지만, 로봇이 움직인 뒤 새로 들어온 image/state token은 이전 관측의 cache로 대체할 수 없다. 세계가 바뀌었기 때문이다.

## 참고 자료

- OpenVLA 공식 페이지: https://openvla.github.io/
- OpenVLA 논문: https://arxiv.org/abs/2406.09246
- RT-2 논문, CoRL/PMLR 2023: https://proceedings.mlr.press/v229/zitkovich23a.html
- PaLM-E 공식 페이지: https://palm-e.github.io/
- Hugging Face Transformers, Caching: https://huggingface.co/docs/transformers/en/cache_explanation
- NVIDIA, LLM inference optimization: https://developer.nvidia.com/blog/mastering-llm-techniques-inference-optimization/
- LLaMA 논문: https://arxiv.org/abs/2302.13971
- RMSNorm 논문, NeurIPS 2019: https://proceedings.neurips.cc/paper/2019/hash/1e8a19426224ca89e83cef47f1e7f53b-Abstract.html
