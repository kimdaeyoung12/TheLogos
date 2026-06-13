+++
title = "CRISPR-Cas 시스템을 시스템 공학으로 분석하기"
date = 2026-06-13T00:00:00+09:00
draft = false
categories = ["engineering"]
tags = ["CRISPR", "유전자편집", "시스템공학", "생명윤리", "제어"]
mentions = ["CRISPR-Cas9", "Base Editing", "Prime Editing", "Guide RNA", "DNA Repair"]
description = "CRISPR-Cas9, 염기 교정, 프라임 교정을 시스템 아키텍처, 제어 신호, 표적 특이성, 복구 경로, 오류 모드의 관점에서 기술적으로 분석합니다."
+++

{{< ai_summary >}}
CRISPR-Cas 시스템은 "유전자 가위"라는 비유보다 시스템 공학적 구조로 볼 때 더 정확히 이해된다. gRNA는 표적 지정 신호, Cas nuclease는 programmable actuator, PAM은 접근 제약 조건, DNA repair pathway는 plant dynamics에 해당한다. 편집 결과는 절단 자체가 아니라 세포 복구 경로, 전달 시스템, off-target profile, bystander edit, mosaicism 같은 오류 모드의 함수로 결정된다.
{{< /ai_summary >}}

CRISPR-Cas 기술은 단순한 절단 도구가 아니라 programmable molecular control system에 가깝다. 입력은 guide RNA와 편집기 구성이고, 작동기는 Cas nuclease 또는 변형된 Cas editor이며, plant는 세포 핵 안의 genome과 DNA repair network다. 출력은 특정 locus의 genotype 변화이지만, 실제 출력 분포는 표적 서열, chromatin accessibility, delivery vector, repair pathway, cell cycle state, 면역 반응에 의해 달라진다.

따라서 CRISPR를 기술적으로 분석하려면 "자를 수 있는가"보다 다음 질문이 중요하다.

- 표적 위치에 editor가 접근할 수 있는가?
- 원하는 allele change가 어느 비율로 발생하는가?
- off-target 또는 bystander edit의 분포는 허용 가능한가?
- 편집된 세포가 기능적으로 원하는 phenotype을 만드는가?
- 전달 시스템과 면역 반응이 전체 risk profile을 어떻게 바꾸는가?

## 1. 시스템 아키텍처

CRISPR-Cas9의 기본 구성은 다음과 같이 모델링할 수 있다.

| 시스템 요소 | 분자 구성 | 공학적 역할 | 주요 제약 |
|---|---|---|---|
| Reference target | Genomic DNA locus | 제어 대상 plant | chromatin state, repeats, GC content |
| Address signal | sgRNA 또는 gRNA | 표적 위치 지정 | mismatch tolerance, secondary structure |
| Access constraint | PAM sequence | editor binding 조건 | Cas variant별 PAM requirement |
| Actuator | Cas9 nuclease | double-strand break 생성 | nuclease activity, dwell time |
| Process dynamics | NHEJ, HDR 등 DNA repair | 편집 결과 결정 | cell cycle, template availability |
| Delivery layer | AAV, LNP, electroporation 등 | editor를 세포에 전달 | tropism, payload size, toxicity |
| Measurement | NGS, amplicon-seq, GUIDE-seq 등 | 편집 결과 검증 | detection limit, sampling bias |

이 구조에서 Cas9은 독립적으로 결과를 결정하지 않는다. Cas9은 특정 위치에 double-strand break를 생성할 뿐이며, 실제 genotype change는 세포의 repair dynamics에 의해 형성된다. 즉, CRISPR-Cas9은 "write operation"이라기보다 "damage induction plus endogenous repair exploitation"에 가깝다.

## 2. 표적 지정: gRNA, PAM, mismatch tolerance

Cas9의 표적 특이성은 주로 gRNA-DNA 상보성과 PAM 조건에 의해 결정된다. Streptococcus pyogenes Cas9의 전형적 PAM은 NGG로 알려져 있으며, Cas variant에 따라 PAM requirement는 달라진다. PAM은 표적 후보 공간을 제한하는 hard constraint다.

gRNA는 약 20nt 내외의 spacer를 통해 표적 서열과 결합한다. 그러나 완전 상보성만 binding을 허용하는 것은 아니다. mismatch 위치와 개수, 특히 seed region 근처 mismatch 여부에 따라 Cas9이 일부 off-target locus에도 결합하고 절단할 수 있다. 이 mismatch tolerance가 CRISPR의 핵심 오류 모드 중 하나다.

표적 설계에서는 다음 요소를 함께 평가해야 한다.

| 설계 항목 | 검토 내용 |
|---|---|
| On-target score | 목표 locus에서 절단 또는 편집이 일어날 가능성 |
| Off-target score | 유사 서열에서 비의도적 결합/절단 가능성 |
| PAM availability | 원하는 위치 근처에 사용 가능한 PAM이 있는지 |
| gRNA structure | guide RNA secondary structure가 Cas loading에 주는 영향 |
| Genomic context | 반복서열, paralogous sequence, SNP, chromatin 접근성 |

특히 임상 또는 고신뢰 응용에서는 "평균적으로 잘 작동하는 guide"보다 "실패 모드가 충분히 규명된 guide"가 중요하다. 시스템 공학에서 nominal performance보다 worst-case behavior가 더 중요한 상황과 같다.

## 3. DSB 기반 편집: NHEJ와 HDR

Cas9 nuclease는 target locus에 double-strand break(DSB)를 만든다. 이후 세포는 DNA 손상을 복구하기 위해 여러 repair pathway를 사용한다.

| Repair pathway | 일반적 결과 | 편집 관점의 의미 |
|---|---|---|
| NHEJ | insertion/deletion(indel) | gene knockout에 주로 활용 |
| MMEJ | microhomology 기반 deletion | 예측 가능한 deletion이 가능할 때도 있으나 locus 의존적 |
| HDR | donor template 기반 precise edit | knock-in 또는 정확한 치환에 활용 |

NHEJ는 효율이 높지만 결과가 indel distribution으로 나타난다. 따라서 특정 reading frame을 깨뜨리는 knockout에는 유리하지만, 정확한 서열 삽입이나 치환에는 적합하지 않다. HDR은 donor template을 사용해 더 정밀한 편집을 기대할 수 있지만, cell cycle과 세포 유형에 민감하고 효율이 낮을 수 있다.

즉 DSB 기반 CRISPR의 출력은 deterministic single result가 아니라 probability distribution이다. 같은 guide와 Cas9을 사용해도 세포 집단 안에서는 다양한 allele outcome이 생긴다. 이 분포를 측정하고, 기능적으로 허용 가능한 결과 범위를 정의하는 것이 편집 설계의 핵심이다.

## 4. 염기 교정과 프라임 교정

DSB의 위험과 outcome variability를 줄이기 위해 base editing과 prime editing이 개발되었다. 두 기술은 Cas nuclease의 절단 기능을 변형하거나 약화시키고, deaminase 또는 reverse transcriptase 같은 effector domain을 결합해 더 정밀한 edit을 유도한다.

| 기술 | 핵심 구성 | 가능한 편집 | 장점 | 주요 오류 모드 |
|---|---|---|---|---|
| CRISPR-Cas9 nuclease | Cas9 + sgRNA | indel, HDR 기반 삽입/치환 | knockout 효율, 범용성 | off-target DSB, large deletion, translocation |
| Base editor | nCas9/dCas9 + deaminase | C-to-T, A-to-G 계열 치환 | DSB 없이 single-base edit 가능 | bystander edit, RNA off-target, editing window 제약 |
| Prime editor | nCas9 + reverse transcriptase + pegRNA | 다양한 small substitution/insertion/deletion | donor DSB 없이 정밀 편집 가능 | pegRNA 설계 민감도, 낮은 효율, indel byproduct |

염기 교정은 특정 window 안에 있는 염기를 화학적으로 변환한다. 예를 들어 cytosine base editor는 C-to-T 변환을, adenine base editor는 A-to-G 변환을 유도한다. 단점은 editing window 안에 목표 염기와 유사한 다른 염기가 있으면 bystander edit이 발생할 수 있다는 점이다.

프라임 교정은 pegRNA가 target address와 desired edit template 역할을 함께 수행한다. Cas nickase가 한 가닥을 절개하고, reverse transcriptase가 pegRNA의 template을 사용해 새 서열을 합성한다. 이 방식은 편집 범위가 넓지만 pegRNA 설계와 세포 상태에 민감하며, 아직 모든 locus에서 높은 효율을 보장하지 않는다.

## 5. 편집 파이프라인

다음은 CRISPR 편집을 control pipeline으로 정리한 구조다.

<figure class="not-prose my-8 rounded border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
  <svg viewBox="0 0 980 210" role="img" aria-label="CRISPR editing pipeline diagram" style="width:100%;height:auto;">
    <defs>
      <marker id="arrow-crispr" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="#64748b"></path>
      </marker>
    </defs>
    <g font-family="Arial, sans-serif" font-size="18" fill="#111827">
      <rect x="20" y="50" width="140" height="72" rx="8" fill="#e0f2fe" stroke="#0369a1"></rect>
      <text x="90" y="80" text-anchor="middle" font-weight="700">Target</text>
      <text x="90" y="104" text-anchor="middle" font-size="14">locus + PAM</text>

      <rect x="210" y="50" width="140" height="72" rx="8" fill="#dcfce7" stroke="#15803d"></rect>
      <text x="280" y="80" text-anchor="middle" font-weight="700">Guide</text>
      <text x="280" y="104" text-anchor="middle" font-size="14">sgRNA / pegRNA</text>

      <rect x="400" y="50" width="150" height="72" rx="8" fill="#fef3c7" stroke="#b45309"></rect>
      <text x="475" y="80" text-anchor="middle" font-weight="700">Editor</text>
      <text x="475" y="104" text-anchor="middle" font-size="14">Cas / BE / PE</text>

      <rect x="600" y="50" width="150" height="72" rx="8" fill="#fae8ff" stroke="#a21caf"></rect>
      <text x="675" y="80" text-anchor="middle" font-weight="700">Repair</text>
      <text x="675" y="104" text-anchor="middle" font-size="14">NHEJ / HDR</text>

      <rect x="800" y="50" width="150" height="72" rx="8" fill="#fee2e2" stroke="#b91c1c"></rect>
      <text x="875" y="80" text-anchor="middle" font-weight="700">Outcome</text>
      <text x="875" y="104" text-anchor="middle" font-size="14">allele distribution</text>

      <line x1="160" y1="86" x2="205" y2="86" stroke="#64748b" stroke-width="3" marker-end="url(#arrow-crispr)"></line>
      <line x1="350" y1="86" x2="395" y2="86" stroke="#64748b" stroke-width="3" marker-end="url(#arrow-crispr)"></line>
      <line x1="550" y1="86" x2="595" y2="86" stroke="#64748b" stroke-width="3" marker-end="url(#arrow-crispr)"></line>
      <line x1="750" y1="86" x2="795" y2="86" stroke="#64748b" stroke-width="3" marker-end="url(#arrow-crispr)"></line>

      <text x="475" y="165" text-anchor="middle" font-size="15" fill="#475569">Final phenotype depends on delivery, chromatin state, repair dynamics, and error profile.</text>
    </g>
  </svg>
  <figcaption class="mt-3 text-sm text-gray-600 dark:text-gray-300">CRISPR 편집은 guide 설계만으로 끝나지 않는다. editor, repair pathway, delivery, outcome distribution을 함께 제어해야 한다.</figcaption>
</figure>

기술 검토의 최소 파이프라인은 다음과 같다.

1. Target locus 정의: disease variant, regulatory element, coding exon 등 목표를 명확히 한다.
2. Editor 선택: knockout, base substitution, precise insertion 중 목적에 맞는 editor를 선택한다.
3. Guide 설계: on-target efficiency와 off-target 후보를 동시에 평가한다.
4. Delivery 설계: 세포 유형, 조직 tropism, payload size, transient/permanent expression을 결정한다.
5. Outcome 측정: amplicon sequencing, whole-genome off-target assay, functional assay를 결합한다.
6. Risk 평가: off-target, bystander, large deletion, translocation, immune response를 검토한다.

## 6. 오류 모드와 검증 지표

CRISPR 시스템의 신뢰성은 평균 효율보다 오류 모드의 식별과 제한에 달려 있다.

| 오류 모드 | 설명 | 검증 접근 |
|---|---|---|
| Off-target edit | 유사 서열에서 비의도적 절단/편집 | in silico prediction + GUIDE-seq, CIRCLE-seq, WGS 등 |
| Bystander edit | editing window 내 주변 염기의 비의도적 변환 | amplicon deep sequencing |
| Large deletion | DSB 주변 큰 결실 | long-read sequencing, ddPCR |
| Translocation | 복수 DSB 사이 재배열 | karyotyping, targeted translocation assay |
| Mosaicism | 세포 집단 내 서로 다른 allele outcome | single-cell sequencing 또는 clone-level assay |
| Delivery toxicity | vector 또는 formulation 독성 | viability, cytokine, tissue pathology |
| Immune response | Cas protein/vector에 대한 면역 반응 | immunogenicity assay |

특히 DSB 기반 편집은 large deletion과 chromosomal rearrangement 가능성을 별도로 평가해야 한다. Base editor와 prime editor는 DSB 위험을 낮출 수 있지만, bystander edit과 editor-specific off-target 문제를 새롭게 고려해야 한다.

## 7. 설계 원칙

CRISPR 응용에서 중요한 것은 "가능한 편집"이 아니라 "검증 가능한 편집"이다. 시스템 공학적으로 다음 원칙이 필요하다.

- 목적 함수를 명확히 정의한다. knockout인지, 특정 염기 치환인지, 발현 조절인지에 따라 editor와 assay가 달라진다.
- editor exposure를 최소화한다. 장시간 발현은 off-target risk를 높일 수 있으므로 transient delivery가 유리한 경우가 있다.
- outcome distribution을 단일 효율 숫자로 축소하지 않는다. indel spectrum, allele fraction, functional rescue를 함께 본다.
- worst-case path를 먼저 검토한다. off-target 후보, p53 response, oncogenic selection, immune reaction 같은 실패 경로를 사전에 가정한다.
- 윤리적 경계를 기술 사양에 포함한다. somatic editing과 germline editing은 risk horizon과 동의 구조가 다르다.

## 결론

CRISPR-Cas 시스템은 programmable nuclease 기술이지만, 실제 편집 결과는 guide, editor, delivery, repair dynamics, cell state, measurement pipeline이 결합된 복합 시스템의 출력이다. 그러므로 CRISPR를 이해하려면 유전자 가위라는 은유를 넘어, 제어 신호와 작동기, plant dynamics와 오류 모드, 검증 지표를 함께 봐야 한다.

정밀 생명공학의 핵심은 더 강한 절단이 아니라 더 잘 제한된 개입이다. 원하는 위치에 필요한 만큼만 작동하고, 결과 분포를 측정하며, 실패 모드를 설계 단계에서 줄이는 것. CRISPR의 기술적 성숙도는 바로 이 시스템 공학적 통제 능력에 달려 있다.
